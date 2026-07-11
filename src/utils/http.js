import { config } from "../config.js";
import { formatError, logger, maskSensitiveValue } from "../logger.js";

const defaultHeaders = {
  "user-agent": "arc-mainnet-bridge-monitor/1.0 (+https://github.com/mapalubnb/arc-mainnet-bridge-monitor)",
  accept: "text/plain,text/markdown,text/html,application/json,*/*"
};

const byteLength = (text) => Buffer.byteLength(String(text || ""), "utf8");
const validators = new Map();

async function readLimited(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error(`响应体超过限制: ${declared} > ${maxBytes}`);
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error(`响应体超过限制: > ${maxBytes}`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function fetchText(url, options = {}) {
  const timeoutMs = options.timeoutMs || config.httpTimeoutMs;
  const method = options.method || "GET";
  const maxBytes = options.maxBytes || config.httpMaxBytes;
  const cached = validators.get(url);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  logger.debug("HTTP 请求开始", {
    method,
    url: maskSensitiveValue(url),
    timeoutMs
  });

  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...defaultHeaders,
        ...(cached?.etag ? { "if-none-match": cached.etag } : {}),
        ...(cached?.lastModified ? { "if-modified-since": cached.lastModified } : {}),
        ...(options.headers || {})
      },
      signal: controller.signal
    });
    if (response.status === 304 && cached) {
      return { text: cached.text, status: 304, headers: response.headers, notModified: true };
    }
    const text = await readLimited(response, maxBytes);
    const durationMs = Date.now() - startedAt;

    if (!response.ok) {
      logger.warn("HTTP 请求返回非成功状态", {
        method,
        url,
        status: response.status,
        statusText: response.statusText,
        durationMs,
        responsePreview: text.slice(0, 240)
      });
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 180)}`);
    }

    logger.debug("HTTP 请求成功", {
      method,
      url,
      status: response.status,
      durationMs,
      responseBytes: byteLength(text)
    });
    if (method === "GET") validators.set(url, {
      text,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified")
    });
    return { text, status: response.status, headers: response.headers, notModified: false };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    logger.warn("HTTP 请求失败", {
      method,
      url,
      timeoutMs,
      durationMs,
      error: formatError(error)
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson(url, options = {}) {
  const { text, status, headers } = await fetchText(url, {
    ...options,
    headers: { accept: "application/json", ...(options.headers || {}) }
  });

  try {
    return { json: JSON.parse(text), text, status, headers };
  } catch (error) {
    logger.warn("JSON 解析失败", {
      url,
      status,
      responsePreview: text.slice(0, 240),
      error: formatError(error)
    });
    throw error;
  }
}

export async function rpcCall(url, method, params = []) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.httpTimeoutMs);

  logger.debug("RPC 请求开始", {
    rpcUrl: url,
    method,
    paramsCount: params.length,
    timeoutMs: config.httpTimeoutMs
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { ...defaultHeaders, "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      signal: controller.signal
    });
    const json = await response.json();
    const durationMs = Date.now() - startedAt;

    if (!response.ok || json.error) {
      logger.warn("RPC 请求返回错误", {
        rpcUrl: url,
        method,
        status: response.status,
        durationMs,
        rpcError: json.error
      });
      throw new Error(json.error?.message || `HTTP ${response.status}`);
    }

    logger.debug("RPC 请求成功", {
      rpcUrl: url,
      method,
      status: response.status,
      durationMs
    });
    return json.result;
  } catch (error) {
    logger.warn("RPC 请求失败", {
      rpcUrl: url,
      method,
      durationMs: Date.now() - startedAt,
      error: formatError(error)
    });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

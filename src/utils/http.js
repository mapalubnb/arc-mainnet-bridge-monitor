import { config } from "../config.js";

const defaultHeaders = {
  "user-agent": "arc-mainnet-bridge-monitor/1.0 (+https://github.com/mapalubnb/arc-mainnet-bridge-monitor)",
  accept: "text/plain,text/markdown,text/html,application/json,*/*"
};

export async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || config.httpTimeoutMs);
  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: { ...defaultHeaders, ...(options.headers || {}) },
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${text.slice(0, 180)}`);
    }
    return { text, status: response.status, headers: response.headers };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJson(url, options = {}) {
  const { text, status, headers } = await fetchText(url, {
    ...options,
    headers: { accept: "application/json", ...(options.headers || {}) }
  });
  return { json: JSON.parse(text), text, status, headers };
}

export async function rpcCall(url, method, params = []) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.httpTimeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { ...defaultHeaders, "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
      signal: controller.signal
    });
    const json = await response.json();
    if (!response.ok || json.error) {
      throw new Error(json.error?.message || `HTTP ${response.status}`);
    }
    return json.result;
  } finally {
    clearTimeout(timeout);
  }
}

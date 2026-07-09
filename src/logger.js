import { config } from "./config.js";

const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const levelNames = {
  debug: "调试 Debug",
  info: "信息 Info",
  warn: "警告 Warn",
  error: "错误 Error"
};
const activeLevel = levels[config.logLevel] || levels.info;

const sensitiveKeyPattern = /(token|secret|password|passwd|pwd|authorization|cookie|webhook|api[_-]?key|private[_-]?key)/i;
const sensitiveUrlPattern = /(hook\/)[^/?#]+/i;

export function maskSensitiveValue(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(sensitiveUrlPattern, "$1***")
    .replace(/(Authorization:\s*Bearer\s+)[A-Za-z0-9._-]+/gi, "$1***")
    .replace(/(token=)[^&\s]+/gi, "$1***")
    .replace(/(api[_-]?key=)[^&\s]+/gi, "$1***");
}

export function sanitizeMeta(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 6) return "[对象层级过深]";
  if (value instanceof Error) return formatError(value);
  if (typeof value === "string") return maskSensitiveValue(value);
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeMeta(item, depth + 1));

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) && typeof item === "string" ? "***" : sanitizeMeta(item, depth + 1)
    ])
  );
}

export function formatError(error) {
  if (!error) return undefined;
  if (!(error instanceof Error)) {
    return { message: maskSensitiveValue(String(error)) };
  }
  return sanitizeMeta({
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    cause: error.cause instanceof Error ? formatError(error.cause) : error.cause
  });
}

const write = (level, message, meta) => {
  if ((levels[level] || levels.info) < activeLevel) return;
  const line = {
    time: new Date().toISOString(),
    level,
    levelName: levelNames[level] || level,
    message,
    ...(meta ? { meta: sanitizeMeta(meta) } : {})
  };
  console.log(JSON.stringify(line));
};

export const logger = {
  debug: (message, meta) => write("debug", message, meta),
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta)
};

import { config } from "./config.js";

const levels = { debug: 10, info: 20, warn: 30, error: 40 };
const activeLevel = levels[config.logLevel] || levels.info;

const write = (level, message, meta) => {
  if ((levels[level] || levels.info) < activeLevel) return;
  const line = {
    time: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {})
  };
  console.log(JSON.stringify(line));
};

export const logger = {
  debug: (message, meta) => write("debug", message, meta),
  info: (message, meta) => write("info", message, meta),
  warn: (message, meta) => write("warn", message, meta),
  error: (message, meta) => write("error", message, meta)
};

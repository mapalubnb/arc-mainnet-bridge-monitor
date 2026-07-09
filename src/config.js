import "dotenv/config";

const numberFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

const boolFromEnv = (name, fallback = false) => {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const listFromEnv = (name) =>
  (process.env[name] || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const config = {
  feishuWebhookUrl: process.env.FEISHU_WEBHOOK_URL || "",
  pollRpcMs: numberFromEnv("POLL_RPC_MS", 1000),
  pollDocsMs: numberFromEnv("POLL_DOCS_MS", 2000),
  pollNoxaMs: numberFromEnv("POLL_NOXA_MS", 3000),
  pollNpmMs: numberFromEnv("POLL_NPM_MS", 15000),
  httpTimeoutMs: numberFromEnv("HTTP_TIMEOUT_MS", 6000),
  arcTestnetChainId: String(process.env.ARC_TESTNET_CHAIN_ID || "5042002").toLowerCase(),
  logLevel: process.env.LOG_LEVEL || "info",
  sendStartupMessage: boolFromEnv("SEND_STARTUP_MESSAGE", true),
  enableTestAlert: boolFromEnv("ENABLE_TEST_ALERT", false),
  extraRpcUrls: listFromEnv("EXTRA_RPC_URLS"),
  stateDir: "state",
  docs: {
    supportedBlockchains: "https://docs.arc.io/app-kit/references/supported-blockchains.md",
    contractAddresses: "https://docs.arc.io/arc/references/contract-addresses.md",
    bridge: "https://docs.arc.io/app-kit/bridge.md",
    bridgeQuickstart: "https://docs.arc.io/app-kit/quickstarts/bridge-tokens-across-blockchains.md",
    arcLlms: "https://docs.arc.io/llms.txt",
    circleLlms: "https://developers.circle.com/llms.txt"
  },
  noxaLaunchUrl: "https://fun.noxa.fi/arc/launch",
  npmPackages: ["@circle-fin/bridge-kit", "@circle-fin/app-kit"],
  knownRpcUrls: ["https://rpc.testnet.arc.network"]
};

export const severityMeta = {
  P0: { label: "P0 极高优先级", color: "red", emoji: "🚨" },
  P1: { label: "P1 高优先级", color: "orange", emoji: "⚡" },
  P2: { label: "P2 重要信号", color: "yellow", emoji: "🔎" },
  P3: { label: "P3 普通变化", color: "blue", emoji: "ℹ️" }
};

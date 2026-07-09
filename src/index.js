import fs from "node:fs";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { StateStore } from "./stateStore.js";
import { FeishuAlert } from "./alerts/feishu.js";
import { scheduleTask } from "./utils/scheduler.js";
import { bridgeSupportMonitor } from "./monitors/bridgeSupportMonitor.js";
import { contractAddressMonitor } from "./monitors/contractAddressMonitor.js";
import { docsMonitor } from "./monitors/docsMonitor.js";
import { noxaMonitor } from "./monitors/noxaMonitor.js";
import { npmPackageMonitor } from "./monitors/npmPackageMonitor.js";
import { rpcProbeMonitor } from "./monitors/rpcProbeMonitor.js";

fs.mkdirSync("logs", { recursive: true });

const state = new StateStore();
const alert = new FeishuAlert(config.feishuWebhookUrl);
const context = { state, alert };

async function main() {
  logger.info("Arc 主网桥接监控启动", {
    pollRpcMs: config.pollRpcMs,
    pollDocsMs: config.pollDocsMs,
    pollNoxaMs: config.pollNoxaMs,
    pollNpmMs: config.pollNpmMs
  });

  if (config.sendStartupMessage && state.shouldAlert(`startup:${new Date().toISOString().slice(0, 10)}`)) {
    await alert.send({
      severity: "P3",
      title: "Arc 主网桥接监控已启动",
      source: "本地监控进程",
      matched: `RPC ${config.pollRpcMs}ms；官方文档 ${config.pollDocsMs}ms；Noxa ${config.pollNoxaMs}ms；npm ${config.pollNpmMs}ms。`,
      action: "监控将自动推送 Arc 主网、官方桥、合约地址、Noxa 发射台和 SDK 变化。"
    });
  }

  if (config.enableTestAlert) {
    await alert.send({
      severity: "P3",
      title: "飞书测试卡片",
      source: "ENABLE_TEST_ALERT",
      matched: "这是一条测试消息，用于验证飞书机器人卡片显示。",
      action: "如已收到，说明 webhook 与卡片格式正常。"
    });
  }

  scheduleTask("rpcProbeMonitor", config.pollRpcMs, () => rpcProbeMonitor(context));
  scheduleTask("bridgeSupportMonitor", config.pollDocsMs, () => bridgeSupportMonitor(context));
  scheduleTask("contractAddressMonitor", config.pollDocsMs, () => contractAddressMonitor(context));
  scheduleTask("docsMonitor", Math.max(config.pollDocsMs * 2, 5000), () => docsMonitor(context));
  scheduleTask("noxaMonitor", config.pollNoxaMs, () => noxaMonitor(context));
  scheduleTask("npmPackageMonitor", config.pollNpmMs, () => npmPackageMonitor(context));
}

process.on("unhandledRejection", (error) => {
  logger.error("未处理 Promise 异常", { error: error?.message || String(error) });
});

process.on("uncaughtException", (error) => {
  logger.error("未捕获异常", { error: error?.message || String(error), stack: error?.stack });
});

main().catch((error) => {
  logger.error("启动失败", { error: error.message });
  process.exitCode = 1;
});

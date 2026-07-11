import fs from "node:fs";
import { config } from "./config.js";
import { formatError, logger } from "./logger.js";
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
  logger.info("Arc 主网上线与官方桥监控启动", {
    serviceName: "arc-mainnet-bridge-monitor",
    pollRpcMs: config.pollRpcMs,
    pollDocsMs: config.pollDocsMs,
    pollNoxaMs: config.pollNoxaMs,
    pollNpmMs: config.pollNpmMs,
    httpTimeoutMs: config.httpTimeoutMs,
    logHeartbeatMs: config.logHeartbeatMs,
    arcTestnetChainId: config.arcTestnetChainId,
    extraRpcCount: config.extraRpcUrls.length,
    feishuWebhookConfigured: Boolean(config.feishuWebhookUrl)
  });

  if (config.sendStartupMessage && state.shouldAlert(`startup:${new Date().toISOString().slice(0, 10)}`)) {
    logger.info("发送启动通知卡片", {
      channel: "飞书 Feishu",
      reason: "SEND_STARTUP_MESSAGE=true"
    });
    await alert.send({
      severity: "P3",
      title: "Arc 主网桥接监控已启动",
      source: "本地监控进程 Local Monitor",
      matched: `RPC ${config.pollRpcMs}ms；官方文档 ${config.pollDocsMs}ms；Noxa ${config.pollNoxaMs}ms；npm ${config.pollNpmMs}ms。`,
      action: "监控将自动推送 Arc 主网、官方桥、合约地址、Noxa 发射台和 SDK 变化。"
    });
  }

  if (config.enableTestAlert) {
    logger.info("发送飞书测试卡片", {
      channel: "飞书 Feishu",
      reason: "ENABLE_TEST_ALERT=true"
    });
    await alert.send({
      severity: "P3",
      title: "飞书测试卡片",
      source: "ENABLE_TEST_ALERT",
      matched: "这是一条测试消息，用于验证飞书机器人卡片显示。",
      action: "如已收到，说明 webhook 与卡片格式正常。"
    });
  }

  const stopTasks = [];
  stopTasks.push(scheduleTask("RPC 探测 RpcProbeMonitor", config.pollRpcMs, () => rpcProbeMonitor(context)));
  stopTasks.push(scheduleTask("官方桥支持 BridgeSupportMonitor", config.pollDocsMs, () => bridgeSupportMonitor(context)));
  stopTasks.push(scheduleTask("合约地址 ContractAddressMonitor", config.pollDocsMs, () => contractAddressMonitor(context)));
  stopTasks.push(scheduleTask("官方文档 DocsMonitor", Math.max(config.pollDocsMs * 2, 30000), () => docsMonitor(context)));
  stopTasks.push(scheduleTask("Noxa 发射台 NoxaMonitor", config.pollNoxaMs, () => noxaMonitor(context)));
  stopTasks.push(scheduleTask("npm SDK NpmPackageMonitor", config.pollNpmMs, () => npmPackageMonitor(context)));
  const shutdown = () => { stopTasks.forEach((stop) => stop()); state.close(); process.exit(0); };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

process.on("unhandledRejection", (error) => {
  logger.error("未处理 Promise 异常 Unhandled Rejection", {
    error: formatError(error)
  });
});

process.on("uncaughtException", (error) => {
  logger.error("未捕获异常 Uncaught Exception", {
    error: formatError(error)
  });
});

main().catch((error) => {
  logger.error("服务启动失败", {
    error: formatError(error)
  });
  process.exitCode = 1;
});

import { config } from "../config.js";
import { logger } from "../logger.js";
import { fetchText } from "../utils/http.js";
import { sha256 } from "../utils/hash.js";
import { compact, extractArcRpcUrls, hasMainnetArc } from "../utils/text.js";

function extractMainnetSection(markdown) {
  const match = markdown.match(/### Mainnet([\s\S]*?)(### Testnet|$)/i);
  return match ? match[1] : "";
}

function arcBridgeSupported(section) {
  const lines = section.split("\n").filter((line) => /Arc/i.test(line));
  return lines.find((line) => /Arc/i.test(line) && /✅/.test(line) && /Bridge|✅\s*\|/.test(line));
}

export async function bridgeSupportMonitor({ state, alert }) {
  const url = config.docs.supportedBlockchains;
  logger.debug("开始检查官方桥支持列表 App Kit supported blockchains", { url });

  const { text } = await fetchText(url);
  const hash = sha256(text);
  const oldHash = state.getHash("supported-blockchains");

  if (!oldHash) {
    state.setHash("supported-blockchains", hash);
    logger.info("已建立官方桥支持列表基线", {
      monitor: "BridgeSupportMonitor",
      hash,
      url
    });
  }

  if (oldHash && oldHash !== hash && state.shouldAlert(`docs-change:${url}:${hash}`)) {
    logger.info("官方桥支持列表发生变化，准备推送 P3 告警", {
      oldHash,
      newHash: hash,
      url
    });
    await alert.send({
      severity: "P3",
      title: "官方桥支持列表发生变化",
      source: "Arc Docs / supported-blockchains",
      matched: "supported-blockchains.md 内容 hash 变化，请检查 Mainnet 表格是否新增 Arc。",
      action: "打开文档核验 Arc 是否进入 Mainnet Bridge 支持列表。",
      url
    });
    state.setHash("supported-blockchains", hash);
  }

  const mainnetSection = extractMainnetSection(text);
  const supportedLine = arcBridgeSupported(mainnetSection);
  const mainnetMention = hasMainnetArc(mainnetSection);
  const rpcUrls = extractArcRpcUrls(text);

  if (rpcUrls.length) {
    state.addDiscoveredRpcUrls(rpcUrls);
    logger.info("从官方桥支持列表发现 Arc RPC 候选地址", {
      count: rpcUrls.length,
      rpcUrls
    });
  }

  if ((supportedLine || mainnetMention) && state.shouldAlert(`bridge-mainnet-support:${sha256(supportedLine || mainnetSection)}`)) {
    logger.warn("官方桥支持列表出现 Arc Mainnet 相关信号", {
      supportedLine: supportedLine || null,
      mainnetMention
    });
    await alert.send({
      severity: supportedLine ? "P1" : "P2",
      title: supportedLine ? "Arc Mainnet 疑似进入官方桥支持列表" : "官方桥文档出现 Arc Mainnet 信号",
      source: "Arc Docs / App Kit supported blockchains",
      matched: compact(supportedLine || mainnetSection, 600),
      action: supportedLine
        ? "优先核验 Bridge 列是否为可用状态；随后用小额 USDC 做测试桥接。"
        : "继续等待合约地址与 Bridge Kit 可用信号，不要仅凭关键词大额跨链。",
      url
    });
  }

  logger.debug("官方桥支持列表检查完成", {
    hash,
    hasMainnetSection: Boolean(mainnetSection),
    mainnetMention,
    supported: Boolean(supportedLine)
  });
}

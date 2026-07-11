import { config } from "../config.js";
import { logger } from "../logger.js";
import { fetchText } from "../utils/http.js";
import { sha256 } from "../utils/hash.js";
import { compact, extractArcRpcUrls, hasMainnetArc } from "../utils/text.js";

const docEntries = [
  ["bridge-doc", config.docs.bridge, "App Kit Bridge 文档"],
  ["bridge-quickstart", config.docs.bridgeQuickstart, "Bridge Quickstart 文档"],
  ["arc-llms", config.docs.arcLlms, "Arc 文档索引"],
  ["circle-llms", config.docs.circleLlms, "Circle 文档索引"],
  ["cctp-chains", config.docs.cctpChains, "CCTP 支持链与域"],
  ["cctp-contracts", config.docs.cctpContracts, "CCTP 合约地址"],
  ["gateway-chains", config.docs.gatewayChains, "Gateway 支持链"]
];

export async function docsMonitor({ state, alert }) {
  logger.debug("开始检查官方文档集合 DocsMonitor", {
    documentCount: docEntries.length
  });

  for (const [key, url, label] of docEntries) {
    logger.debug("开始检查官方文档", { key, label, url });
    const { text } = await fetchText(url);
    const hash = sha256(text);
    const oldHash = state.getHash(key);

    if (!oldHash) {
      state.setHash(key, hash);
      logger.info("已建立官方文档基线", {
        key,
        label,
        hash,
        url
      });
    } else if (oldHash !== hash && state.shouldAlert(`doc-change:${key}:${hash}`)) {
      logger.info("官方文档发生变化，准备推送 P3 告警", {
        key,
        label,
        oldHash,
        newHash: hash,
        url
      });
      await alert.send({
        severity: "P3",
        title: `${label}发生变化`,
        source: label,
        matched: `${url} 内容 hash 变化。`,
        action: "检查是否新增 Arc Mainnet、CCTP、Bridge、USDC 主网支持信息。",
        url
      });
      state.setHash(key, hash);
    }

    const rpcUrls = extractArcRpcUrls(text);
    if (rpcUrls.length) {
      state.addDiscoveredRpcUrls(rpcUrls);
      logger.info("从官方文档发现 Arc RPC 候选地址", {
        key,
        label,
        count: rpcUrls.length,
        rpcUrls
      });
    }

    const mainnetMatches = text.match(/.{0,80}(Arc[_\s-]?Mainnet|Arc[\s\S]{0,40}mainnet|mainnet[\s\S]{0,40}Arc|CCTP|Gateway).{0,160}/gi) || [];
    const testnetOnly = /currently available on Testnet only/i.test(text);
    if (hasMainnetArc(text) && !testnetOnly && state.shouldAlert(`doc-mainnet-signal:${key}:${sha256(mainnetMatches.join("\n"))}`)) {
      logger.warn("官方文档出现 Arc Mainnet 信号", {
        key,
        label,
        matchCount: mainnetMatches.length
      });
      await alert.send({
        severity: "P2",
        title: `${label}出现 Arc Mainnet 信号`,
        confidence: /cctp|gateway/.test(key) ? "官方桥证据" : "待交叉确认",
        source: label,
        matched: compact(mainnetMatches.slice(0, 5).join("\n"), 700),
        action: "与官方桥支持列表、合约地址页、RPC 探测结果交叉确认。",
        url
      });
    }

    logger.debug("官方文档检查完成", {
      key,
      label,
      hash,
      rpcUrlCount: rpcUrls.length,
      mainnetMatchCount: mainnetMatches.length
    });
  }
}

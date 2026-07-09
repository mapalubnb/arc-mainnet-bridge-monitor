import { config } from "../config.js";
import { fetchText } from "../utils/http.js";
import { sha256 } from "../utils/hash.js";
import { compact, extractArcRpcUrls, hasMainnetArc } from "../utils/text.js";

const docEntries = [
  ["bridge-doc", config.docs.bridge, "App Kit Bridge 文档"],
  ["bridge-quickstart", config.docs.bridgeQuickstart, "Bridge Quickstart 文档"],
  ["arc-llms", config.docs.arcLlms, "Arc 文档索引"],
  ["circle-llms", config.docs.circleLlms, "Circle 文档索引"]
];

export async function docsMonitor({ state, alert }) {
  for (const [key, url, label] of docEntries) {
    const { text } = await fetchText(url);
    const hash = sha256(text);
    const oldHash = state.getHash(key);
    if (!oldHash) {
      state.setHash(key, hash);
    } else if (oldHash !== hash && state.shouldAlert(`doc-change:${key}:${hash}`)) {
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
    if (rpcUrls.length) state.addDiscoveredRpcUrls(rpcUrls);

    const mainnetMatches = text.match(/.{0,80}(Arc[_\s-]?Mainnet|Arc[\s\S]{0,40}mainnet|mainnet[\s\S]{0,40}Arc|CCTP|Gateway).{0,160}/gi) || [];
    if (hasMainnetArc(text) && state.shouldAlert(`doc-mainnet-signal:${key}:${sha256(mainnetMatches.join("\n"))}`)) {
      await alert.send({
        severity: "P2",
        title: `${label}出现 Arc Mainnet 信号`,
        source: label,
        matched: compact(mainnetMatches.slice(0, 5).join("\n"), 700),
        action: "与官方桥支持列表、合约地址页、RPC 探测结果交叉确认。",
        url
      });
    }
  }
}

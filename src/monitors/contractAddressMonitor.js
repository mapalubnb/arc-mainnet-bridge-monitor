import { config } from "../config.js";
import { fetchText } from "../utils/http.js";
import { sha256 } from "../utils/hash.js";
import { compact, extractArcRpcUrls, extractEthAddresses, hasMainnetArc } from "../utils/text.js";

const unavailableText = /Mainnet addresses are not\s+yet available/i;

export async function contractAddressMonitor({ state, alert }) {
  const url = config.docs.contractAddresses;
  const { text } = await fetchText(url);
  const hash = sha256(text);
  const oldHash = state.getHash("contract-addresses");
  if (!oldHash) state.setHash("contract-addresses", hash);

  if (oldHash && oldHash !== hash && state.shouldAlert(`contract-doc-change:${hash}`)) {
    await alert.send({
      severity: "P3",
      title: "官方合约地址文档发生变化",
      source: "Arc Docs / contract-addresses",
      matched: "contract-addresses.md 内容 hash 变化。",
      action: "重点检查是否新增 Mainnet、USDC、CCTP、Gateway、TokenMessenger、MessageTransmitter 地址。",
      url
    });
    state.setHash("contract-addresses", hash);
  }

  const mainnetAvailable = !unavailableText.test(text) && hasMainnetArc(text);
  const keywords = text.match(/(TokenMessenger|MessageTransmitter|Gateway|CCTP|USDC|Mainnet)[\s\S]{0,240}/gi) || [];
  const addresses = extractEthAddresses(text);
  const rpcUrls = extractArcRpcUrls(text);
  if (rpcUrls.length) state.addDiscoveredRpcUrls(rpcUrls);

  if (mainnetAvailable && state.shouldAlert(`mainnet-contracts:${sha256(keywords.join("\n") + addresses.join(","))}`)) {
    await alert.send({
      severity: "P1",
      title: "Arc 主网合约地址可能已经发布",
      source: "Arc Docs / contract-addresses",
      matched: compact([...keywords.slice(0, 8), `地址数量：${addresses.length}`].join("\n"), 700),
      action: "立即核验 USDC、CCTP、Gateway 地址，并与 Bridge Kit 支持状态交叉确认。",
      url
    });
  }
}

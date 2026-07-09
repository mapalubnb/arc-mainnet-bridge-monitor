import { config } from "../config.js";
import { rpcCall } from "../utils/http.js";
import { sha256 } from "../utils/hash.js";
import { logger } from "../logger.js";

const normalizeChainId = (chainId) => {
  if (typeof chainId === "number") return String(chainId);
  if (typeof chainId === "string" && chainId.startsWith("0x")) return String(Number.parseInt(chainId, 16));
  return String(chainId || "");
};

export async function rpcProbeMonitor({ state, alert }) {
  const urls = Array.from(new Set([...config.knownRpcUrls, ...config.extraRpcUrls, ...state.getRpcUrls()]));

  for (const url of urls) {
    try {
      const [chainIdRaw, blockRaw] = await Promise.all([
        rpcCall(url, "eth_chainId"),
        rpcCall(url, "eth_blockNumber")
      ]);
      const chainId = normalizeChainId(chainIdRaw);
      const blockNumber = Number.parseInt(blockRaw, 16);
      const previous = state.state.rpc[url] || {};
      state.rememberRpc(url, { chainId, blockNumber });

      const isTestnet = chainId === config.arcTestnetChainId;
      const isGrowing = Number.isFinite(previous.blockNumber) && blockNumber > previous.blockNumber;

      if (!isTestnet && Number.isFinite(blockNumber) && state.shouldAlert(`rpc-non-testnet:${url}:${chainId}`)) {
        await alert.send({
          severity: "P0",
          title: "发现疑似 Arc 主网 RPC",
          source: "RPC 探测",
          matched: `RPC: ${url}\nChain ID: ${chainId}\n区块高度: ${blockNumber}\n区块增长: ${isGrowing ? "是" : "待确认"}`,
          action: "立即用官方文档、浏览器和桥支持列表交叉确认；确认后先小额 USDC 跨链。",
          url
        });
      }

      if (!isTestnet && isGrowing && state.shouldAlert(`rpc-growing:${url}:${chainId}:${blockNumber}`)) {
        await alert.send({
          severity: "P0",
          title: "疑似 Arc 主网 RPC 区块正在增长",
          source: "RPC 探测",
          matched: `RPC: ${url}\nChain ID: ${chainId}\n上一高度: ${previous.blockNumber}\n当前高度: ${blockNumber}`,
          action: "这是最高优先级信号。马上核验官方桥是否可用，并执行小额桥接测试。",
          url
        });
      }
    } catch (error) {
      logger.debug("RPC 探测失败", { url, error: error.message });
    }
  }
}

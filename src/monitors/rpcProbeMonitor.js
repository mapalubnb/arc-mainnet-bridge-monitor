import { config } from "../config.js";
import { formatError, logger } from "../logger.js";
import { rpcCall } from "../utils/http.js";

const rpcHeartbeatAt = new Map();
const growthConfirmations = new Map();

const normalizeChainId = (chainId) => {
  if (typeof chainId === "number") return String(chainId);
  if (typeof chainId === "string" && chainId.startsWith("0x")) return String(Number.parseInt(chainId, 16));
  return String(chainId || "");
};

export async function rpcProbeMonitor({ state, alert }) {
  const urls = Array.from(new Set([...config.knownRpcUrls, ...config.extraRpcUrls, ...state.getRpcUrls()]));
  logger.debug("开始执行 RPC 探测", {
    rpcCount: urls.length,
    testnetChainId: config.arcTestnetChainId,
    urls
  });

  for (const url of urls) {
    try {
      logger.debug("开始探测 RPC 节点", { rpcUrl: url });
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
      const growthCount = isGrowing ? (growthConfirmations.get(url) || 0) + 1 : 0;
      growthConfirmations.set(url, growthCount);

      logger.debug("RPC 探测成功", {
        rpcUrl: url,
        chainId,
        blockNumber,
        previousBlockNumber: previous.blockNumber ?? null,
        isTestnet,
        isGrowing
      });

      const now = Date.now();
      const lastHeartbeatAt = rpcHeartbeatAt.get(url) || 0;
      if (now - lastHeartbeatAt >= config.logHeartbeatMs) {
        rpcHeartbeatAt.set(url, now);
        logger.info("RPC 区块高度心跳", {
          rpcUrl: url,
          chainId,
          blockNumber,
          previousBlockNumber: previous.blockNumber ?? null,
          isTestnet,
          isGrowing
        });
      }

      if (!isTestnet && Number.isFinite(blockNumber) && state.shouldAlert(`rpc-non-testnet:${url}:${chainId}`)) {
        logger.error("发现非测试网 Chain ID，疑似 Arc 主网 RPC", {
          rpcUrl: url,
          chainId,
          blockNumber,
          isGrowing
        });
        await alert.send({
          severity: "P0",
          title: "发现 Arc 非测试网 RPC 候选",
          confidence: "待交叉确认",
          source: "RPC 探测 RpcProbe",
          matched: `RPC: ${url}\nChain ID: ${chainId}\n区块高度: ${blockNumber}\n区块增长: ${isGrowing ? "是" : "待确认"}`,
          action: "立即用官方文档、浏览器和桥支持列表交叉确认；确认后先小额 USDC 跨链。",
          url
        });
      }

      if (!isTestnet && growthCount >= 2 && state.shouldAlert(`rpc-growing:${url}:${chainId}`)) {
        logger.error("疑似 Arc 主网 RPC 区块正在增长", {
          rpcUrl: url,
          chainId,
          previousBlockNumber: previous.blockNumber,
          currentBlockNumber: blockNumber
        });
        await alert.send({
          severity: "P0",
          title: "疑似 Arc 主网 RPC 区块正在增长",
          confidence: "高度可信",
          facts: { "Chain ID": chainId, "当前区块": blockNumber, "连续增长": `${growthCount} 轮` },
          source: "RPC 探测 RpcProbe",
          matched: `RPC: ${url}\nChain ID: ${chainId}\n上一高度: ${previous.blockNumber}\n当前高度: ${blockNumber}`,
          action: "这是最高优先级信号。马上核验官方桥是否可用，并执行小额桥接测试。",
          url
        });
      }
    } catch (error) {
      logger.debug("RPC 节点探测失败，等待下一轮重试", {
        rpcUrl: url,
        error: formatError(error)
      });
    }
  }
}

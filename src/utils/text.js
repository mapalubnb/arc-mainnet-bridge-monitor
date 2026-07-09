export const compact = (text, max = 320) => {
  const normalized = String(text || "").replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
};

export const unique = (items) => Array.from(new Set(items.filter(Boolean)));

export const extractUrls = (text) => {
  const matches = String(text || "").match(/https?:\/\/[^\s)"'<>]+/g) || [];
  return unique(matches.map((url) => url.replace(/[.,;]+$/, "")));
};

export const extractArcRpcUrls = (text) =>
  extractUrls(text).filter((url) => /rpc/i.test(url) && /arc/i.test(url));

export const extractEthAddresses = (text) =>
  unique((String(text || "").match(/0x[a-fA-F0-9]{40}/g) || []).map((item) => item.toLowerCase()));

export const hasMainnetArc = (text) => /Arc[_\s-]?Mainnet|mainnet[\s\S]{0,80}Arc|Arc[\s\S]{0,80}mainnet/i.test(text || "");

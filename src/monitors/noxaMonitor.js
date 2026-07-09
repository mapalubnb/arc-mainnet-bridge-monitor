import { config } from "../config.js";
import { fetchText } from "../utils/http.js";
import { sha256 } from "../utils/hash.js";
import { compact, extractArcRpcUrls, extractEthAddresses, hasMainnetArc } from "../utils/text.js";

const assetUrl = (src) => new URL(src, config.noxaLaunchUrl).toString();

export async function noxaMonitor({ state, alert }) {
  const { text: html } = await fetchText(config.noxaLaunchUrl);
  const htmlHash = sha256(html);
  const oldHtmlHash = state.getHash("noxa-html");
  if (!oldHtmlHash) {
    state.setHash("noxa-html", htmlHash);
  } else if (oldHtmlHash !== htmlHash && state.shouldAlert(`noxa-html-change:${htmlHash}`)) {
    await alert.send({
      severity: "P3",
      title: "Noxa Arc 发射台页面发生变化",
      source: "Noxa Launch 页面",
      matched: "HTML 内容 hash 变化，可能更新了前端 bundle 或页面配置。",
      action: "检查是否新增 Arc Mainnet、launch 合约、router/factory 或 chainId。",
      url: config.noxaLaunchUrl
    });
    state.setHash("noxa-html", htmlHash);
  }

  const scripts = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi)).map((match) => assetUrl(match[1]));
  for (const scriptUrl of scripts) {
    const { text: js } = await fetchText(scriptUrl, { timeoutMs: Math.max(config.httpTimeoutMs, 12000) });
    const key = `noxa-js:${scriptUrl}`;
    const hash = sha256(js);
    const oldHash = state.getHash(key);
    if (!oldHash) {
      state.setHash(key, hash);
    } else if (oldHash !== hash && state.shouldAlert(`noxa-js-change:${scriptUrl}:${hash}`)) {
      await alert.send({
        severity: "P2",
        title: "Noxa 前端 Bundle 更新",
        source: "Noxa Launch JS bundle",
        matched: `Bundle: ${scriptUrl}\nHash 已变化。`,
        action: "马上搜索 Arc Mainnet、chainId、factory、router、launch 合约地址，确认是否可发射/交易。",
        url: config.noxaLaunchUrl
      });
      state.setHash(key, hash);
    }

    const rpcUrls = extractArcRpcUrls(js);
    if (rpcUrls.length) state.addDiscoveredRpcUrls(rpcUrls);

    const addresses = extractEthAddresses(js);
    const matches = js.match(/.{0,80}(Arc[_\s-]?Mainnet|arc-mainnet|mainnet[\s\S]{0,60}arc|arc[\s\S]{0,60}mainnet).{0,180}/gi) || [];
    if ((hasMainnetArc(js) || matches.length > 0) && state.shouldAlert(`noxa-mainnet-signal:${hash}`)) {
      await alert.send({
        severity: "P2",
        title: "Noxa 出现 Arc 主网相关信号",
        source: "Noxa Launch JS bundle",
        matched: compact([...matches.slice(0, 8), `疑似地址数量：${addresses.length}`].join("\n"), 800),
        action: "核验这些地址是否在 Arcscan 主网可查；确认前不要授权大额 USDC。",
        url: config.noxaLaunchUrl
      });
    }
  }
}

import { config } from "../config.js";
import { logger } from "../logger.js";
import { fetchText } from "../utils/http.js";
import { sha256 } from "../utils/hash.js";
import { compact, extractArcRpcUrls, extractEthAddresses, hasMainnetArc } from "../utils/text.js";

const assetUrl = (src) => new URL(src, config.noxaLaunchUrl).toString();

export async function noxaMonitor({ state, alert }) {
  logger.debug("开始检查 Noxa Arc 发射台", {
    url: config.noxaLaunchUrl
  });

  const { text: html } = await fetchText(config.noxaLaunchUrl);
  const htmlHash = sha256(html);
  const oldHtmlHash = state.getHash("noxa-html");
  const htmlChanged = Boolean(oldHtmlHash && oldHtmlHash !== htmlHash);

  if (!oldHtmlHash) {
    state.setHash("noxa-html", htmlHash);
    logger.info("已建立 Noxa 发射台页面基线", {
      hash: htmlHash,
      url: config.noxaLaunchUrl
    });
  } else if (oldHtmlHash !== htmlHash && state.shouldAlert(`noxa-html-change:${htmlHash}`)) {
    logger.info("Noxa 发射台页面发生变化，准备推送 P3 告警", {
      oldHash: oldHtmlHash,
      newHash: htmlHash,
      url: config.noxaLaunchUrl
    });
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

  const launchOrigin = new URL(config.noxaLaunchUrl).origin;
  const scripts = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+\.js[^"']*)["']/gi))
    .map((match) => assetUrl(match[1]))
    .filter((url) => new URL(url).origin === launchOrigin);
  logger.debug("Noxa 页面脚本解析完成", {
    scriptCount: scripts.length,
    scripts
  });

  if (!htmlChanged && oldHtmlHash) {
    logger.debug("Noxa 页面未变化，跳过 bundle 深度扫描", { htmlHash });
    return;
  }

  for (const scriptUrl of scripts) {
    logger.debug("开始检查 Noxa 前端 Bundle", { scriptUrl });
    const { text: js } = await fetchText(scriptUrl, { timeoutMs: Math.max(config.httpTimeoutMs, 12000) });
    const key = `noxa-js:${scriptUrl}`;
    const hash = sha256(js);
    const oldHash = state.getHash(key);

    if (!oldHash) {
      state.setHash(key, hash);
      logger.info("已建立 Noxa 前端 Bundle 基线", {
        scriptUrl,
        hash
      });
    } else if (oldHash !== hash && state.shouldAlert(`noxa-js-change:${scriptUrl}:${hash}`)) {
      logger.warn("Noxa 前端 Bundle 发生变化，准备推送 P2 告警", {
        scriptUrl,
        oldHash,
        newHash: hash
      });
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
    if (rpcUrls.length) {
      state.addDiscoveredRpcUrls(rpcUrls);
      logger.info("从 Noxa Bundle 发现 Arc RPC 候选地址", {
        scriptUrl,
        count: rpcUrls.length,
        rpcUrls
      });
    }

    const addresses = extractEthAddresses(js);
    const matches = js.match(/.{0,80}(Arc[_\s-]?Mainnet|arc-mainnet|mainnet[\s\S]{0,60}arc|arc[\s\S]{0,60}mainnet).{0,180}/gi) || [];
    if ((hasMainnetArc(js) || matches.length > 0) && state.shouldAlert(`noxa-mainnet-signal:${hash}`)) {
      logger.warn("Noxa Bundle 出现 Arc 主网相关信号", {
        scriptUrl,
        matchCount: matches.length,
        addressCount: addresses.length
      });
      await alert.send({
        severity: "P2",
        title: "Noxa 出现 Arc 主网相关信号",
        source: "Noxa Launch JS bundle",
        matched: compact([...matches.slice(0, 8), `疑似地址数量：${addresses.length}`].join("\n"), 800),
        action: "核验这些地址是否在 Arcscan 主网可查；确认前不要授权大额 USDC。",
        url: config.noxaLaunchUrl
      });
    }

    logger.debug("Noxa 前端 Bundle 检查完成", {
      scriptUrl,
      hash,
      rpcUrlCount: rpcUrls.length,
      addressCount: addresses.length,
      mainnetMatchCount: matches.length
    });
  }
}

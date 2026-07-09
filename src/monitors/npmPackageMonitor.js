import { config } from "../config.js";
import { fetchJson, fetchText } from "../utils/http.js";
import { sha256 } from "../utils/hash.js";
import { compact, hasMainnetArc } from "../utils/text.js";
import { logger } from "../logger.js";

const registryUrl = (name) => `https://registry.npmjs.org/${encodeURIComponent(name)}`;

export async function npmPackageMonitor({ state, alert }) {
  for (const pkg of config.npmPackages) {
    const url = registryUrl(pkg);
    const { json } = await fetchJson(url);
    const latest = json["dist-tags"]?.latest;
    if (!latest) continue;

    const oldVersion = state.getNpmVersion(pkg);
    if (!oldVersion) {
      state.setNpmVersion(pkg, latest);
    } else if (oldVersion !== latest && state.shouldAlert(`npm-version:${pkg}:${latest}`)) {
      await alert.send({
        severity: "P2",
        title: "Circle 桥接 SDK 发布新版本",
        source: `npm / ${pkg}`,
        matched: `${pkg}: ${oldVersion} → ${latest}`,
        action: "检查新版本是否加入 Arc Mainnet、CCTP domain、Bridge route 或合约地址。",
        url: `https://www.npmjs.com/package/${pkg}`
      });
      state.setNpmVersion(pkg, latest);
    }

    const latestMeta = json.versions?.[latest];
    const tarball = latestMeta?.dist?.tarball;
    const serializedMeta = JSON.stringify(latestMeta || {});
    if (hasMainnetArc(serializedMeta) && state.shouldAlert(`npm-meta-arc-mainnet:${pkg}:${latest}`)) {
      await alert.send({
        severity: "P2",
        title: "Circle SDK 元信息出现 Arc Mainnet 信号",
        source: `npm / ${pkg}`,
        matched: compact(serializedMeta.match(/.{0,80}Arc.{0,160}/gi)?.slice(0, 4).join("\n") || serializedMeta, 700),
        action: "优先尝试 Bridge Kit route/quote 是否支持 Arc Mainnet。",
        url: `https://www.npmjs.com/package/${pkg}/v/${latest}`
      });
    }

    if (tarball) {
      try {
        const { text } = await fetchText(tarball, {
          headers: { accept: "application/octet-stream,*/*" },
          timeoutMs: Math.min(config.httpTimeoutMs, 5000)
        });
        const sample = text.slice(0, 900000);
        if (hasMainnetArc(sample) && state.shouldAlert(`npm-tarball-arc-mainnet:${pkg}:${latest}:${sha256(sample)}`)) {
          await alert.send({
            severity: "P2",
            title: "Circle SDK 包内容出现 Arc Mainnet 信号",
            source: `npm tarball / ${pkg}`,
            matched: compact(sample.match(/.{0,80}Arc.{0,180}/gi)?.slice(0, 6).join("\n") || "包内容匹配 Arc Mainnet 关键词。", 700),
            action: "马上进行小额 Bridge Kit 可用性测试，确认是否能从 Base/Arbitrum/Ethereum 跨到 Arc。",
            url: `https://www.npmjs.com/package/${pkg}/v/${latest}`
          });
        }
      } catch (error) {
        logger.debug("npm tarball 检查失败", { pkg, error: error.message });
      }
    }
  }
}

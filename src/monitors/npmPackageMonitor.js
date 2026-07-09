import { config } from "../config.js";
import { formatError, logger } from "../logger.js";
import { fetchJson, fetchText } from "../utils/http.js";
import { sha256 } from "../utils/hash.js";
import { compact, hasMainnetArc } from "../utils/text.js";

const registryUrl = (name) => `https://registry.npmjs.org/${encodeURIComponent(name)}`;

export async function npmPackageMonitor({ state, alert }) {
  logger.debug("开始检查 Circle npm SDK 包", {
    packageCount: config.npmPackages.length,
    packages: config.npmPackages
  });

  for (const pkg of config.npmPackages) {
    const url = registryUrl(pkg);
    logger.debug("开始检查 npm 包元信息", { packageName: pkg, url });

    const { json } = await fetchJson(url);
    const latest = json["dist-tags"]?.latest;
    if (!latest) {
      logger.warn("npm 包未找到 latest 版本标签", {
        packageName: pkg,
        url
      });
      continue;
    }

    const oldVersion = state.getNpmVersion(pkg);
    if (!oldVersion) {
      state.setNpmVersion(pkg, latest);
      logger.info("已建立 npm SDK 版本基线", {
        packageName: pkg,
        latest
      });
    } else if (oldVersion !== latest && state.shouldAlert(`npm-version:${pkg}:${latest}`)) {
      logger.warn("Circle 桥接 SDK 发布新版本", {
        packageName: pkg,
        oldVersion,
        latest
      });
      await alert.send({
        severity: "P2",
        title: "Circle 桥接 SDK 发布新版本",
        source: `npm / ${pkg}`,
        matched: `${pkg}: ${oldVersion} -> ${latest}`,
        action: "检查新版本是否加入 Arc Mainnet、CCTP domain、Bridge route 或合约地址。",
        url: `https://www.npmjs.com/package/${pkg}`
      });
      state.setNpmVersion(pkg, latest);
    }

    const latestMeta = json.versions?.[latest];
    const tarball = latestMeta?.dist?.tarball;
    const serializedMeta = JSON.stringify(latestMeta || {});

    if (hasMainnetArc(serializedMeta) && state.shouldAlert(`npm-meta-arc-mainnet:${pkg}:${latest}`)) {
      logger.warn("Circle SDK 元信息出现 Arc Mainnet 信号", {
        packageName: pkg,
        latest
      });
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
        logger.debug("开始抽样检查 npm tarball 内容", {
          packageName: pkg,
          latest,
          tarball
        });
        const { text } = await fetchText(tarball, {
          headers: { accept: "application/octet-stream,*/*" },
          timeoutMs: Math.min(config.httpTimeoutMs, 5000)
        });
        const sample = text.slice(0, 900000);
        if (hasMainnetArc(sample) && state.shouldAlert(`npm-tarball-arc-mainnet:${pkg}:${latest}:${sha256(sample)}`)) {
          logger.warn("Circle SDK 包内容出现 Arc Mainnet 信号", {
            packageName: pkg,
            latest,
            sampleBytes: Buffer.byteLength(sample, "utf8")
          });
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
        logger.debug("npm tarball 抽样检查失败，不影响下一轮监控", {
          packageName: pkg,
          latest,
          error: formatError(error)
        });
      }
    }

    logger.debug("npm 包检查完成", {
      packageName: pkg,
      latest,
      oldVersion: oldVersion || null,
      hasTarball: Boolean(tarball)
    });
  }
}

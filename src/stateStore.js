import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";
import { formatError, logger } from "./logger.js";

const statePath = path.join(config.stateDir, "state.json");

const initialState = {
  hashes: {},
  alerts: {},
  npmVersions: {},
  rpc: {},
  discoveredRpcUrls: []
};

export class StateStore {
  constructor() {
    fs.mkdirSync(config.stateDir, { recursive: true });
    this.state = this.load();
    logger.info("状态存储初始化完成", {
      statePath,
      hashCount: Object.keys(this.state.hashes || {}).length,
      alertCount: Object.keys(this.state.alerts || {}).length,
      discoveredRpcCount: (this.state.discoveredRpcUrls || []).length
    });
  }

  load() {
    if (!fs.existsSync(statePath)) {
      logger.info("状态文件不存在，将创建新状态", { statePath });
      return { ...initialState };
    }
    try {
      return { ...initialState, ...JSON.parse(fs.readFileSync(statePath, "utf8")) };
    } catch (error) {
      logger.warn("状态文件读取失败，将使用空状态继续运行", {
        statePath,
        error: formatError(error)
      });
      return { ...initialState };
    }
  }

  save() {
    const tempPath = `${statePath}.tmp`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2));
      fs.renameSync(tempPath, statePath);
    } catch (error) {
      logger.error("状态文件保存失败", {
        statePath,
        tempPath,
        error: formatError(error)
      });
      throw error;
    }
  }

  getHash(key) {
    return this.state.hashes[key];
  }

  setHash(key, hash) {
    this.state.hashes[key] = hash;
    this.save();
  }

  shouldAlert(key) {
    if (this.state.alerts[key]) {
      logger.debug("告警去重命中，跳过重复推送", {
        alertKey: key,
        firstTriggeredAt: this.state.alerts[key]
      });
      return false;
    }
    this.state.alerts[key] = new Date().toISOString();
    this.save();
    return true;
  }

  getNpmVersion(name) {
    return this.state.npmVersions[name];
  }

  setNpmVersion(name, version) {
    this.state.npmVersions[name] = version;
    this.save();
  }

  rememberRpc(url, data) {
    this.state.rpc[url] = { ...(this.state.rpc[url] || {}), ...data, updatedAt: new Date().toISOString() };
    this.save();
  }

  addDiscoveredRpcUrls(urls) {
    const beforeCount = (this.state.discoveredRpcUrls || []).length;
    const next = new Set([...(this.state.discoveredRpcUrls || []), ...urls]);
    this.state.discoveredRpcUrls = Array.from(next);
    this.save();
    const afterCount = this.state.discoveredRpcUrls.length;
    if (afterCount > beforeCount) {
      logger.info("新增 RPC 候选地址已写入状态", {
        addedCount: afterCount - beforeCount,
        totalCount: afterCount
      });
    }
  }

  getRpcUrls() {
    return this.state.discoveredRpcUrls || [];
  }
}

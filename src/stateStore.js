import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

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
  }

  load() {
    if (!fs.existsSync(statePath)) return { ...initialState };
    try {
      return { ...initialState, ...JSON.parse(fs.readFileSync(statePath, "utf8")) };
    } catch {
      return { ...initialState };
    }
  }

  save() {
    const tempPath = `${statePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(this.state, null, 2));
    fs.renameSync(tempPath, statePath);
  }

  getHash(key) {
    return this.state.hashes[key];
  }

  setHash(key, hash) {
    this.state.hashes[key] = hash;
    this.save();
  }

  shouldAlert(key) {
    if (this.state.alerts[key]) return false;
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
    const next = new Set([...(this.state.discoveredRpcUrls || []), ...urls]);
    this.state.discoveredRpcUrls = Array.from(next);
    this.save();
  }

  getRpcUrls() {
    return this.state.discoveredRpcUrls || [];
  }
}

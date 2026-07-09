# ARC 主网上线监控 🚨

给自己用的 Arc 主网 / 官方桥 / Noxa 发射台监控脚本。  
跑在 Ubuntu + PM2，发现关键变化后用飞书机器人推送中文卡片。

## 监控什么 👀

| 模块 | 看什么 | 频率 |
| --- | --- | --- |
| RPC | 主网 Chain ID、区块增长 | 1 秒 |
| 官方桥 | Arc Mainnet 是否进入 Bridge 支持 | 2 秒 |
| 合约地址 | USDC / CCTP / Gateway 主网地址 | 2 秒 |
| Noxa | 发射台页面和 JS bundle 变化 | 3 秒 |
| SDK | Circle Bridge Kit / App Kit 更新 | 15 秒 |

## 告警等级 🔔

| 等级 | 意思 |
| --- | --- |
| `P0` | 疑似主网 RPC 可用了，马上看 |
| `P1` | 官方桥或主网合约地址出现了 |
| `P2` | Noxa / SDK / 文档出现重要信号 |
| `P3` | 普通变化，扫一眼 |

## 部署 🚀

```bash
git clone https://github.com/mapalubnb/arc-mainnet-bridge-monitor.git
cd arc-mainnet-bridge-monitor
npm install
cp .env.example .env
nano .env
```

`.env` 里填飞书机器人：

```env
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-token
```

启动：

```bash
npm run check
pm2 start ecosystem.config.cjs
pm2 save
```

看状态：

```bash
pm2 status
pm2 logs arc-mainnet-bridge-monitor
```

## 更新 🔄

```bash
cd ~/arc-mainnet-bridge-monitor
git pull
npm install
npm run check
pm2 restart arc-mainnet-bridge-monitor
pm2 save
```

如果只是 README 更新，不用重启。

## 常用命令 🧰

```bash
# 看日志
pm2 logs arc-mainnet-bridge-monitor

# 重启
pm2 restart arc-mainnet-bridge-monitor

# 停止
pm2 stop arc-mainnet-bridge-monitor

# 删除 PM2 进程
pm2 delete arc-mainnet-bridge-monitor
```

## 配置 ⚙️

```env
POLL_RPC_MS=1000
POLL_DOCS_MS=2000
POLL_NOXA_MS=3000
POLL_NPM_MS=15000
ARC_TESTNET_CHAIN_ID=5042002
EXTRA_RPC_URLS=
```

如果后面官方公布主网 RPC，直接加：

```env
EXTRA_RPC_URLS=https://rpc.mainnet.arc.network,https://rpc.arc.network
```

然后：

```bash
pm2 restart arc-mainnet-bridge-monitor
```

## 我的操作原则 🧠

- 收到 `P0/P1` 后先小额 USDC 试桥。
- 不要第一笔就大额跨链。
- 发射台授权只用小钱包。
- 只信官方文档、官方桥、官方合约地址和可验证的浏览器结果。
- 飞书 webhook 只放 `.env`，别提交到 GitHub。

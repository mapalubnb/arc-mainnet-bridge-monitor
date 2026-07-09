# Arc 主网桥接监控

用于秒级监控 Arc 主网上线、官方桥接支持、Circle SDK 变化、Noxa 发射台变化，并通过飞书机器人发送中文交互卡片。

## 监控范围

- Arc 官方 App Kit 支持列表：是否在 Mainnet 表格出现 Arc / Bridge 支持。
- Arc 官方合约地址页：是否发布主网 USDC、CCTP、Gateway 等地址。
- Circle Bridge Kit / App Kit npm 包：版本变化和 Arc Mainnet 关键词。
- Arc RPC：对已知和自动发现的 RPC 执行 `eth_chainId`、`eth_blockNumber` 秒级探测。
- Noxa Arc 发射台：页面和 JS bundle hash 变化、主网关键词、合约地址线索。

## 报警等级

- `P0`：疑似 Arc 主网 RPC 可用，且区块可能增长。
- `P1`：官方桥 Mainnet 支持或主网合约地址出现。
- `P2`：Noxa、SDK、文档出现 Arc Mainnet 重要信号。
- `P3`：普通文档、页面或 bundle 变化。

## 安装

```bash
git clone git@github.com:mapalubnb/arc-mainnet-bridge-monitor.git
cd arc-mainnet-bridge-monitor
npm install
cp .env.example .env
nano .env
```

`.env` 至少配置：

```env
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-token
```

## 本地运行

```bash
npm run check
npm start
```

首次启动会发送一条中文飞书卡片，说明进程已开始监控。

## PM2 部署

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
pm2 logs arc-mainnet-bridge-monitor
```

Ubuntu 开机自启：

```bash
pm2 startup systemd
```

按命令输出执行一次 `sudo env ... pm2 startup ...`，然后：

```bash
pm2 save
```

## 常用配置

```env
POLL_RPC_MS=1000
POLL_DOCS_MS=2000
POLL_NOXA_MS=3000
POLL_NPM_MS=15000
HTTP_TIMEOUT_MS=6000
ARC_TESTNET_CHAIN_ID=5042002
EXTRA_RPC_URLS=
```

主网 RPC 发布后，可以把候选地址加入：

```env
EXTRA_RPC_URLS=https://rpc.mainnet.arc.network,https://rpc.arc.network
```

## 安全建议

- 收到 P0/P1 报警后，先用小额 USDC 试桥，不要直接大额跨链。
- 只信任官方文档、官方 App Kit、官方合约地址和可验证的 Arcscan 结果。
- 发射台授权前先检查合约地址、额度和是否能卖出。

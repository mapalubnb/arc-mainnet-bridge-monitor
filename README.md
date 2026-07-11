# ARC 主网与跨链桥监控

低资源常驻监控 Arc 主网上线、官方 RPC、CCTP/Gateway/App Kit 桥接支持与关键合约地址，发现有效信号后用飞书机器人推送中文交互卡片。

当前官方状态以 `https://docs.arc.io/llms.txt` 为准。监控不会把普通页面改版直接判定为主网上线，高优先级结论需要官方来源或多个信号交叉确认。

## 监控什么 👀

| 模块 | 看什么 | 频率 |
| --- | --- | --- |
| RPC | Chain ID、连续区块增长 | 2 秒 |
| 官方桥与合约 | Arc、CCTP、Gateway、App Kit 正式支持 | 15 秒 |
| 官方文档集合 | 主网状态、域、RPC、网络配置 | 30 秒 |
| Noxa | 页面变化后才扫描同源 JS bundle | 30 秒 |
| SDK | Circle Bridge Kit / App Kit 版本变化 | 60 秒 |

HTTP 请求会使用 ETag/Last-Modified 条件缓存；npm tarball 仅在版本升级时下载；状态文件采用合并写入并自动清理过期告警。

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
POLL_RPC_MS=2000
POLL_DOCS_MS=15000
POLL_NOXA_MS=30000
POLL_NPM_MS=60000
HTTP_MAX_BYTES=2097152
STATE_FLUSH_MS=1000
ALERT_RETENTION_DAYS=30
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

## 信号等级

- `P0`：候选非测试网 RPC，或连续多轮出块；仍需用官方文档和浏览器核验。
- `P1`：官方桥支持或主网合约地址出现。
- `P2`：CCTP/Gateway/App Kit/SDK 出现重要主网线索。
- `P3`：普通来源内容变化，不代表主网已上线。

## 操作原则

- 收到 `P0/P1` 后先小额 USDC 试桥。
- 不要第一笔就大额跨链。
- 发射台授权只用小钱包。
- 只信官方文档、官方桥、官方合约地址和可验证的浏览器结果。
- 飞书 webhook 只放 `.env`，别提交到 GitHub。

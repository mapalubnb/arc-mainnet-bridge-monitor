# Arc 主网桥接监控

一个面向 MEME 交易者的 Arc 主网上线与官方桥接监控脚本。  
它会高频检查 Arc 官方文档、Circle Bridge/App Kit、RPC、Noxa 发射台等信号，并通过飞书机器人发送中文卡片告警，帮助你第一时间发现主网和跨链入口。

## 功能概览

| 模块 | 监控内容 | 默认频率 |
| --- | --- | --- |
| RPC 探测 | `eth_chainId`、`eth_blockNumber`、非测试网 Chain ID、区块增长 | 1 秒 |
| 官方桥支持 | App Kit supported blockchains 是否出现 Arc Mainnet / Bridge 支持 | 2 秒 |
| 合约地址 | USDC、CCTP、Gateway、TokenMessenger、MessageTransmitter 主网地址 | 2 秒 |
| 官方文档 | Arc / Circle 文档 hash 变化与 Mainnet 关键词 | 5 秒 |
| Noxa 发射台 | 页面和 JS bundle 更新、Arc Mainnet 关键词、疑似合约地址 | 3 秒 |
| npm SDK | `@circle-fin/bridge-kit`、`@circle-fin/app-kit` 版本变化 | 15 秒 |

## 告警等级

| 等级 | 含义 | 建议动作 |
| --- | --- | --- |
| `P0` | 疑似 Arc 主网 RPC 可用，或区块开始增长 | 立即人工核验，准备小额 USDC 试桥 |
| `P1` | 官方桥 Mainnet 支持或主网合约地址出现 | 核验官方来源，测试 Bridge Kit / App Kit |
| `P2` | Noxa、SDK、文档出现 Arc Mainnet 重要信号 | 关注发射台和合约部署，但不要直接大额授权 |
| `P3` | 普通页面、文档或 bundle 变化 | 打开来源检查是否有隐藏更新 |

## 目录结构

```text
arc-mainnet-bridge-monitor/
  ecosystem.config.cjs       # PM2 配置
  package.json
  .env.example
  src/
    index.js                 # 程序入口
    config.js                # 配置读取
    stateStore.js            # 状态与去重
    alerts/
      feishu.js              # 飞书卡片推送
    monitors/
      bridgeSupportMonitor.js
      contractAddressMonitor.js
      docsMonitor.js
      noxaMonitor.js
      npmPackageMonitor.js
      rpcProbeMonitor.js
    utils/
      http.js
      scheduler.js
      hash.js
      text.js
```

## 服务器准备

推荐环境：

```text
Ubuntu Server 24.04 LTS 64bit
Node.js 20+
npm
pm2
git
```

如果服务器还没有 Node.js，可用 NodeSource 安装：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v
npm -v
```

安装 PM2：

```bash
sudo npm install -g pm2
pm2 -v
```

## 拉取项目

如果服务器已经配置 GitHub SSH key：

```bash
git clone git@github.com:mapalubnb/arc-mainnet-bridge-monitor.git
cd arc-mainnet-bridge-monitor
```

如果遇到：

```text
Permission denied (publickey)
```

说明服务器的 SSH 公钥还没有添加到 GitHub。生成并查看公钥：

```bash
ssh-keygen -t ed25519 -C "ubuntu-arc-monitor" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

把输出的整行添加到 GitHub：

```text
GitHub -> Settings -> SSH and GPG keys -> New SSH key
```

测试：

```bash
ssh -T git@github.com
```

成功后重新 clone。

## 安装与配置

```bash
npm install
cp .env.example .env
nano .env
```

`.env` 至少配置飞书机器人：

```env
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-token
```

常用配置：

```env
POLL_RPC_MS=1000
POLL_DOCS_MS=2000
POLL_NOXA_MS=3000
POLL_NPM_MS=15000
HTTP_TIMEOUT_MS=6000
ARC_TESTNET_CHAIN_ID=5042002
LOG_LEVEL=info
SEND_STARTUP_MESSAGE=true
ENABLE_TEST_ALERT=false
EXTRA_RPC_URLS=
```

如果官方发布 Arc 主网 RPC，可以追加到 `EXTRA_RPC_URLS`：

```env
EXTRA_RPC_URLS=https://rpc.mainnet.arc.network,https://rpc.arc.network
```

## 本地验证

先做语法检查：

```bash
npm run check
```

前台试运行：

```bash
npm start
```

看到日志持续输出，并收到飞书启动卡片，说明配置正常。

## PM2 部署

启动：

```bash
pm2 start ecosystem.config.cjs
```

查看状态：

```bash
pm2 status
```

查看日志：

```bash
pm2 logs arc-mainnet-bridge-monitor
```

保存 PM2 进程：

```bash
pm2 save
```

设置开机自启：

```bash
pm2 startup systemd
```

PM2 会输出一行 `sudo env ... pm2 startup ...` 命令，复制执行。然后再次保存：

```bash
pm2 save
```

## 如何更新

进入项目目录：

```bash
cd ~/arc-mainnet-bridge-monitor
```

拉取最新代码：

```bash
git pull
```

如果 `package-lock.json` 或依赖有变化，重新安装依赖：

```bash
npm install
```

检查代码：

```bash
npm run check
```

重启 PM2：

```bash
pm2 restart arc-mainnet-bridge-monitor
```

查看是否正常：

```bash
pm2 status
pm2 logs arc-mainnet-bridge-monitor --lines 100
```

保存当前 PM2 配置：

```bash
pm2 save
```

## 常用运维命令

```bash
# 查看状态
pm2 status

# 查看实时日志
pm2 logs arc-mainnet-bridge-monitor

# 重启
pm2 restart arc-mainnet-bridge-monitor

# 停止
pm2 stop arc-mainnet-bridge-monitor

# 删除 PM2 进程
pm2 delete arc-mainnet-bridge-monitor

# 查看最近 100 行日志
pm2 logs arc-mainnet-bridge-monitor --lines 100
```

## 回滚版本

查看提交记录：

```bash
git log --oneline -5
```

回滚到指定提交：

```bash
git checkout <commit_hash>
npm install
npm run check
pm2 restart arc-mainnet-bridge-monitor
```

如果要回到最新主分支：

```bash
git checkout main
git pull
npm install
pm2 restart arc-mainnet-bridge-monitor
```

## 飞书卡片说明

飞书推送会包含：

- 事件等级
- 事件标题
- 监控来源
- 命中内容
- 建议动作
- 北京时间
- 来源链接按钮

建议把机器人加入一个专门的“Arc 主网监控”群，避免重要告警被普通聊天刷掉。

## 安全建议

- 收到 `P0` / `P1` 后，先用小额 USDC 测试桥接，不要直接大额跨链。
- 只信任官方文档、官方 App Kit、官方合约地址和可验证的 Arcscan 结果。
- 不要在发射台上授权无限额度，至少在早期使用小额热钱包。
- 主网刚上线时，RPC、浏览器、桥和前端都可能不稳定，优先确认到账和可卖出路径。
- 飞书 webhook 属于敏感信息，只写在服务器 `.env`，不要提交到 GitHub。

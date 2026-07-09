import { severityMeta } from "../config.js";
import { logger } from "../logger.js";
import { compact } from "../utils/text.js";

const clean = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "  \n");

export class FeishuAlert {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
  }

  async send(event) {
    if (!this.webhookUrl) {
      logger.warn("未配置飞书 Webhook，跳过推送", { title: event.title });
      return;
    }

    const meta = severityMeta[event.severity] || severityMeta.P3;
    const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
    const fields = [
      ["事件等级", `${meta.emoji} ${meta.label}`],
      ["监控来源", event.source || "未知"],
      ["命中内容", compact(event.matched || "暂无", 520)],
      ["建议动作", event.action || "请打开来源链接核验，确认后再执行资金操作。"],
      ["北京时间", now]
    ];

    const elements = [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: fields.map(([key, value]) => `**${key}：** ${clean(value)}`).join("\n")
        }
      }
    ];

    if (event.url) {
      elements.push({
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "打开来源" },
            type: "primary",
            url: event.url
          }
        ]
      });
    }

    const payload = {
      msg_type: "interactive",
      card: {
        config: { wide_screen_mode: true },
        header: {
          template: meta.color,
          title: { tag: "plain_text", content: `${meta.emoji} ${event.title}` }
        },
        elements
      }
    };

    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`飞书推送失败 HTTP ${response.status}: ${body}`);
    }
    logger.info("飞书推送成功", { title: event.title, severity: event.severity });
  }
}

import { severityMeta } from "../config.js";
import { formatError, logger, maskSensitiveValue } from "../logger.js";
import { compact } from "../utils/text.js";

const clean = (value) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "  \n");

export class FeishuAlert {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
  }

  buildPayload(event) {
    const meta = severityMeta[event.severity] || severityMeta.P3;
    const now = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
    const facts = Object.entries(event.facts || {}).slice(0, 6);

    const elements = [
      { tag: "div", fields: [
        { is_short: true, text: { tag: "lark_md", content: `**等级**\n${meta.emoji} ${meta.label}` } },
        { is_short: true, text: { tag: "lark_md", content: `**可信度**\n${clean(event.confidence || "线索")}` } },
        { is_short: true, text: { tag: "lark_md", content: `**来源**\n${clean(event.source || "未知")}` } },
        { is_short: true, text: { tag: "lark_md", content: `**时间**\n${now}` } }
      ] },
      { tag: "hr" },
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**信号摘要**\n${clean(compact(event.matched || "暂无", 420))}`
        }
      },
      ...(facts.length ? [{ tag: "div", text: { tag: "lark_md", content: `**关键数据**\n${facts.map(([k,v]) => `• ${clean(k)}：${clean(v)}`).join("\n")}` } }] : []),
      { tag: "note", elements: [{ tag: "plain_text", content: `建议：${compact(event.action || "打开来源核验后再执行资金操作。", 260)}` }] }
    ];

    if (event.url) {
      elements.push({
        tag: "action",
        actions: [
          {
            tag: "button",
            text: { tag: "plain_text", content: "查看官方来源" },
            type: "primary",
            url: event.url
          }
        ]
      });
    }

    return {
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
  }

  async send(event) {
    if (!this.webhookUrl) {
      logger.warn("未配置飞书 Webhook，跳过推送", {
        title: event.title,
        severity: event.severity
      });
      return;
    }
    const payload = this.buildPayload(event);

    logger.info("准备发送飞书告警卡片", {
      title: event.title,
      severity: event.severity,
      source: event.source,
      hasSourceUrl: Boolean(event.url),
      webhookUrl: maskSensitiveValue(this.webhookUrl)
    });

    try {
      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`飞书推送失败 HTTP ${response.status}: ${body.slice(0, 300)}`);
      }
      logger.info("飞书告警卡片发送成功", {
        title: event.title,
        severity: event.severity,
        status: response.status
      });
    } catch (error) {
      logger.error("飞书告警卡片发送失败", {
        title: event.title,
        severity: event.severity,
        error: formatError(error)
      });
      throw error;
    }
  }
}

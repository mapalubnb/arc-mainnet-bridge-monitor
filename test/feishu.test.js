import assert from "node:assert/strict";
import test from "node:test";
import { FeishuAlert } from "../src/alerts/feishu.js";

test("飞书卡片包含等级、可信度、关键数据和来源按钮", () => {
  const payload = new FeishuAlert("").buildPayload({
    severity: "P0", title: "主网信号", confidence: "高度可信", source: "官方 RPC",
    matched: "连续出块", action: "交叉核验", facts: { "Chain ID": "123", "当前区块": 456 },
    url: "https://example.com"
  });
  const card = JSON.stringify(payload);
  assert.equal(payload.msg_type, "interactive");
  assert.match(card, /高度可信/);
  assert.match(card, /Chain ID/);
  assert.match(card, /查看官方来源/);
});

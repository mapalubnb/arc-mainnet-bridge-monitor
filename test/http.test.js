import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { fetchText } from "../src/utils/http.js";

test("HTTP 条件缓存复用 304 响应", async (t) => {
  let requests = 0;
  const server = http.createServer((request, response) => {
    requests += 1;
    if (request.headers["if-none-match"] === '"v1"') { response.writeHead(304); response.end(); return; }
    response.writeHead(200, { etag: '"v1"' }); response.end("arc-mainnet");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/status`;
  const first = await fetchText(url);
  const second = await fetchText(url);
  assert.equal(first.text, "arc-mainnet");
  assert.equal(second.text, first.text);
  assert.equal(second.notModified, true);
  assert.equal(requests, 2);
});

test("HTTP 响应超过上限时中止", async (t) => {
  const server = http.createServer((_request, response) => response.end("0123456789"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/large`;
  await assert.rejects(() => fetchText(url, { maxBytes: 5 }), /响应体超过限制/);
});

/**
 * src/index.ts
 * bsaf-kikikuru-bot エントリポイント
 *
 * Hono でヘルスチェックエンドポイントを提供しつつ、
 * バックグラウンドで大雨警戒レベル情報をポーリング・投稿する。
 */

import { Hono } from "hono";
import { startPoller } from "./poller";
import { ping } from "./atproto/client";

const app = new Hono();
const START_TIME = new Date().toISOString();

// ============================================================
// ヘルスチェック
// ============================================================

app.get("/", (c) => c.text("bsaf-kikikuru-bot is running 🌧️"));

app.get("/health", async (c) => {
  const atpOk = await ping();
  const status = atpOk ? 200 : 503;
  return c.json(
    {
      status:    atpOk ? "ok" : "degraded",
      atproto:   atpOk ? "connected" : "error",
      startedAt: START_TIME,
      uptime:    Math.floor((Date.now() - new Date(START_TIME).getTime()) / 1000),
    },
    status
  );
});

// ============================================================
// 起動
// ============================================================

const PORT = Number(process.env["PORT"] ?? 3000);

console.info("=".repeat(50));
console.info("  bsaf-kikikuru-bot");
console.info("  @bsaf-kikikuru-bot.bsky.social");
console.info("  大雨警戒レベル情報 Lv2〜Lv5 BSAF配信");
console.info("=".repeat(50));

// ポーリング開始
startPoller();

// HTTP サーバー起動
export default {
  port:  PORT,
  fetch: app.fetch,
};

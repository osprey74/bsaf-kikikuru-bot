/**
 * src/poller.ts
 * Atom Feed ポーリングループ
 *
 * 10分ごとに気象庁フィードをポーリングし、
 * 新着の大雨警戒レベル電文をBSAFタグ付きでBlueskyに投稿する。
 */

import { fetchTargetEntries, fetchText } from "./feeds/atomFeed";
import {
  parseHeavyRainWarningXml,
  hasAnyActiveWarning,
} from "./parsers/heavyRainWarning";
import { mapToBsafPosts } from "./bsaf/mapper";
import { isAlreadyPosted, markPosted, clearExpired } from "./state/warningState";
import { post as atpPost } from "./atproto/client";

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10分（プロフィール記載・気象庁負荷配慮）

/** セッション内処理済みエントリID（重複処理防止） */
const _processedIds = new Set<string>();

// ============================================================
// 1サイクルの処理
// ============================================================

async function runCycle(): Promise<void> {
  clearExpired();

  let entries;
  try {
    entries = await fetchTargetEntries();
  } catch (e) {
    console.error("[Poller] Feed取得失敗:", e);
    return;
  }

  const newEntries = entries.filter((e) => !_processedIds.has(e.id));
  console.info(`[Poller] 新着: ${newEntries.length}件 / 取得: ${entries.length}件`);

  for (const entry of newEntries) {
    _processedIds.add(entry.id);

    // 電文 XML 取得
    let xml: string;
    try {
      xml = await fetchText(entry.link);
    } catch (e) {
      console.error(`[Poller] 電文取得失敗 ${entry.id}:`, e);
      continue;
    }

    // パース
    const parsed = parseHeavyRainWarningXml(xml);
    if (!parsed) continue;

    // 投稿判定:
    //   - 取消電文                → 投稿（解除）
    //   - Lv2〜Lv5 発表中           → 投稿
    //   - 部分解除（cancelledAreas）→ 投稿
    //   - それ以外                 → スキップ
    const isCancellation = parsed.infoType === "取消";
    const hasActive      = hasAnyActiveWarning(parsed);
    const hasCancelled   = parsed.cancelledAreas.length > 0;

    if (!isCancellation && !hasActive && !hasCancelled) {
      console.info(`[Poller] スキップ（発表なし）: ${entry.id}`);
      continue;
    }

    // BSAFポスト生成・投稿
    const posts = mapToBsafPosts(parsed);
    if (posts.length === 0) {
      console.info(`[Poller] 生成ポストなし: ${entry.id}`);
      continue;
    }

    for (const p of posts) {
      if (isAlreadyPosted(p.dedupeKey)) {
        console.info(`[Poller] 重複スキップ: ${p.dedupeKey}`);
        continue;
      }
      try {
        await atpPost(p.text, p.tags);
        markPosted(p.dedupeKey);
        console.info(`[Poller] 投稿: ${p.dedupeKey}`);
      } catch (e) {
        console.error(`[Poller] 投稿失敗: ${p.dedupeKey}`, e);
        // 投稿失敗時は markPosted しない → 次サイクルで再試行
      }
    }
  }

  // 処理済みID を直近 300 件に制限
  if (_processedIds.size > 300) {
    const stale = [..._processedIds].slice(0, _processedIds.size - 300);
    stale.forEach((id) => _processedIds.delete(id));
  }
}

// ============================================================
// 起動
// ============================================================

export function startPoller(): void {
  const target = ["VPWW55", "VPWW56", "VPWW57", "VPWW58"].join(", ");
  console.info(`[Poller] 開始 — 対象: ${target}`);
  console.info(`[Poller] 間隔: ${POLL_INTERVAL_MS / 1000}秒`);
  console.info("[Poller] ※Lv1（早期注意情報）は対象外（VPWP50で別途対応要）");

  // 初回即時実行
  runCycle().catch(console.error);

  // 定期実行
  setInterval(() => runCycle().catch(console.error), POLL_INTERVAL_MS);
}

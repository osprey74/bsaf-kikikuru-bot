/**
 * src/poller.ts
 * Atom Feed ポーリングループ
 *
 * 10 分ごとに気象庁フィードをポーリングし、新着の VPWW55〜61
 * （気象警報・注意報Ｒ０６）電文を BSAF タグ付きで Bluesky に投稿する。
 */

import { fetchTargetEntries, fetchText, extractCode, isFloodCode } from "./feeds/atomFeed";
import { parseR06WarningXml } from "./parsers/r06Warning";
import { mapToBsafPosts } from "./bsaf/r06Mapper";
import { parseFloodForecastXml } from "./parsers/floodForecast";
import { mapFloodToBsafPosts } from "./bsaf/floodMapper";
import { parseBosaiReportXml } from "./parsers/bosaiReport";
import { mapBosaiToBsafPosts } from "./bsaf/bosaiMapper";
import { parseTyphoonXml } from "./parsers/typhoon";
import { mapTyphoonToBsafPosts } from "./bsaf/typhoonMapper";
import type { BsafPost } from "./bsaf/r06Mapper";
import { isAlreadyPosted, markPosted, clearExpired } from "./state/warningState";
import { post as atpPost } from "./atproto/client";

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 分（プロフィール記載・気象庁負荷配慮）

/** セッション内処理済みエントリ ID（重複処理防止） */
const _processedIds = new Set<string>();

// ============================================================
// 1 サイクルの処理
// ============================================================

async function runCycle(): Promise<void> {
  clearExpired();

  let entries;
  try {
    entries = await fetchTargetEntries();
  } catch (e) {
    console.error("[Poller] Feed 取得失敗:", e);
    return;
  }

  const newEntries = entries.filter((e) => !_processedIds.has(e.id));
  console.info(`[Poller] 新着: ${newEntries.length}件 / 取得: ${entries.length}件`);

  for (const entry of newEntries) {
    _processedIds.add(entry.id);

    let xml: string;
    try {
      xml = await fetchText(entry.link);
    } catch (e) {
      console.error(`[Poller] 電文取得失敗 ${entry.id}:`, e);
      continue;
    }

    // 電文コードで洪水（VXKO）・防災速報（VPBS50）・気象警報（VPWW55-61）を振り分ける
    const code = extractCode(entry.id);
    let posts: BsafPost[];
    if (isFloodCode(code)) {
      const parsed = parseFloodForecastXml(xml);
      if (!parsed) continue;
      posts = mapFloodToBsafPosts(parsed);
    } else if (code === "VPBS50") {
      const parsed = parseBosaiReportXml(xml);
      if (!parsed) continue;
      posts = mapBosaiToBsafPosts(parsed);
    } else if (code === "VPTW60") {
      const parsed = parseTyphoonXml(xml);
      if (!parsed) continue;
      posts = mapTyphoonToBsafPosts(parsed);
    } else {
      const parsed = parseR06WarningXml(xml);
      if (!parsed) continue;
      posts = mapToBsafPosts(parsed);
    }

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

  // 処理済み ID を直近 300 件に制限
  if (_processedIds.size > 300) {
    const stale = [..._processedIds].slice(0, _processedIds.size - 300);
    stale.forEach((id) => _processedIds.delete(id));
  }
}

// ============================================================
// 起動
// ============================================================

export function startPoller(): void {
  const target = ["VPWW55", "VPWW56", "VPWW57", "VPWW58", "VPWW59", "VPWW60", "VPWW61", "VXKO(指定河川洪水予報)", "VPBS50(気象防災速報)", "VPTW60(台風情報)"].join(", ");
  console.info(`[Poller] 開始 — 対象: ${target}`);
  console.info(`[Poller] 間隔: ${POLL_INTERVAL_MS / 1000}秒`);
  console.info("[Poller] 新気象警報・注意報（Ｒ０６）＋指定河川洪水予報＋気象防災速報＋台風情報 — 全現象配信モード");

  // 初回即時実行
  runCycle().catch(console.error);

  // 定期実行
  setInterval(() => runCycle().catch(console.error), POLL_INTERVAL_MS);
}

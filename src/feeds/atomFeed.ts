/**
 * src/feeds/atomFeed.ts
 * 気象庁防災情報XML Atom Feed 取得・パース
 *
 * フィード URL: https://www.data.jma.go.jp/developer/xml/feed/extra.xml
 *   └ 警報系（VPWW55〜61）は高頻度フィード(extra.xml)に含まれる
 *
 * 出典: https://www.data.jma.go.jp/developer/xml/
 *
 * 注意: 旧 URL `xml.kishou.go.jp` は Fly.io 環境から 403 を返す（2026-05 確認）。
 *       www.data.jma.go.jp 配下の現行 URL を使用すること。
 */

import { XMLParser } from "fast-xml-parser";

// ============================================================
// 型定義
// ============================================================

export interface AtomEntry {
  /** 電文ファイル名を含む ID  例: 20260528120000_0_VPWW55_010000.xml */
  id: string;
  /** 電文 XML の取得 URL */
  link: string;
  /** 更新日時 ISO8601 */
  updated: string;
  /** エントリタイトル */
  title: string;
}

// ============================================================
// 対象電文コード
// ============================================================

/**
 * 新気象警報・注意報（Ｒ０６）VPWW55〜61 を全件監視する。
 * 旧 VPWW54 / VXWW50 / VPNO50 は bsaf-jma-bot 側の経過措置パーサーで処理する。
 */
export const TARGET_CODES = new Set([
  "VPWW55", // 気象警報・注意報（Ｒ０６）（大雨）
  "VPWW56", // 気象警報・注意報（Ｒ０６）（土砂）
  "VPWW57", // 気象警報・注意報（Ｒ０６）（高潮）
  "VPWW58", // 気象警報・注意報（Ｒ０６）（暴風）
  "VPWW59", // 気象警報・注意報（Ｒ０６）（波浪）
  "VPWW60", // 気象警報・注意報（Ｒ０６）（大雪）
  "VPWW61", // 気象警報・注意報（Ｒ０６）（その他注意報）
]);

export const FEED_URL = "https://www.data.jma.go.jp/developer/xml/feed/extra.xml";

/** 気象庁サーバ向けの最低限の User-Agent（無設定だと弾かれることがある） */
const USER_AGENT = "bsaf-kikikuru-bot/0.1.0 (+https://github.com/osprey74/bsaf-kikikuru-bot)";

// ============================================================
// パーサー
// ============================================================

const atomParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "entry",
  parseTagValue: false,
  trimValues: true,
});

export function parseAtomFeed(xmlStr: string): AtomEntry[] {
  let raw: any;
  try {
    raw = atomParser.parse(xmlStr);
  } catch (e) {
    console.error("[Feed] Atom Feed パースエラー:", e);
    return [];
  }

  const entries: any[] = raw?.feed?.entry ?? [];
  return entries.map((e: any) => ({
    id:      String(e.id ?? ""),
    link:    String(e.link?.["@_href"] ?? e.link ?? ""),
    updated: String(e.updated ?? ""),
    title:   String(e.title ?? ""),
  }));
}

/** ファイル名からデータ種類コードを抽出する */
export function extractCode(id: string): string {
  // 例: 20260528120000_0_VPWW55_010000.xml → "VPWW55"
  return id.match(/_([A-Z0-9]{6})_/)?.[1] ?? "";
}

// ============================================================
// HTTP 取得
// ============================================================

const FETCH_TIMEOUT_MS = 10_000;

export async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal:  controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * フィードを取得し、対象電文エントリのみ返す
 */
export async function fetchTargetEntries(): Promise<AtomEntry[]> {
  const feedXml = await fetchText(FEED_URL);
  const all = parseAtomFeed(feedXml);
  return all.filter((e) => TARGET_CODES.has(extractCode(e.id)));
}

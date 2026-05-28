/**
 * src/bsaf/mapper.ts
 * ParsedHeavyRainWarning → BSAFポスト（投稿テキスト + tags文字列配列）
 *
 * 1投稿 = 1都道府県 × 1警報種別 × 1警戒レベル を基本単位とする。
 * 重複検知キー (type+value+time+target) を厳密に1値で揃えるため、
 * target にカンマ区切り複数値は使用しない。
 */

import type {
  ParsedHeavyRainWarning,
  WarningArea,
  WarningType,
  WarningLevel,
} from "../parsers/heavyRainWarning";
import { prefectureFromMunicipalityCode, type Prefecture } from "./prefectures";

// ============================================================
// 型定義
// ============================================================

export interface BsafPost {
  /** 投稿本文 */
  text: string;
  /** AT Protocol `tags` フィールドに渡す BSAF タグ配列 */
  tags: string[];
  /** 重複抑制キー（warningType:prefectureTarget:value） */
  dedupeKey: string;
}

// ============================================================
// ラベル定義
// ============================================================

const TYPE_LABEL: Record<WarningType, string> = {
  "heavy-rain":  "大雨",
  "landslide":   "土砂災害",
  "storm-surge": "高潮",
  "flood":       "洪水・氾濫",
};

const LEVEL_HEADER: Record<WarningLevel, string> = {
  level2: "⚪ 注意報（Lv.2）",
  level3: "🟡 警報（Lv.3）",
  level4: "⚠️ 危険警報（Lv.4）",
  level5: "🚨 特別警報（Lv.5）",
};

const LEVEL_TIPS: Partial<Record<WarningLevel, string>> = {
  level4: "⚠️ 危険な場所からの避難を",
  level5: "⚠️ 命を守る行動を！",
};

const SOURCE_LINE = "出典: 気象庁 https://www.jma.go.jp/bosai/risk/";

// ============================================================
// ユーティリティ
// ============================================================

/** ReportDateTime（ISO8601 with TZ）を UTC ISO8601 (`Z`) に正規化する */
function toUtcIso(isoLocal: string): string {
  if (!isoLocal) return "";
  const d = new Date(isoLocal);
  return isNaN(d.getTime()) ? isoLocal : d.toISOString();
}

/** 市町村名を最大 max 件まで列挙し残数を併記 */
function formatAreaList(areas: WarningArea[], max = 8): string {
  const names = areas.slice(0, max).map((a) => a.name);
  const rest = areas.length > max ? `、ほか${areas.length - max}市町村` : "";
  return names.join("、") + rest;
}

/** エリアを都道府県別にグルーピング（未知の都道府県コードは無視） */
function groupByPrefecture(areas: WarningArea[]): Map<string, {
  prefecture: Prefecture;
  areas: WarningArea[];
}> {
  const groups = new Map<string, {
    prefecture: Prefecture;
    areas: WarningArea[];
  }>();
  for (const area of areas) {
    const pref = prefectureFromMunicipalityCode(area.code);
    if (!pref) {
      console.warn(`[Mapper] 未知の市町村コード: ${area.code} (${area.name})`);
      continue;
    }
    const g = groups.get(pref.code);
    if (g) {
      g.areas.push(area);
    } else {
      groups.set(pref.code, { prefecture: pref, areas: [area] });
    }
  }
  return groups;
}

// ============================================================
// BSAFタグ配列生成
// ============================================================

function buildTags(args: {
  warningType: WarningType;
  value: string;        // "level2" .. "level5" | "cancelled"
  timeUtc: string;
  target: string;
}): string[] {
  return [
    "bsaf:v1",
    `type:${args.warningType}-warning`,
    `value:${args.value}`,
    `time:${args.timeUtc}`,
    `target:${args.target}`,
    "source:jma",
  ];
}

// ============================================================
// 1ブロック分（同一都道府県・同一レベル）の投稿生成
// ============================================================

function buildActivePost(args: {
  parsed: ParsedHeavyRainWarning;
  level: WarningLevel;
  prefecture: Prefecture;
  areas: WarningArea[];
  timeUtc: string;
}): BsafPost {
  const { parsed, level, prefecture, areas, timeUtc } = args;
  const typeLabel = TYPE_LABEL[parsed.warningType];
  const header    = LEVEL_HEADER[level];
  const tips      = LEVEL_TIPS[level];

  // 投稿本文（市町村粒度の詳細はここに列挙）
  const headSnippet = parsed.headlineText.length > 80
    ? parsed.headlineText.slice(0, 80) + "…"
    : parsed.headlineText;

  const lines: string[] = [
    `${header} ${typeLabel}`,
    `${prefecture.name}：${formatAreaList(areas)}`,
  ];
  if (headSnippet) lines.push(headSnippet);
  if (parsed.editorialOffice) lines.push(`発表: ${parsed.editorialOffice}`);
  if (tips) lines.push(tips);
  lines.push(SOURCE_LINE);

  const tags = buildTags({
    warningType: parsed.warningType,
    value:       level,
    timeUtc,
    target:      prefecture.target,
  });

  return {
    text: lines.join("\n"),
    tags,
    dedupeKey: `${parsed.warningType}:${prefecture.target}:${level}`,
  };
}

function buildCancelledPost(args: {
  parsed: ParsedHeavyRainWarning;
  prefecture: Prefecture;
  areas: WarningArea[];
  timeUtc: string;
}): BsafPost {
  const { parsed, prefecture, areas, timeUtc } = args;
  const typeLabel = TYPE_LABEL[parsed.warningType];

  const lines: string[] = [
    `⬇️ ${typeLabel} 解除`,
    `${prefecture.name}：${formatAreaList(areas)}`,
  ];
  if (parsed.editorialOffice) lines.push(`発表: ${parsed.editorialOffice}`);
  lines.push(SOURCE_LINE);

  const tags = buildTags({
    warningType: parsed.warningType,
    value:       "cancelled",
    timeUtc,
    target:      prefecture.target,
  });

  return {
    text: lines.join("\n"),
    tags,
    dedupeKey: `${parsed.warningType}:${prefecture.target}:cancelled`,
  };
}

// ============================================================
// メイン: ParsedHeavyRainWarning → BsafPost[]
// ============================================================

/**
 * 1電文から BSAFポスト配列を生成する。
 * - Lv2〜Lv5 各レベル × 都道府県 ごとに投稿を生成
 * - 解除エリア（cancelledAreas / 取消電文）も都道府県別に投稿生成
 */
export function mapToBsafPosts(parsed: ParsedHeavyRainWarning): BsafPost[] {
  const posts: BsafPost[] = [];
  const timeUtc = toUtcIso(parsed.reportDateTime);

  // ── 取消電文（電文自体が「取消」: 全エリア対象）──
  if (parsed.infoType === "取消") {
    // 取消電文は具体的なエリアを伴わない可能性があるため、
    // items から推定できる全エリアを集めて都道府県別にグルーピングする。
    const allAreas = dedupeAreas([
      ...parsed.level2Areas,
      ...parsed.level3Areas,
      ...parsed.level4Areas,
      ...parsed.level5Areas,
      ...parsed.cancelledAreas,
    ]);
    if (allAreas.length === 0) {
      // エリア情報がない取消は1投稿だけ汎用的に出す（target未確定のためスキップが妥当）
      console.warn("[Mapper] 取消電文だがエリア情報なし。投稿スキップ。");
      return posts;
    }
    const groups = groupByPrefecture(allAreas);
    for (const { prefecture, areas } of groups.values()) {
      posts.push(buildCancelledPost({ parsed, prefecture, areas, timeUtc }));
    }
    return posts;
  }

  // ── 各レベルの発表中エリアを都道府県別に投稿 ──
  const LEVELS: Array<{ level: WarningLevel; areas: WarningArea[] }> = [
    { level: "level5", areas: parsed.level5Areas },
    { level: "level4", areas: parsed.level4Areas },
    { level: "level3", areas: parsed.level3Areas },
    { level: "level2", areas: parsed.level2Areas },
  ];

  for (const { level, areas } of LEVELS) {
    if (areas.length === 0) continue;
    const groups = groupByPrefecture(areas);
    for (const { prefecture, areas: prefAreas } of groups.values()) {
      posts.push(buildActivePost({ parsed, level, prefecture, areas: prefAreas, timeUtc }));
    }
  }

  // ── 部分解除（電文全体は発表だが status=解除 のエリアがある）──
  if (parsed.cancelledAreas.length > 0) {
    const groups = groupByPrefecture(parsed.cancelledAreas);
    for (const { prefecture, areas } of groups.values()) {
      posts.push(buildCancelledPost({ parsed, prefecture, areas, timeUtc }));
    }
  }

  return posts;
}

// ============================================================
// 内部ユーティリティ
// ============================================================

function dedupeAreas(areas: WarningArea[]): WarningArea[] {
  return [...new Map(areas.map((a) => [a.code, a])).values()];
}

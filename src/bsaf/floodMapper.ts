/**
 * src/bsaf/floodMapper.ts
 * ParsedFloodForecast → BsafPost[] 変換
 *
 * 設計判断:
 * - 1 投稿 = 1 都道府県 × 1 警戒レベル（R06 マッパーの「1都道府県×1現象×1値」に準拠）
 * - 現象は "flood" 固定（type:flood-warning）
 * - 警戒レベルは Kind/Code 先頭桁から導出（2→level2 … 5→level5、1→cancelled）
 * - 対象河川は本文に列挙。浸水想定地区（市町村）は都道府県ごとに集約して本文に列挙。
 */

import type {
  ParsedFloodForecast,
  FloodForecastGroup,
} from "../parsers/floodForecast";
import { prefectureFromMunicipalityCode } from "./prefectures";
import type { BsafValue } from "../codes/significancy";
import type { BsafPost } from "./r06Mapper";

// ============================================================
// 型・定数
// ============================================================

/** 洪水予報で取りうる警戒レベル値 */
type FloodLevel = "level2" | "level3" | "level4" | "level5";

const MAX_LIST = 8;
const SOURCE_LINE = "出典: 気象庁 https://www.jma.go.jp/bosai/warning/";

/** 警戒レベル別の氾濫情報名称（指定河川洪水予報の発表基準名称） */
const LEVEL_INFO_NAME: Record<FloodLevel, string> = {
  level2: "氾濫注意情報",
  level3: "氾濫警戒情報",
  level4: "氾濫危険情報",
  level5: "氾濫発生情報",
};

/** 警戒レベル別アイコン（R06 マッパーのメーター表記に統一） */
const LEVEL_ICON: Record<FloodLevel, string> = {
  level2: "🟨🟨⬜⬜⬜",
  level3: "🟥🟥🟥⬜⬜",
  level4: "🟪🟪🟪🟪⬜",
  level5: "⬛⬛⬛⬛⬛",
};

// ============================================================
// メイン
// ============================================================

export function mapFloodToBsafPosts(parsed: ParsedFloodForecast): BsafPost[] {
  const timeUtc = toUtcIso(parsed.reportDateTime);
  const posts: BsafPost[] = [];

  for (const group of parsed.groups) {
    const value = levelFromKindCode(group.kindCode);
    if (value === null) {
      console.warn(`[Flood] 未知の Kind/Code: ${group.kindCode} (${group.kindName})`);
      continue;
    }

    for (const prefArea of group.prefectures) {
      const pref = prefectureFromMunicipalityCode(prefArea.code);
      if (!pref) {
        console.warn(`[Flood] 未知の府県予報区コード: ${prefArea.code} (${prefArea.name})`);
        continue;
      }

      // この都道府県の浸水想定市町村
      const cities = uniq(
        parsed.inundationAreas
          .filter((a) => a.prefecture === prefArea.name)
          .map((a) => a.city),
      );

      const post =
        value === "cancelled"
          ? buildCancellationPost(pref.name, pref.target, group, cities, timeUtc)
          : buildActivePost(pref.name, pref.target, value, group, cities, timeUtc);

      posts.push(post);
    }
  }

  return posts;
}

// ============================================================
// Kind/Code → BsafValue
// ============================================================

/**
 * 指定河川洪水予報の Kind/Code 先頭桁から警戒レベルを導出する。
 * 1→解除 / 2→氾濫注意(level2) / 3→氾濫警戒(level3) / 4→氾濫危険(level4) / 5→氾濫発生(level5)
 */
function levelFromKindCode(code: string): FloodLevel | "cancelled" | null {
  switch (code.charAt(0)) {
    case "1":
      return "cancelled";
    case "2":
      return "level2";
    case "3":
      return "level3";
    case "4":
      return "level4";
    case "5":
      return "level5";
    default:
      return null;
  }
}

// ============================================================
// 投稿テキスト生成
// ============================================================

function buildActivePost(
  prefName: string,
  target: string,
  value: "level2" | "level3" | "level4" | "level5",
  group: FloodForecastGroup,
  cities: string[],
  timeUtc: string,
): BsafPost {
  const infoName = LEVEL_INFO_NAME[value];
  const icon = LEVEL_ICON[value];
  const levelNum = value.replace("level", "");

  const lines: string[] = [];
  lines.push(`${icon}【指定河川洪水予報】`);
  lines.push(`${infoName}（警戒レベル${levelNum}相当）`);
  lines.push("");
  lines.push(`${prefName}の指定河川で${infoName}が発表されました。`);
  lines.push(`対象河川: ${formatList(group.rivers, "河川")}`);
  if (cities.length > 0) {
    lines.push("");
    lines.push(`浸水想定地区: ${formatList(cities, "市町村")}`);
  }
  lines.push("");
  lines.push(SOURCE_LINE);

  return {
    text: normalizeBodyText(lines.join("\n")),
    tags: buildTags(value, timeUtc, target),
    // 発表時刻を含め、同一都道府県・同一レベルの別イベント（別河川・別発表）が
    // 30分ウィンドウで誤って重複抑制されないようにする。
    dedupeKey: `flood:${target}:${value}:${timeUtc}`,
  };
}

function buildCancellationPost(
  prefName: string,
  target: string,
  group: FloodForecastGroup,
  cities: string[],
  timeUtc: string,
): BsafPost {
  const lines: string[] = [];
  lines.push(`【指定河川洪水予報】解除`);
  lines.push("");
  lines.push(`${prefName}の指定河川で洪水予報が解除されました。`);
  lines.push(`対象河川: ${formatList(group.rivers, "河川")}`);
  lines.push("");
  lines.push(SOURCE_LINE);

  return {
    text: normalizeBodyText(lines.join("\n")),
    tags: buildTags("cancelled", timeUtc, target),
    dedupeKey: `flood:${target}:cancelled:${timeUtc}`,
  };
}

// ============================================================
// ユーティリティ
// ============================================================

function buildTags(
  value: BsafValue,
  timeUtc: string,
  target: string,
): string[] {
  return [
    "bsaf:v1",
    "type:flood-warning",
    `value:${value}`,
    `time:${timeUtc}`,
    `target:${target}`,
    "source:jma",
  ];
}

function formatList(names: string[], unit: string): string {
  if (names.length === 0) return `（${unit}情報なし）`;
  const head = names.slice(0, MAX_LIST).join("、");
  const rest = names.length > MAX_LIST ? `、ほか${names.length - MAX_LIST}${unit}` : "";
  return head + rest;
}

function uniq(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/** 全角数字を半角へ正規化する（本文可読性向上、URL・タグは対象外）。 */
function normalizeBodyText(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

function toUtcIso(isoLocal: string): string {
  if (!isoLocal) return "";
  const d = new Date(isoLocal);
  return isNaN(d.getTime()) ? isoLocal : d.toISOString();
}

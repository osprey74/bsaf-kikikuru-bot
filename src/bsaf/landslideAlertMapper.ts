/**
 * src/bsaf/landslideAlertMapper.ts
 * ParsedLandslideAlert（VXWW50 土砂災害警戒情報）→ BsafPost[] 変換
 *
 * BSAF タグは bsaf-jma-bot からの移管につき同一値を踏襲:
 *   - type:landslide-warning
 *   - value:warning（発表）/ cancelled（解除）
 *   - target: 都道府県
 *
 * R06 の VPWW56 土砂（type:landslide-warning・value:level4）とは別電文のため、
 * 重複抑制キーを別系統（landslide-alert:…）にして双方が配信されるようにする。
 */

import type { ParsedLandslideAlert } from "../parsers/landslideAlert";
import { prefectureByTitlePrefix, prefectureFromMunicipalityCode } from "./prefectures";
import type { BsafPost } from "./r06Mapper";

const SOURCE_LINE = "出典: 気象庁 https://www.jma.go.jp/bosai/warning/";
const MAX_MUNICIPALITY_LIST = 8;

export function mapLandslideAlertToBsafPosts(parsed: ParsedLandslideAlert): BsafPost[] {
  const pref =
    prefectureByTitlePrefix(parsed.headTitle) ??
    (parsed.municipalities[0]
      ? prefectureFromMunicipalityCode(parsed.municipalities[0].code)
      : null);
  if (!pref) {
    console.warn(`[Landslide] 都道府県を特定できません: "${parsed.headTitle}"`);
    return [];
  }

  const timeUtc = toUtcIso(parsed.reportDateTime);
  const names = parsed.municipalities.map((m) => m.name);
  const value = parsed.status === "解除" ? "cancelled" : "warning";

  const lines: string[] = [];
  if (value === "cancelled") {
    lines.push("【土砂災害警戒情報】解除");
    lines.push("");
    lines.push(`${pref.name}の${names.length}市町村で土砂災害警戒情報が解除されました。`);
  } else {
    lines.push("🟪【土砂災害警戒情報】");
    lines.push("");
    lines.push(`${pref.name}の${names.length}市町村に土砂災害警戒情報（警戒レベル4相当）が発表されました。`);
  }
  if (names.length > 0) lines.push(`対象市町村: ${formatList(names)}`);
  lines.push("");
  lines.push(SOURCE_LINE);

  return [
    {
      text: lines.join("\n"),
      tags: [
        "bsaf:v1",
        "type:landslide-warning",
        `value:${value}`,
        `time:${timeUtc}`,
        `target:${pref.target}`,
        "source:jma",
      ],
      dedupeKey: `landslide-alert:${pref.target}:${value}`,
    },
  ];
}

function formatList(names: string[]): string {
  if (names.length === 0) return "（市町村情報なし）";
  const head = names.slice(0, MAX_MUNICIPALITY_LIST).join("、");
  const rest =
    names.length > MAX_MUNICIPALITY_LIST ? `、ほか${names.length - MAX_MUNICIPALITY_LIST}市町村` : "";
  return head + rest;
}

function toUtcIso(isoLocal: string): string {
  if (!isoLocal) return "";
  const d = new Date(isoLocal);
  return isNaN(d.getTime()) ? isoLocal : d.toISOString();
}

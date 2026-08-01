/**
 * src/bsaf/weatherInfoMapper.ts
 * ParsedWeatherInfo（VPFJ50 府県気象情報）→ BsafPost[] 変換
 *
 * BSAF マッピング（2026-08-01 確定）:
 *   - type:weather-info（警報前段の解説・見通し情報）
 *   - value:info（レベルを持たない）
 *   - target: 都道府県（Head/Title の都道府県名から導出）
 *
 * 内容重複を避けるため府県（VPFJ50）のみを対象とし、地方（VPCJ50）・全般（VPZJ50）は対象外。
 */

import type { ParsedWeatherInfo } from "../parsers/weatherInfo";
import { PREFECTURES } from "./prefectures";
import type { BsafPost } from "./r06Mapper";

const SOURCE_LINE = "出典: 気象庁 https://www.jma.go.jp/bosai/warning/";
/** 本文の最大長（ヘッダー・出典・改行を含めて 300 書記素以内に収める） */
const MAX_BODY_LEN = 210;

export function mapWeatherInfoToBsafPosts(parsed: ParsedWeatherInfo): BsafPost[] {
  const pref = PREFECTURES.find((p) => p.name === parsed.prefName);
  if (!pref) {
    console.warn(`[WxInfo] 都道府県を特定できません: "${parsed.headTitle}"`);
    return [];
  }

  const timeUtc = toUtcIso(parsed.reportDateTime);
  // 都道府県名をヘッダーに入れる。本文（Head/Headline/Text）は細分名（「西部では」
  // 「下越、中越では」等）で始まり県名を含まないことがあるため、投稿から県が消えないようにする。
  const header = parsed.topic
    ? `ℹ️【${pref.name}気象情報】（${parsed.topic}）`
    : `ℹ️【${pref.name}気象情報】`;
  const body = truncate(normalizeBodyText(parsed.headlineText.trim()), MAX_BODY_LEN);

  const text = [header, "", body, "", SOURCE_LINE].join("\n");

  const post: BsafPost = {
    text,
    tags: [
      "bsaf:v1",
      "type:weather-info",
      "value:info",
      `time:${timeUtc}`,
      `target:${pref.target}`,
      "source:jma",
    ],
    dedupeKey: `weather-info:${pref.target}:${parsed.topic}:${timeUtc}`,
  };

  return [post];
}

function truncate(s: string, max: number): string {
  const arr = [...s];
  return arr.length > max ? arr.slice(0, max).join("") + "…" : s;
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

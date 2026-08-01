/**
 * src/bsaf/tornadoMapper.ts
 * ParsedTornadoWarning（VPHW50/51 竜巻注意情報）→ BsafPost[] 変換
 *
 * BSAF タグは bsaf-jma-bot からの移管につき同一値を踏襲（BSAF 仕様: 同一データは同一タグ）:
 *   - type:tornado-warning
 *   - value:warning
 *   - target: 都道府県（Head/Title の都道府県名から導出。粒度は本 Bot の都道府県単位）
 */

import type { ParsedTornadoWarning } from "../parsers/tornadoWarning";
import { prefectureByTitlePrefix } from "./prefectures";
import type { BsafPost } from "./r06Mapper";

const SOURCE_LINE = "出典: 気象庁 https://www.jma.go.jp/bosai/warning/";
const MAX_BODY_LEN = 210;

export function mapTornadoToBsafPosts(parsed: ParsedTornadoWarning): BsafPost[] {
  const pref = prefectureByTitlePrefix(parsed.headTitle);
  if (!pref) {
    console.warn(`[Tornado] 都道府県を特定できません: "${parsed.headTitle}"`);
    return [];
  }

  const timeUtc = toUtcIso(parsed.reportDateTime);
  const body = truncate(normalizeBodyText(parsed.headlineText.trim()), MAX_BODY_LEN);
  const text = ["🌪️【竜巻注意情報】", "", body, "", SOURCE_LINE].join("\n");

  return [
    {
      text,
      tags: [
        "bsaf:v1",
        "type:tornado-warning",
        "value:warning",
        `time:${timeUtc}`,
        `target:${pref.target}`,
        "source:jma",
      ],
      dedupeKey: `tornado-warning:${pref.target}:${timeUtc}`,
    },
  ];
}

function truncate(s: string, max: number): string {
  const arr = [...s];
  return arr.length > max ? arr.slice(0, max).join("") + "…" : s;
}
function normalizeBodyText(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}
function toUtcIso(isoLocal: string): string {
  if (!isoLocal) return "";
  const d = new Date(isoLocal);
  return isNaN(d.getTime()) ? isoLocal : d.toISOString();
}

/**
 * src/bsaf/bosaiMapper.ts
 * ParsedBosaiReport（VPBS50 府県気象防災速報）→ BsafPost[] 変換
 *
 * 対象サブ種別と BSAF マッピング（type/value は 2026-08-01 に確定）:
 *   - 線状降水帯直前予測 → type:linear-rainband-warning     value:level4
 *   - 線状降水帯発生     → type:linear-rainband-warning     value:level5
 *   - 顕著な大雪         → type:significant-snowfall-warning value:level4
 *
 * 記録的短時間大雨は当面スキップ（bsaf-jma-bot が旧 VPOA50 で配信中のため二重投稿回避。
 * 将来 VPOA50 を JMABot から移管する際に有効化する）。
 * 短文形式の気象情報も本 Bot の配信対象外。
 */

import type { ParsedBosaiReport } from "../parsers/bosaiReport";
import { prefectureFromMunicipalityCode, PREFECTURES } from "./prefectures";
import type { BsafPost } from "./r06Mapper";

type Level = "level4" | "level5";

interface SubKindMapping {
  bsafType: string;
  value: Level;
  headerLabel: string;
}

const SOURCE_LINE = "出典: 気象庁 https://www.jma.go.jp/bosai/warning/";

const LEVEL_ICON: Record<Level, string> = {
  level4: "🟪🟪🟪🟪⬜",
  level5: "⬛⬛⬛⬛⬛",
};

/**
 * Head/Title の括弧内サブ種別を BSAF type/value に対応づける。
 * 対象外（記録的短時間大雨・短文形式気象情報等）は null を返しスキップする。
 */
function mapSubKind(subKind: string): SubKindMapping | null {
  if (subKind.includes("線状降水帯")) {
    // 「線状降水帯直前予測」= 予測（レベル4相当）、「線状降水帯」「線状降水帯発生」= 発生（レベル5相当）
    if (subKind.includes("直前予測") || subKind.includes("予測")) {
      return { bsafType: "linear-rainband-warning", value: "level4", headerLabel: "線状降水帯 直前予測" };
    }
    return { bsafType: "linear-rainband-warning", value: "level5", headerLabel: "線状降水帯 発生" };
  }
  if (subKind.includes("顕著な大雪") || subKind.includes("大雪")) {
    return { bsafType: "significant-snowfall-warning", value: "level4", headerLabel: "顕著な大雪" };
  }
  return null;
}

export function mapBosaiToBsafPosts(parsed: ParsedBosaiReport): BsafPost[] {
  const mapping = mapSubKind(parsed.subKind);
  if (!mapping) {
    console.info(`[Bosai] 配信対象外サブ種別のためスキップ: ${parsed.subKind || "(不明)"}`);
    return [];
  }

  const targets = resolveTargets(parsed);
  if (targets.length === 0) {
    console.warn(`[Bosai] 対象都道府県を特定できません: ${parsed.headTitle}`);
    return [];
  }

  const timeUtc = toUtcIso(parsed.reportDateTime);
  const body = normalizeBodyText(parsed.headlineText.trim());
  const levelNum = mapping.value.replace("level", "");
  const icon = LEVEL_ICON[mapping.value];

  return targets.map((target) => {
    const lines = [
      `${icon}【${mapping.headerLabel}】（警戒レベル${levelNum}相当）`,
      "",
      body,
      "",
      SOURCE_LINE,
    ];
    return {
      text: lines.join("\n"),
      tags: [
        "bsaf:v1",
        `type:${mapping.bsafType}`,
        `value:${mapping.value}`,
        `time:${timeUtc}`,
        `target:${target}`,
        "source:jma",
      ],
      dedupeKey: `${mapping.bsafType}:${target}:${mapping.value}`,
    };
  });
}

/**
 * 対象都道府県 target を決定する。
 * 第一に Body の細分区域コード（先頭2桁）から、無ければ Head/Title の都道府県名から導出する。
 */
function resolveTargets(parsed: ParsedBosaiReport): string[] {
  const set = new Set<string>();

  for (const code of parsed.areaCodes) {
    const pref = prefectureFromMunicipalityCode(code);
    if (pref) set.add(pref.target);
  }

  if (set.size === 0) {
    // フォールバック: Head/Title 先頭の都道府県名で照合
    for (const pref of PREFECTURES) {
      if (parsed.headTitle.startsWith(pref.name)) {
        set.add(pref.target);
        break;
      }
    }
  }

  return [...set];
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

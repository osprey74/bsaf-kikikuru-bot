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

type BosaiValue = "level4" | "level5" | "warning";

interface SubKindMapping {
  bsafType: string;
  value: BosaiValue;
  headerLabel: string;
}

const SOURCE_LINE = "出典: 気象庁 https://www.jma.go.jp/bosai/warning/";

const VALUE_ICON: Record<BosaiValue, string> = {
  level4: "🟪🟪🟪🟪⬜",
  level5: "⬛⬛⬛⬛⬛",
  warning: "🌧️",
};

/**
 * Head/Title の括弧内サブ種別を BSAF type/value に対応づける。
 * 対象外（短文形式気象情報等）は null を返しスキップする。
 * 記録的短時間大雨は bsaf-jma-bot から移管し type:heavy-rain・value:warning を踏襲する。
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
  if (subKind.includes("記録的短時間大雨")) {
    return { bsafType: "heavy-rain", value: "warning", headerLabel: "記録的短時間大雨" };
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
  const icon = VALUE_ICON[mapping.value];
  const levelSuffix = mapping.value.startsWith("level")
    ? `（警戒レベル${mapping.value.replace("level", "")}相当）`
    : "";

  return targets.map((target) => {
    const lines = [
      `${icon}【${mapping.headerLabel}】${levelSuffix}`,
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
      // 発表時刻を含め、同一都道府県の別イベント（別地点の記録的短時間大雨・
      // 線状降水帯の別発表）が30分ウィンドウで誤って重複抑制されないようにする。
      dedupeKey: `${mapping.bsafType}:${target}:${mapping.value}:${timeUtc}`,
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

/**
 * src/codes/kindCode.ts
 * 気象警報・注意報（Ｒ０６）電文の Kind/Code 表
 *
 * 出典: 気象庁防災情報XMLフォーマット 別表3（警戒レベル等対応コード表）
 *       および code.WeatherWarning 管理表（jmaxml_20260430_code.xlsx）
 *
 * VPWW55-61 / VPWW54 共通の Body/Warning/Item/Kind/Code 値の解釈テーブル。
 */

/** 現象種別（電文タイプとほぼ1対1だが、VPWW61は複数現象を含む） */
export type Phenomenon =
  | "heavy-rain"            // 大雨 (VPWW55)
  | "landslide"             // 土砂災害 (VPWW56)
  | "storm-surge"           // 高潮 (VPWW57)
  | "wind"                  // 暴風・暴風雪 (VPWW58)
  | "wave"                  // 波浪 (VPWW59)
  | "snow"                  // 大雪 (VPWW60)
  | "thunderstorm"          // 雷 (VPWW61)
  | "melting-snow"          // 融雪 (VPWW61)
  | "dense-fog"             // 濃霧 (VPWW61)
  | "dry-air"               // 乾燥 (VPWW61)
  | "avalanche"             // なだれ (VPWW61)
  | "low-temperature"       // 低温 (VPWW61)
  | "frost"                 // 霜 (VPWW61)
  | "icing"                 // 着氷 (VPWW61)
  | "snow-accretion"        // 着雪 (VPWW61)
  | "other"                 // その他の注意報 (VPWW61, Code 27)
  | "flood";                // 洪水 (経過措置・新体系では Lv4氾濫危険警報等は VXKO/VXSU で表現)

/** Kind/Code レコード（別表3） */
export interface KindCodeEntry {
  /** 警報・注意報の名称 */
  readonly name: string;
  /** 現象種別（BSAF type タグに使用） */
  readonly phenomenon: Phenomenon;
  /** 警報級・注意報級の区分 */
  readonly severity: "advisory" | "warning" | "danger-warning" | "special-warning" | "cancelled";
  /**
   * 名称に含まれる警戒レベル（"レベル○○○○"記法）。
   * 警戒レベル体系に紐づかない警報・注意報（暴風・波浪・大雪・各種注意報）は null。
   */
  readonly level: 2 | 3 | 4 | 5 | null;
}

/**
 * Kind/Code → 警報・注意報レコードマッピング（別表3 完全版）
 *
 * - Code "00" は解除
 * - Code "04"/"18" は経過措置電文（旧VPWW54）の洪水警報・注意報。
 *   新体系（VPWW55-61）では氾濫情報は VXKO/VXSU 系電文に移管されるが、
 *   経過措置期間中は VPWW61 等で出現する可能性あり。
 */
export const KIND_CODE_TABLE: Readonly<Record<string, KindCodeEntry>> = Object.freeze({
  "00": { name: "解除",                   phenomenon: "other",            severity: "cancelled",       level: null },

  // 暴風・暴風雪 (VPWW58)
  "02": { name: "暴風雪警報",             phenomenon: "wind",             severity: "warning",         level: null },
  "05": { name: "暴風警報",               phenomenon: "wind",             severity: "warning",         level: null },
  "13": { name: "風雪注意報",             phenomenon: "wind",             severity: "advisory",        level: null },
  "15": { name: "強風注意報",             phenomenon: "wind",             severity: "advisory",        level: null },
  "32": { name: "暴風雪特別警報",         phenomenon: "wind",             severity: "special-warning", level: null },
  "35": { name: "暴風特別警報",           phenomenon: "wind",             severity: "special-warning", level: null },

  // 大雨 (VPWW55, 警戒レベル体系)
  "03": { name: "レベル3大雨警報",         phenomenon: "heavy-rain",       severity: "warning",         level: 3    },
  "10": { name: "レベル2大雨注意報",       phenomenon: "heavy-rain",       severity: "advisory",        level: 2    },
  "33": { name: "レベル5大雨特別警報",     phenomenon: "heavy-rain",       severity: "special-warning", level: 5    },
  "43": { name: "レベル4大雨危険警報",     phenomenon: "heavy-rain",       severity: "danger-warning",  level: 4    },

  // 土砂災害 (VPWW56, 警戒レベル体系)
  "09": { name: "レベル3土砂災害警報",     phenomenon: "landslide",        severity: "warning",         level: 3    },
  "29": { name: "レベル2土砂災害注意報",   phenomenon: "landslide",        severity: "advisory",        level: 2    },
  "39": { name: "レベル5土砂災害特別警報", phenomenon: "landslide",        severity: "special-warning", level: 5    },
  "49": { name: "レベル4土砂災害危険警報", phenomenon: "landslide",        severity: "danger-warning",  level: 4    },

  // 高潮 (VPWW57, 警戒レベル体系)
  "08": { name: "レベル3高潮警報",         phenomenon: "storm-surge",      severity: "warning",         level: 3    },
  "19": { name: "レベル2高潮注意報",       phenomenon: "storm-surge",      severity: "advisory",        level: 2    },
  "38": { name: "レベル5高潮特別警報",     phenomenon: "storm-surge",      severity: "special-warning", level: 5    },
  "48": { name: "レベル4高潮危険警報",     phenomenon: "storm-surge",      severity: "danger-warning",  level: 4    },

  // 波浪 (VPWW59)
  "07": { name: "波浪警報",               phenomenon: "wave",             severity: "warning",         level: null },
  "16": { name: "波浪注意報",             phenomenon: "wave",             severity: "advisory",        level: null },
  "37": { name: "波浪特別警報",           phenomenon: "wave",             severity: "special-warning", level: null },

  // 大雪 (VPWW60)
  "06": { name: "大雪警報",               phenomenon: "snow",             severity: "warning",         level: null },
  "12": { name: "大雪注意報",             phenomenon: "snow",             severity: "advisory",        level: null },
  "36": { name: "大雪特別警報",           phenomenon: "snow",             severity: "special-warning", level: null },

  // その他の注意報 (VPWW61)
  "04": { name: "洪水警報",               phenomenon: "flood",            severity: "warning",         level: null },
  "14": { name: "雷注意報",               phenomenon: "thunderstorm",     severity: "advisory",        level: null },
  "17": { name: "融雪注意報",             phenomenon: "melting-snow",     severity: "advisory",        level: null },
  "18": { name: "洪水注意報",             phenomenon: "flood",            severity: "advisory",        level: null },
  "20": { name: "濃霧注意報",             phenomenon: "dense-fog",        severity: "advisory",        level: null },
  "21": { name: "乾燥注意報",             phenomenon: "dry-air",          severity: "advisory",        level: null },
  "22": { name: "なだれ注意報",           phenomenon: "avalanche",        severity: "advisory",        level: null },
  "23": { name: "低温注意報",             phenomenon: "low-temperature",  severity: "advisory",        level: null },
  "24": { name: "霜注意報",               phenomenon: "frost",            severity: "advisory",        level: null },
  "25": { name: "着氷注意報",             phenomenon: "icing",            severity: "advisory",        level: null },
  "26": { name: "着雪注意報",             phenomenon: "snow-accretion",   severity: "advisory",        level: null },
  "27": { name: "その他の注意報",         phenomenon: "other",            severity: "advisory",        level: null },
});

/** Kind/Code を解釈する。未知コードは null。 */
export function lookupKindCode(code: string): KindCodeEntry | null {
  return KIND_CODE_TABLE[code] ?? null;
}

/** Phenomenon → BSAF type タグ用文字列（`type:` プレフィックス無し） */
export const PHENOMENON_TO_BSAF_TYPE: Readonly<Record<Phenomenon, string>> = Object.freeze({
  "heavy-rain":       "heavy-rain-warning",
  "landslide":        "landslide-warning",
  "storm-surge":      "storm-surge-warning",
  "wind":             "wind-warning",
  "wave":             "wave-warning",
  "snow":             "snow-warning",
  "thunderstorm":     "thunderstorm-warning",
  "melting-snow":     "melting-snow-warning",
  "dense-fog":        "dense-fog-warning",
  "dry-air":          "dry-air-warning",
  "avalanche":        "avalanche-warning",
  "low-temperature":  "low-temperature-warning",
  "frost":            "frost-warning",
  "icing":            "icing-warning",
  "snow-accretion":   "snow-accretion-warning",
  "other":            "other-warning",
  "flood":            "flood-warning",
});

/** 投稿本文用の現象ラベル */
export const PHENOMENON_LABEL: Readonly<Record<Phenomenon, string>> = Object.freeze({
  "heavy-rain":       "大雨",
  "landslide":        "土砂災害",
  "storm-surge":      "高潮",
  "wind":             "暴風",
  "wave":             "波浪",
  "snow":             "大雪",
  "thunderstorm":     "雷",
  "melting-snow":     "融雪",
  "dense-fog":        "濃霧",
  "dry-air":          "乾燥",
  "avalanche":        "なだれ",
  "low-temperature":  "低温",
  "frost":            "霜",
  "icing":            "着氷",
  "snow-accretion":   "着雪",
  "other":            "その他",
  "flood":            "洪水",
});

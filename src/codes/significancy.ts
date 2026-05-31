/**
 * src/codes/significancy.ts
 * 危険度（Significancy）コード表
 *
 * 出典: 気象庁防災情報XMLフォーマット 別表5（危険度と対応するコード）
 *       および code.Significancy 管理表（jmaxml_20260430_code.xlsx）
 *
 * Body/Warning/Item/Kind/Property/SignificancyPart/Base/Significancy/Code の値を解釈する。
 * 警戒レベル体系（VPWW55/56/57）では Code が 21/22/31/41/51 を取り、警戒レベルに対応する。
 * 警戒レベル体系外（VPWW58/59/60/61）では Code が 20/30/50 を取り、警報級・注意報級を表す。
 */

/** BSAF value タグの値（警戒レベル or 警報級） */
export type BsafValue =
  | "level2"
  | "level3"
  | "level4"
  | "level5"
  | "advisory"          // 注意報級（警戒レベル体系外）
  | "warning"           // 警報級（警戒レベル体系外）
  | "special-warning"   // 特別警報級（警戒レベル体系外）
  | "cancelled"
  | null;               // 投稿対象外（注意報級未満・値なし等）

/** Significancy コードレコード */
export interface SignificancyEntry {
  /** 日本語名 */
  readonly name: string;
  /** BSAF value タグ値（null は投稿対象外） */
  readonly value: BsafValue;
  /** 警戒レベル数値（紐づかない場合は null） */
  readonly level: 2 | 3 | 4 | 5 | null;
  /** 深刻度ランク（同一現象内で複数 Significancy が出現した場合の最大値比較用） */
  readonly rank: number;
}

/**
 * Significancy/Code → 解釈レコード（別表5）
 *
 * rank: 同一現象・同一都道府県内で複数 Significancy が出現したとき
 *       最も深刻なものを採用するための数値比較キー（大きいほど深刻）。
 */
export const SIGNIFICANCY_TABLE: Readonly<Record<string, SignificancyEntry>> = Object.freeze({
  "00": { name: "値なし",             value: null,              level: null, rank: 0 },
  "01": { name: "注意報級未満",       value: null,              level: null, rank: 1 },
  "11": { name: "警戒レベル2未満",    value: null,              level: null, rank: 2 },
  "20": { name: "注意報級",           value: "advisory",        level: null, rank: 10 },
  "21": { name: "警戒レベル2",        value: "level2",          level: 2,    rank: 21 },
  "22": { name: "警戒レベル2相当",    value: "level2",          level: 2,    rank: 22 },
  "30": { name: "警報級",             value: "warning",         level: null, rank: 30 },
  "31": { name: "警戒レベル3相当",    value: "level3",          level: 3,    rank: 31 },
  "41": { name: "警戒レベル4相当",    value: "level4",          level: 4,    rank: 41 },
  "50": { name: "特別警報級",         value: "special-warning", level: null, rank: 50 },
  "51": { name: "警戒レベル5相当",    value: "level5",          level: 5,    rank: 51 },
});

/** Significancy/Code を解釈する。未知コードは null。 */
export function lookupSignificancy(code: string): SignificancyEntry | null {
  return SIGNIFICANCY_TABLE[code] ?? null;
}

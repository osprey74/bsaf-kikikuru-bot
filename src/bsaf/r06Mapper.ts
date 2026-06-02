/**
 * src/bsaf/r06Mapper.ts
 * ParsedR06Warning → BsafPost[] 変換
 *
 * 設計判断（HANDOFF_redesign.md §6 確定事項）:
 * - 1 投稿 = 1 都道府県 × 1 現象 × 1 値
 * - 4 階層 Warning のうち市町村等レベルを集約し、府県単位に集計
 * - 同一現象・同一都道府県内で複数 Significancy がある場合は最大ランク（最深刻）を採用
 * - 解除は複数投稿に分解
 * - 量的予想は存在時のみ本文に「主な量的予想」セクション追加
 */

import type {
  ParsedR06Warning,
  WarningKind,
  MunicipalityWarningItem,
  Significancy,
  QuantitativeForecast,
  CriteriaPeriod,
} from "../parsers/r06Warning";
import {
  lookupKindCode,
  PHENOMENON_TO_BSAF_TYPE,
  PHENOMENON_LABEL,
  type Phenomenon,
} from "../codes/kindCode";
import { lookupSignificancy, type BsafValue } from "../codes/significancy";
import {
  prefectureFromMunicipalityCode,
  type Prefecture,
} from "./prefectures";

// ============================================================
// 型定義
// ============================================================

export interface BsafPost {
  /** 投稿本文 */
  text: string;
  /** AT Protocol `tags` フィールドに渡す BSAF タグ配列 */
  tags: string[];
  /** 重複抑制キー（phenomenon:prefectureTarget:value） */
  dedupeKey: string;
}

/** 都道府県・現象別の集計結果 */
interface AggregationKey {
  prefecture: Prefecture;
  phenomenon: Phenomenon;
}

/** 集計結果（同一都道府県・同一現象の市町村群を束ねたもの） */
interface PhenomenonAggregate {
  prefecture: Prefecture;
  phenomenon: Phenomenon;
  /** 採用された値（深刻度最大の Significancy or 警報級から決定） */
  value: Exclude<BsafValue, null | "cancelled">;
  /** 採用 Kind の表示名（例: "強風注意報", "レベル2大雨注意報"） */
  representativeKindName: string;
  /** 採用 Significancy（あれば） */
  significancy: Significancy | null;
  /** 対象市町村名（重複除去・表示順） */
  municipalityNames: string[];
  /** 採用された Kind の付加事項（突風・ひょう・うねり等） */
  additions: string[];
  /** 採用された Kind の量的予想 */
  quantitative: QuantitativeForecast[];
  /** 採用された Kind の警戒レベル到達予想期間（Sentence 重複は除外） */
  criteriaPeriods: CriteriaPeriod[];
}

/** 解除集計（同一都道府県・同一現象でいずれかの市町村が解除に該当） */
interface CancellationAggregate {
  prefecture: Prefecture;
  phenomenon: Phenomenon;
  /** 解除対象市町村名 */
  municipalityNames: string[];
  /** 解除前の警報・注意報名（LastKind から取れる場合のみ。今はシンプルに「解除」表記） */
}

// ============================================================
// 定数
// ============================================================

const MAX_MUNICIPALITY_LIST = 8;

/** value タグ → 投稿ヘッダー絵文字＋ラベル（significancy 欠落時の本文補助に使用） */
const VALUE_HEADER: Record<Exclude<BsafValue, null>, string> = {
  "level5":          "🚨 警戒レベル5",
  "level4":          "⚠️ 警戒レベル4",
  "level3":          "🟡 警戒レベル3",
  "level2":          "⚪ 警戒レベル2",
  "special-warning": "🚨 特別警報",
  "warning":         "🟡 警報",
  "advisory":        "⚪ 注意報",
  "cancelled":       "⬇️ 解除",
};

/**
 * value タグ → タイトル枠の前に置くカラーアイコン。
 *
 * 設計:
 * - 警戒レベル相当情報（大雨・土砂・高潮・洪水）は Lv2-Lv5 に対応する四角アイコン
 * - 警戒レベル体系外の警報・注意報（暴風・波浪・大雪・雷他）は ⚠️
 * - 特別警報は ⚠️ より強い 🚨 で最大警戒を表現
 * - 解除は視認性確保のため敢えてアイコンを付けない（情報密度を下げる）
 */
const VALUE_ICON: Record<Exclude<BsafValue, null>, string> = {
  "level5":          "⬛",
  "level4":          "🟪",
  "level3":          "🟥",
  "level2":          "🟨",
  "special-warning": "🚨",
  "warning":         "⚠️",
  "advisory":        "⚠️",
  "cancelled":       "",
};

const SOURCE_LINE = "出典: 気象庁 https://www.jma.go.jp/bosai/warning/";

// ============================================================
// メイン: ParsedR06Warning → BsafPost[]
// ============================================================

export function mapToBsafPosts(parsed: ParsedR06Warning): BsafPost[] {
  // ── 集計 ──
  const activeAgg = new Map<string, PhenomenonAggregate>();
  const cancelAgg = new Map<string, CancellationAggregate>();

  for (const item of parsed.municipalityItems) {
    const pref = prefectureFromMunicipalityCode(item.areaCode);
    if (!pref) {
      console.warn(`[Mapper] 未知の市町村コード: ${item.areaCode} (${item.areaName})`);
      continue;
    }

    for (const kind of item.kinds) {
      classifyAndAggregate(kind, item, pref, activeAgg, cancelAgg);
    }
  }

  // ── 投稿生成 ──
  const timeUtc = toUtcIso(parsed.reportDateTime);
  const posts: BsafPost[] = [];

  for (const agg of activeAgg.values()) {
    posts.push(buildActivePost(agg, parsed, timeUtc));
  }
  for (const agg of cancelAgg.values()) {
    posts.push(buildCancellationPost(agg, parsed, timeUtc));
  }

  return posts;
}

// ============================================================
// 1 Kind を解釈して集計バケツへ振り分け
// ============================================================

function classifyAndAggregate(
  kind: WarningKind,
  item: MunicipalityWarningItem,
  prefecture: Prefecture,
  activeAgg: Map<string, PhenomenonAggregate>,
  cancelAgg: Map<string, CancellationAggregate>,
): void {
  // 「発表警報・注意報はなし」は無視
  if (kind.status === "発表警報・注意報はなし") return;

  // Kind/Code を解釈
  const kindInfo = lookupKindCode(kind.code);
  if (!kindInfo) {
    // 未知コードは警告ログのみ
    console.warn(`[Mapper] 未知 Kind/Code: ${kind.code} (${kind.name})`);
    return;
  }

  // 解除判定: Status="解除" または Kind/Code="00"
  const isCancellation = kind.status === "解除" || kind.code === "00";

  // 解除の場合、Code="00" だと phenomenon が "other" になってしまうため、
  // 実際の現象種別は本電文の Control/Title から判定するのが本来は理想だが、
  // 現状は LastKind 情報を持たない単純化実装として「Code="00" → other とせず
  // Kind/Code="00" のときは Item の他 Kind 群から推定」を試みる。
  // ただし、Code="00" の場合は Item 内に他 Kind が無いケースが多いため、
  // ここでは「現象不明の解除」として扱わず、Status="解除" のもののみ集計する。
  if (kind.code === "00") {
    // Kind/Code="00" のとき phenomenon=other になるが、解除を投稿するなら
    // 現象が確定している必要がある。情報不足のためスキップ。
    return;
  }

  if (isCancellation) {
    const key = `${kindInfo.phenomenon}:${prefecture.target}`;
    const existing = cancelAgg.get(key);
    if (existing) {
      if (!existing.municipalityNames.includes(item.areaName)) {
        existing.municipalityNames.push(item.areaName);
      }
    } else {
      cancelAgg.set(key, {
        prefecture,
        phenomenon: kindInfo.phenomenon,
        municipalityNames: [item.areaName],
      });
    }
    return;
  }

  // 発表中: Significancy から value を決定（Significancy がなければ KindCodeEntry から決定）
  const significancy = selectMaxSignificancy(kind.significancies);
  const value: BsafValue = significancy
    ? lookupSignificancy(significancy.code)?.value ?? null
    : deriveValueFromKind(kindInfo.level, kindInfo.severity);

  // 投稿対象外（注意報級未満等）
  if (value === null || value === "cancelled") return;

  const key = `${kindInfo.phenomenon}:${prefecture.target}`;
  const existing = activeAgg.get(key);

  if (!existing) {
    activeAgg.set(key, {
      prefecture,
      phenomenon: kindInfo.phenomenon,
      value,
      representativeKindName: kindInfo.name,
      significancy: significancy ?? null,
      municipalityNames: [item.areaName],
      additions: [...kind.additions],
      quantitative: [...kind.quantitative],
      criteriaPeriods: [...kind.criteriaPeriods],
    });
  } else {
    // 既存と比較し、より深刻な value のときに代表を入れ替える
    if (compareValueSeverity(value, existing.value) > 0) {
      existing.value = value;
      existing.representativeKindName = kindInfo.name;
      existing.significancy = significancy ?? null;
      existing.additions = [...kind.additions];
      existing.quantitative = [...kind.quantitative];
      existing.criteriaPeriods = [...kind.criteriaPeriods];
    }
    if (!existing.municipalityNames.includes(item.areaName)) {
      existing.municipalityNames.push(item.areaName);
    }
  }
}

/**
 * Significancy が無い Kind について、KindCodeEntry の level/severity から BsafValue を導出する。
 * - level が存在（2-5）→ "level{2-5}"
 * - level=null、severity=advisory/warning/special-warning → そのまま
 * - cancelled は外で別処理（ここでは null）
 */
function deriveValueFromKind(
  level: 2 | 3 | 4 | 5 | null,
  severity: "advisory" | "warning" | "danger-warning" | "special-warning" | "cancelled",
): BsafValue {
  if (level !== null) {
    return (`level${level}` as BsafValue);
  }
  switch (severity) {
    case "advisory":        return "advisory";
    case "warning":         return "warning";
    case "special-warning": return "special-warning";
    case "danger-warning":  return "level4"; // 危険警報は level=4 を持つはずだが念のため
    case "cancelled":       return null;
  }
}

/** Significancy 配列から rank 最大のものを選ぶ。空なら null。 */
function selectMaxSignificancy(sigs: Significancy[]): Significancy | null {
  let best: Significancy | null = null;
  let bestRank = -1;
  for (const s of sigs) {
    const info = lookupSignificancy(s.code);
    if (!info) continue;
    if (info.rank > bestRank) {
      bestRank = info.rank;
      best = s;
    }
  }
  return best;
}

/** value の深刻度比較。a > b なら正、a < b なら負、同等なら 0。 */
function compareValueSeverity(a: BsafValue, b: BsafValue): number {
  const order: Record<Exclude<BsafValue, null>, number> = {
    "cancelled":       -1,
    "advisory":        10,
    "warning":         30,
    "special-warning": 50,
    "level2":          21,
    "level3":          31,
    "level4":          41,
    "level5":          51,
  };
  const av = a === null ? -100 : order[a];
  const bv = b === null ? -100 : order[b];
  return av - bv;
}

// ============================================================
// 投稿テキスト生成
// ============================================================

function buildActivePost(
  agg: PhenomenonAggregate,
  parsed: ParsedR06Warning,
  timeUtc: string,
): BsafPost {
  const header = VALUE_HEADER[agg.value];
  const icon = VALUE_ICON[agg.value];
  const phenomLabel = PHENOMENON_LABEL[agg.phenomenon];
  const muniCount = agg.municipalityNames.length;
  const muniList = formatMunicipalityList(agg.municipalityNames);

  const lines: string[] = [];
  lines.push(`${icon}【${phenomLabel}警報・注意報】${agg.representativeKindName}`);
  lines.push("");
  lines.push(`${agg.prefecture.name}の${muniCount}市町村に${agg.representativeKindName}が発表されました。`);
  if (agg.significancy) {
    lines.push(`レベル：${agg.significancy.name}`);
  } else {
    lines.push(`レベル：${header.replace(/^\S+\s*/, "")}`);
  }

  // 警戒レベル到達予想（CriteriaPeriod）— 存在時のみ
  const criteriaLines = formatCriteriaPeriods(agg.criteriaPeriods);
  if (criteriaLines.length > 0) {
    lines.push("");
    lines.push("到達予想:");
    for (const c of criteriaLines) lines.push(c);
  }

  // 量的予想セクション（存在時のみ）
  const quantLines = formatQuantitative(agg.quantitative, agg.additions);
  if (quantLines.length > 0) {
    lines.push("");
    lines.push("主な量的予想:");
    for (const q of quantLines) lines.push(q);
  } else if (agg.additions.length > 0) {
    // 量的予想は無いが付加事項のみある場合
    lines.push(`付加事項：${agg.additions.join("、")}`);
  }

  lines.push("");
  lines.push(`対象市町村: ${muniList}`);
  lines.push("");
  lines.push(SOURCE_LINE);

  const tags = buildTags({
    phenomenon: agg.phenomenon,
    value:      agg.value,
    timeUtc,
    target:     agg.prefecture.target,
  });

  return {
    text:      normalizeBodyText(lines.join("\n")),
    tags,
    dedupeKey: `${agg.phenomenon}:${agg.prefecture.target}:${agg.value}`,
  };
}

function buildCancellationPost(
  agg: CancellationAggregate,
  _parsed: ParsedR06Warning,
  timeUtc: string,
): BsafPost {
  const phenomLabel = PHENOMENON_LABEL[agg.phenomenon];
  const muniList = formatMunicipalityList(agg.municipalityNames);

  const lines: string[] = [];
  lines.push(`【${phenomLabel}警報・注意報】解除`);
  lines.push("");
  lines.push(`${agg.prefecture.name}の${agg.municipalityNames.length}市町村で${phenomLabel}の警報・注意報が解除されました。`);
  lines.push("");
  lines.push(`対象市町村: ${muniList}`);
  lines.push("");
  lines.push(SOURCE_LINE);

  const tags = buildTags({
    phenomenon: agg.phenomenon,
    value:      "cancelled",
    timeUtc,
    target:     agg.prefecture.target,
  });

  return {
    text:      normalizeBodyText(lines.join("\n")),
    tags,
    dedupeKey: `${agg.phenomenon}:${agg.prefecture.target}:cancelled`,
  };
}

/**
 * 投稿本文の全角数字を半角に正規化する。
 * 電文ママの「警戒レベル２」「１日１７時から…」等は半角の方が可読性が高いため。
 * URL・タグはこの関数を通さないので影響なし。
 */
function normalizeBodyText(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

// ============================================================
// 量的予想の本文整形
// ============================================================

/**
 * 量的予想と付加事項を投稿用文字列リストに整形する。
 * 同一現象でも 1 つの Property に複数要素（風向＋風速、湿度の実効＋最小等）が並ぶケースを統合表示する。
 *
 * 数値表現は `value+unit` の半角形式（例: "15m/s", "200m以下", "60cm"）。
 * description 属性（"１５メートル" 等の全角表記）は使わない。
 */
function formatQuantitative(
  quant: QuantitativeForecast[],
  additions: string[],
): string[] {
  if (quant.length === 0) return [];

  const lines: string[] = [];
  const additionSuffix = additions.length > 0 ? `（${additions.join("、")}）` : "";

  // 風向 + 風速のペアリング（VPWW58）
  const winds = quant.filter((q) => q.attrType === "最大風速");
  const dirs  = quant.filter((q) => q.attrType === "風向");
  for (const w of winds) {
    const matchingDir = dirs.find((d) => (d.areaName ?? "") === (w.areaName ?? ""));
    const dirStr = matchingDir ? `（${matchingDir.value}の風）` : "";
    const area = w.areaName ? `[${w.areaName}] ` : "";
    lines.push(`・${area}最大風速 ${w.value}${w.unit}${dirStr}`);
  }

  // 波高（VPWW59、または VPWW57 のうちあげ高水位）
  for (const q of quant.filter((q) => q.attrType === "波高")) {
    const area = q.areaName ? `[${q.areaName}] ` : "";
    lines.push(`・${area}波高 ${q.value}${q.unit}`);
  }
  for (const q of quant.filter((q) => q.attrType === "うちあげ高水位" || q.attrType === "最高うちあげ高水位")) {
    const area = q.areaName ? `[${q.areaName}] ` : "";
    lines.push(`・${area}${q.attrType} ${q.value}${q.unit}`);
  }

  // 潮位（VPWW57）— Property/Type で「高潮基準超過」「高潮ピーク」を書き分ける
  for (const q of quant.filter((q) => q.propertyType === "高潮基準超過" && (q.attrType === "潮位" || q.attrType === "最高潮位"))) {
    const area = q.areaName ? `[${q.areaName}] ` : "";
    const timeHint = formatJstTimeHint(q.time);
    const suffix = timeHint ? `（${timeHint}頃到達）` : "";
    lines.push(`・${area}警報級到達時の潮位 ${q.value}${q.unit}${suffix}`);
  }
  for (const q of quant.filter((q) => q.propertyType === "高潮ピーク" && (q.attrType === "潮位" || q.attrType === "最高潮位"))) {
    const area = q.areaName ? `[${q.areaName}] ` : "";
    const timeHint = formatJstTimeHint(q.time);
    const suffix = timeHint ? `（${timeHint}頃ピーク）` : "";
    lines.push(`・${area}最高潮位 ${q.value}${q.unit}${suffix}`);
  }
  // 上記 propertyType が空のレガシー互換: propertyType 未指定で attrType="潮位" のものを救済
  for (const q of quant.filter((q) => !q.propertyType && (q.attrType === "潮位" || q.attrType === "最高潮位"))) {
    const area = q.areaName ? `[${q.areaName}] ` : "";
    lines.push(`・${area}${q.attrType} ${q.value}${q.unit}`);
  }

  // 降雪量（VPWW60）— 複数 type 並列の場合は最大値 1 件のみ採用
  const snows = quant.filter((q) => q.attrType.includes("降雪量"));
  if (snows.length > 0) {
    const best = snows.reduce((acc, cur) => {
      const a = parseFloat(acc.value);
      const c = parseFloat(cur.value);
      return isFinite(c) && (!isFinite(a) || c > a) ? cur : acc;
    });
    const area = best.areaName ? `[${best.areaName}] ` : "";
    lines.push(`・${area}${best.attrType} ${best.value}${best.unit}`);
  }

  // 視程（VPWW61 濃霧）
  for (const q of quant.filter((q) => q.attrType === "視程")) {
    const area = q.areaName ? `[${q.areaName}] ` : "";
    const suffix = q.condition === "以下" ? "以下" : "";
    lines.push(`・${area}視程 ${q.value}${q.unit}${suffix}`);
  }

  // 湿度（VPWW61 乾燥）— 実効・最小を 1 行に
  const hums = quant.filter((q) => q.attrType === "実効湿度" || q.attrType === "最小湿度");
  if (hums.length > 0) {
    const parts = hums.map((h) => `${h.attrType} ${h.value}${h.unit}`);
    lines.push(`・${parts.join("、")}`);
  }

  // 付加事項を最後の行末に追記
  if (additionSuffix && lines.length > 0) {
    lines[lines.length - 1] += additionSuffix;
  } else if (additionSuffix) {
    lines.push(`・付加事項${additionSuffix}`);
  }

  return lines;
}

/**
 * CriteriaPeriod（警戒レベル到達予想期間）を本文行に整形する。
 * 同一 Sentence は重複除去。Sentence は電文が全角数字を含んでいてもそのまま使う
 * （仕様準拠の自然文を優先）。
 */
function formatCriteriaPeriods(periods: CriteriaPeriod[]): string[] {
  if (periods.length === 0) return [];
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const p of periods) {
    if (!p.sentence) continue;
    if (seen.has(p.sentence)) continue;
    seen.add(p.sentence);
    lines.push(`・${p.sentence}`);
  }
  return lines;
}

/**
 * ISO8601 文字列から「N日HH時」相当の簡潔な JST 時刻ヒントを返す。
 * 文字列を直接読むだけで、タイムゾーン変換は行わない（電文の Time は +09:00 固定のため）。
 */
function formatJstTimeHint(iso: string | undefined): string {
  if (!iso) return "";
  const m = iso.match(/-(\d{2})T(\d{2}):/);
  if (!m) return "";
  return `${parseInt(m[1], 10)}日${parseInt(m[2], 10)}時`;
}

// ============================================================
// ユーティリティ
// ============================================================

function formatMunicipalityList(names: string[]): string {
  if (names.length === 0) return "（市町村情報なし）";
  const head = names.slice(0, MAX_MUNICIPALITY_LIST).join("、");
  const rest = names.length > MAX_MUNICIPALITY_LIST
    ? `、ほか${names.length - MAX_MUNICIPALITY_LIST}市町村`
    : "";
  return head + rest;
}

function toUtcIso(isoLocal: string): string {
  if (!isoLocal) return "";
  const d = new Date(isoLocal);
  return isNaN(d.getTime()) ? isoLocal : d.toISOString();
}

function buildTags(args: {
  phenomenon: Phenomenon;
  value: Exclude<BsafValue, null>;
  timeUtc: string;
  target: string;
}): string[] {
  return [
    "bsaf:v1",
    `type:${PHENOMENON_TO_BSAF_TYPE[args.phenomenon]}`,
    `value:${args.value}`,
    `time:${args.timeUtc}`,
    `target:${args.target}`,
    "source:jma",
  ];
}

// ============================================================
// テスト用 export（型のみ）
// ============================================================

export type { PhenomenonAggregate, CancellationAggregate };

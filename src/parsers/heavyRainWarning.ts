/**
 * src/parsers/heavyRainWarning.ts
 * 大雨警戒レベル情報（VPWW55/56/57/58）パーサー
 *
 * 2026年5月28日 防災気象情報体系整理対応
 * 旧VPRN50（大雨危険度通知）廃止に伴う新電文対応。
 *
 * 出典: 気象庁防災情報XMLフォーマット https://www.data.jma.go.jp/developer/xml/
 *
 * BSAFポリシー: 情報は可能な限り多く提供し、取捨選択はクライアント利用者の判断に委ねる。
 *               したがって Lv2〜Lv5＋解除 すべてを抽出する。
 */

import { XMLParser } from "fast-xml-parser";

// ============================================================
// 型定義
// ============================================================

export type WarningLevel =
  | "level2"  // 注意報相当
  | "level3"  // 警報相当
  | "level4"  // 危険警報相当（キキクルLv4 / 旧土砂災害警戒情報相当）
  | "level5"; // 特別警報相当（キキクルLv5）

export type WarningType =
  | "heavy-rain"    // 大雨 (VPWW55)
  | "landslide"     // 土砂災害 (VPWW56)
  | "storm-surge"   // 高潮 (VPWW57)
  | "flood";        // 洪水・氾濫 (VPWW58)

export type ItemStatus = "発表" | "解除" | "継続";
export type InfoType = "発表" | "訂正" | "取消";
export type TelegramStatus = "通常" | "訓練" | "試験";

export interface WarningArea {
  /** 市町村等名 例: "函館市" */
  name: string;
  /** 市町村等コード（6桁） 例: "011002" */
  code: string;
}

export interface WarningItem {
  kindName: string;      // 例: "大雨危険警報"
  kindCode: string;      // 例: "14"
  level: WarningLevel;
  status: ItemStatus;
  areas: WarningArea[];
}

export interface ParsedHeavyRainWarning {
  /** 電文タイトル（Control/Title） */
  title: string;
  /** 発信ステータス（訓練・試験は弊機内でスキップ） */
  telegramStatus: TelegramStatus;
  /** 発信官署名 */
  editorialOffice: string;
  /** 電文発信日時 UTC ISO8601 */
  issuedAtUtc: string;

  /** 情報種別 */
  infoType: InfoType;
  /** 発表日時 ISO8601（タイムゾーン付き） */
  reportDateTime: string;
  /** 見出し文 */
  headlineText: string;

  /** 警報種別（VPWW55〜58 / 電文タイトルから判定） */
  warningType: WarningType;

  /** 全Itemリスト */
  items: WarningItem[];

  /** Lv2 発表中エリア（status !== "解除"） */
  level2Areas: WarningArea[];
  /** Lv3 発表中エリア */
  level3Areas: WarningArea[];
  /** Lv4 発表中エリア（旧: 土砂災害警戒情報相当） */
  level4Areas: WarningArea[];
  /** Lv5 発表中エリア（特別警報相当） */
  level5Areas: WarningArea[];
  /** 解除エリア（status === "解除"） */
  cancelledAreas: WarningArea[];
}

// ============================================================
// コード → 警戒レベル マッピング
// 出典: 気象庁防災情報XMLフォーマット解説資料 VPWW55〜58
// ============================================================

const CODE_TO_LEVEL: Record<string, WarningLevel> = {
  // ── 大雨 (VPWW55) ──
  "02": "level2",  // 大雨注意報
  "03": "level3",  // 大雨警報
  "14": "level4",  // 大雨危険警報
  "15": "level5",  // 大雨特別警報

  // ── 土砂災害 (VPWW56) ──
  // 注意報コードは大雨と共用想定
  "16": "level4",  // 土砂災害危険警報（旧: 土砂災害警戒情報相当）
  "17": "level5",  // 土砂災害特別警報

  // ── 高潮 (VPWW57) ──
  "09": "level2",  // 高潮注意報
  "10": "level3",  // 高潮警報
  "18": "level4",  // 高潮危険警報
  "19": "level5",  // 高潮特別警報

  // ── 洪水・氾濫 (VPWW58) ──
  "11": "level2",  // 洪水注意報
  "04": "level3",  // 洪水警報 / 氾濫警報
  "20": "level4",  // 氾濫危険警報
  "21": "level5",  // 氾濫特別警報
};

// ============================================================
// 電文タイトル → WarningType 判定
// ============================================================

function detectWarningType(headTitle: string): WarningType {
  if (headTitle.includes("土砂")) return "landslide";
  if (headTitle.includes("高潮")) return "storm-surge";
  if (headTitle.includes("洪水") || headTitle.includes("氾濫")) return "flood";
  return "heavy-rain";
}

// ============================================================
// XMLパーサー設定
// ============================================================

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) =>
    ["Item", "Area", "Information", "Kind", "Areas"].includes(name),
  parseTagValue: false,
  trimValues: true,
});

// ============================================================
// メインパーサー関数
// ============================================================

/**
 * VPWW55/56/57/58 XML 文字列をパースして構造化データを返す。
 *
 * @param xmlString - 電文XML文字列（UTF-8）
 * @returns ParsedHeavyRainWarning | null（パース失敗または訓練/試験電文）
 */
export function parseHeavyRainWarningXml(
  xmlString: string
): ParsedHeavyRainWarning | null {
  let raw: any;
  try {
    raw = xmlParser.parse(xmlString);
  } catch (e) {
    console.error("[HeavyRain] XMLパースエラー:", e);
    return null;
  }

  const report = raw?.Report;
  if (!report) {
    console.warn("[HeavyRain] <Report>要素が見つかりません");
    return null;
  }

  const control = report.Control ?? {};
  const head    = report.Head    ?? {};
  const body    = report.Body    ?? {};

  // ── 訓練・試験電文はスキップ ──
  const telegramStatus = (control.Status ?? "通常") as TelegramStatus;
  if (telegramStatus !== "通常") {
    console.info(`[HeavyRain] スキップ（${telegramStatus}電文）`);
    return null;
  }

  // ── Head 解析 ──
  const headTitle: string = head.Title ?? "";
  const warningType = detectWarningType(headTitle);
  const infoType: InfoType = (head.InfoType ?? "発表") as InfoType;
  const reportDateTime: string = head.ReportDateTime ?? "";
  const headlineText: string = head.Headline?.Text ?? "";

  // ── Body: Warning Items 解析 ──
  const warningBlock = body.Warning;
  const rawItems: any[] = warningBlock?.Item ?? [];

  const items: WarningItem[] = rawItems
    .map((item: any): WarningItem | null => {
      const kindArr: any[] = item.Kind ?? [];
      const kind = Array.isArray(kindArr) ? kindArr[0] : kindArr;
      if (!kind) return null;

      const kindCode = String(kind.Code ?? "");
      const kindName = String(kind.Name ?? "");
      const itemStatus: ItemStatus =
        (kind.Status as ItemStatus) ?? "発表";
      const level: WarningLevel =
        CODE_TO_LEVEL[kindCode] ?? "level2";

      const areasWrapper: any[] = item.Areas ?? [];
      const areasObj = Array.isArray(areasWrapper)
        ? areasWrapper[0]
        : areasWrapper;
      const rawAreas: any[] = areasObj?.Area ?? [];

      const areas: WarningArea[] = rawAreas.map((a: any) => ({
        name: String(a.Name ?? ""),
        code: String(a.Code ?? ""),
      }));

      return { kindName, kindCode, level, status: itemStatus, areas };
    })
    .filter((x): x is WarningItem => x !== null);

  // ── レベル別エリア抽出（status !== "解除"）──
  const collectActive = (level: WarningLevel) =>
    dedupeAreas(
      items
        .filter((i) => i.level === level && i.status !== "解除")
        .flatMap((i) => i.areas)
    );

  const level2Areas = collectActive("level2");
  const level3Areas = collectActive("level3");
  const level4Areas = collectActive("level4");
  const level5Areas = collectActive("level5");

  // ── 解除エリア（status === "解除"）──
  const cancelledAreas = dedupeAreas(
    items
      .filter((i) => i.status === "解除")
      .flatMap((i) => i.areas)
  );

  return {
    title: control.Title ?? headTitle,
    telegramStatus,
    editorialOffice: control.EditorialOffice ?? "",
    issuedAtUtc: control.DateTime ?? "",
    infoType,
    reportDateTime,
    headlineText,
    warningType,
    items,
    level2Areas,
    level3Areas,
    level4Areas,
    level5Areas,
    cancelledAreas,
  };
}

// ============================================================
// ユーティリティ
// ============================================================

/** エリアコードで重複除去 */
function dedupeAreas(areas: WarningArea[]): WarningArea[] {
  return [...new Map(areas.map((a) => [a.code, a])).values()];
}

/** Lv2〜Lv5 のいずれかが発表中か */
export function hasAnyActiveWarning(parsed: ParsedHeavyRainWarning): boolean {
  return (
    parsed.level2Areas.length > 0 ||
    parsed.level3Areas.length > 0 ||
    parsed.level4Areas.length > 0 ||
    parsed.level5Areas.length > 0
  );
}

/** 高レベル（Lv4/Lv5）が発表中か */
export function hasHighLevelWarning(parsed: ParsedHeavyRainWarning): boolean {
  return parsed.level4Areas.length > 0 || parsed.level5Areas.length > 0;
}

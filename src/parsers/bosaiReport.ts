/**
 * src/parsers/bosaiReport.ts
 * 府県気象防災速報（VPBS50）XML パーサー
 *
 * 出典: 気象庁防災情報XMLフォーマット「気象防災速報」解説資料
 *
 * VPBS50 は複数のサブ種別を集約する電文（InfoKind="気象解説情報"）:
 *   - 顕著な大雨に関する情報（線状降水帯 発生／直前予測）
 *   - 顕著な大雪に関する情報
 *   - 記録的短時間大雨情報
 *   - 短文形式の気象情報
 * サブ種別は Head/Title の括弧内（例: "東京都気象防災速報（線状降水帯直前予測）"）で判別する。
 * 本文は Head/Headline/Text（自然文）をそのまま用いる。
 * 対象都道府県は Body の細分区域コード（先頭2桁）から導出する。
 */

import { XMLParser } from "fast-xml-parser";

export type TelegramStatus = "通常" | "訓練" | "試験";
export type InfoType = "発表" | "訂正" | "取消";

export interface ParsedBosaiReport {
  /** Control/Title（"府県気象防災速報"） */
  controlTitle: string;
  /** 運用種別 */
  telegramStatus: TelegramStatus;
  /** Head/Title（例: "東京都気象防災速報（線状降水帯直前予測）"） */
  headTitle: string;
  /** サブ種別（Head/Title 括弧内、例: "線状降水帯直前予測", "記録的短時間大雨"） */
  subKind: string;
  /** 発表官署（Control/PublishingOffice） */
  publishingOffice: string;
  /** 情報形態（発表/訂正/取消） */
  infoType: InfoType;
  /** 発表時刻 JST ISO8601 */
  reportDateTime: string;
  /** 見出し文（本文として使用する自然文） */
  headlineText: string;
  /** 対象細分区域名（例: ["伊豆諸島南部"]） */
  areaNames: string[];
  /** 対象細分区域コード（例: ["130030"]、先頭2桁が都道府県コード） */
  areaCodes: string[];
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) =>
    ["MeteorologicalInfos", "MeteorologicalInfo", "Item", "Kind", "Area"].includes(name),
  parseTagValue: false,
  trimValues: true,
});

/**
 * VPBS50 XML 文字列をパースして構造化データを返す。訓練・試験電文は null。
 */
export function parseBosaiReportXml(xmlString: string): ParsedBosaiReport | null {
  let raw: any;
  try {
    raw = xmlParser.parse(xmlString);
  } catch (e) {
    console.error("[Bosai] XMLパースエラー:", e);
    return null;
  }

  const report = raw?.Report;
  if (!report) {
    console.warn("[Bosai] <Report>要素が見つかりません");
    return null;
  }

  const control = report.Control ?? {};
  const head = report.Head ?? {};
  const body = report.Body ?? {};

  const telegramStatus = (control.Status ?? "通常") as TelegramStatus;
  if (telegramStatus !== "通常") {
    console.info(`[Bosai] スキップ（${telegramStatus}電文）`);
    return null;
  }

  const headTitle = String(head.Title ?? "");
  const subKind = extractSubKind(headTitle);

  const { names, codes } = extractAreas(body);

  return {
    controlTitle: String(control.Title ?? ""),
    telegramStatus,
    headTitle,
    subKind,
    publishingOffice: String(control.PublishingOffice ?? ""),
    infoType: (head.InfoType ?? "発表") as InfoType,
    reportDateTime: String(head.ReportDateTime ?? ""),
    headlineText: String(head.Headline?.Text ?? ""),
    areaNames: names,
    areaCodes: codes,
  };
}

/** Head/Title の括弧内サブ種別を抽出する（"○○気象防災速報（線状降水帯直前予測）" → "線状降水帯直前予測"）。 */
function extractSubKind(headTitle: string): string {
  const m = headTitle.match(/[（(]([^）)]+)[）)]/);
  return m ? m[1].trim() : "";
}

/** Body 配下の細分区域 Area（Name/Code）を収集する。 */
function extractAreas(body: any): { names: string[]; codes: string[] } {
  const names: string[] = [];
  const codes: string[] = [];
  const seen = new Set<string>();

  const infosArr: any[] = body?.MeteorologicalInfos ?? [];
  for (const infos of infosArr) {
    const infoArr: any[] = infos?.MeteorologicalInfo ?? [];
    for (const info of infoArr) {
      const itemArr: any[] = info?.Item ?? [];
      for (const item of itemArr) {
        const areaArr: any[] = item?.Area ?? [];
        for (const area of areaArr) {
          const name = String(area.Name ?? "");
          const code = String(area.Code ?? "");
          if (!code || seen.has(code)) continue;
          seen.add(code);
          names.push(name);
          codes.push(code);
        }
      }
    }
  }

  return { names, codes };
}

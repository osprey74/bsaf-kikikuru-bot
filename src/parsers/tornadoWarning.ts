/**
 * src/parsers/tornadoWarning.ts
 * 竜巻注意情報（VPHW50/51）XML パーサー
 *
 * 出典: 気象庁防災情報XMLフォーマット「竜巻注意情報」解説資料
 *
 * bsaf-jma-bot からの移管対象。Head/Title に都道府県名を含み（例:
 * "神奈川県気象防災速報（竜巻注意）"）、Head/Headline/Text が自己完結した平文。
 */

import { XMLParser } from "fast-xml-parser";

export type TelegramStatus = "通常" | "訓練" | "試験";
export type InfoType = "発表" | "訂正" | "取消";

export interface ParsedTornadoWarning {
  controlTitle: string;
  telegramStatus: TelegramStatus;
  /** Head/Title（例: "神奈川県気象防災速報（竜巻注意）"） */
  headTitle: string;
  infoType: InfoType;
  reportDateTime: string;
  /** 本文（Head/Headline/Text） */
  headlineText: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

/** VPHW50/51 XML をパース。訓練・試験・取消電文は null。 */
export function parseTornadoWarningXml(xmlString: string): ParsedTornadoWarning | null {
  let raw: any;
  try {
    raw = xmlParser.parse(xmlString);
  } catch (e) {
    console.error("[Tornado] XMLパースエラー:", e);
    return null;
  }

  const report = raw?.Report;
  if (!report) return null;
  const control = report.Control ?? {};
  const head = report.Head ?? {};

  const telegramStatus = (control.Status ?? "通常") as TelegramStatus;
  if (telegramStatus !== "通常") {
    console.info(`[Tornado] スキップ（${telegramStatus}電文）`);
    return null;
  }

  const infoType = (head.InfoType ?? "発表") as InfoType;
  if (infoType === "取消") {
    console.info("[Tornado] 取消電文のためスキップ");
    return null;
  }

  const headlineText = String(head.Headline?.Text ?? "");
  if (!headlineText) return null;

  return {
    controlTitle: String(control.Title ?? ""),
    telegramStatus,
    headTitle: String(head.Title ?? ""),
    infoType,
    reportDateTime: String(head.ReportDateTime ?? ""),
    headlineText,
  };
}

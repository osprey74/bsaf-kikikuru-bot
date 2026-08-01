/**
 * src/parsers/weatherInfo.ts
 * 府県気象情報（VPFJ50、気象解説情報＝同一現象用平文情報）XML パーサー
 *
 * 出典: 気象庁防災情報XMLフォーマット「気象情報」解説資料
 *
 * VPFJ50 は都道府県単位の平文（narrative）情報。構造化された区域コードを持たず、
 * Head/Title（例: "岩手県気象解説情報（大雨・落雷）"）と Head/Headline/Text（本文）のみ。
 * - 都道府県名は Head/Title の接頭辞から抽出する。
 * - 見出し種別（大雨・落雷 等）は Head/Title の括弧内から抽出する。
 */

import { XMLParser } from "fast-xml-parser";

export type TelegramStatus = "通常" | "訓練" | "試験";
export type InfoType = "発表" | "訂正" | "取消";

export interface ParsedWeatherInfo {
  /** Control/Title（"府県気象情報"） */
  controlTitle: string;
  telegramStatus: TelegramStatus;
  /** Head/Title（例: "岩手県気象解説情報（大雨・落雷）"） */
  headTitle: string;
  /** 都道府県名（Head/Title 接頭辞、例: "岩手県"）。北海道細分等で不明な場合は ""。 */
  prefName: string;
  /** 見出し種別（Head/Title 括弧内、例: "大雨・落雷"） */
  topic: string;
  infoType: InfoType;
  /** 発表時刻 JST ISO8601 */
  reportDateTime: string;
  /** 本文（Head/Headline/Text の平文） */
  headlineText: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseTagValue: false,
  trimValues: true,
});

/**
 * VPFJ50 XML 文字列をパースして構造化データを返す。訓練・試験電文は null。
 */
export function parseWeatherInfoXml(xmlString: string): ParsedWeatherInfo | null {
  let raw: any;
  try {
    raw = xmlParser.parse(xmlString);
  } catch (e) {
    console.error("[WxInfo] XMLパースエラー:", e);
    return null;
  }

  const report = raw?.Report;
  if (!report) {
    console.warn("[WxInfo] <Report>要素が見つかりません");
    return null;
  }
  const control = report.Control ?? {};
  const head = report.Head ?? {};

  const telegramStatus = (control.Status ?? "通常") as TelegramStatus;
  if (telegramStatus !== "通常") {
    console.info(`[WxInfo] スキップ（${telegramStatus}電文）`);
    return null;
  }

  const headTitle = String(head.Title ?? "");
  const headlineText = String(head.Headline?.Text ?? "");
  if (!headlineText) {
    console.info("[WxInfo] 本文が空のためスキップ");
    return null;
  }

  return {
    controlTitle: String(control.Title ?? ""),
    telegramStatus,
    headTitle,
    prefName: extractPrefName(headTitle),
    topic: extractTopic(headTitle),
    infoType: (head.InfoType ?? "発表") as InfoType,
    reportDateTime: String(head.ReportDateTime ?? ""),
    headlineText,
  };
}

/** "岩手県気象解説情報（…）" → "岩手県"。抽出できなければ ""。 */
function extractPrefName(headTitle: string): string {
  const m = headTitle.match(/^(.+?)気象(?:解説)?情報/);
  return m ? m[1].trim() : "";
}

/** "…（大雨・落雷）" → "大雨・落雷"。無ければ ""。 */
function extractTopic(headTitle: string): string {
  const m = headTitle.match(/[（(]([^）)]+)[）)]/);
  return m ? m[1].trim() : "";
}

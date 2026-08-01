/**
 * src/parsers/landslideAlert.ts
 * 土砂災害警戒情報（VXWW50）XML パーサー
 *
 * 出典: 気象庁防災情報XMLフォーマット「土砂災害警戒情報」解説資料
 *
 * bsaf-jma-bot からの移管対象。都道府県＋気象台の共同発表（警戒レベル4相当）。
 * Head/Title に都道府県名（例: "岩手県レベル４土砂災害危険警報"）、
 * Head/Headline/Information[@type="土砂災害警戒情報"] に対象市町村と警戒/解除の別を持つ。
 * （R06 の VPWW56 土砂とは別電文のため、BSAF 情報配信原則に基づき別途配信する）
 */

import { XMLParser } from "fast-xml-parser";

export type TelegramStatus = "通常" | "訓練" | "試験";
export type InfoType = "発表" | "訂正" | "取消";

export interface LandslideMunicipality {
  name: string;
  code: string;
}

export interface ParsedLandslideAlert {
  controlTitle: string;
  telegramStatus: TelegramStatus;
  /** Head/Title（例: "岩手県レベル４土砂災害危険警報"） */
  headTitle: string;
  infoType: InfoType;
  reportDateTime: string;
  /** 状態: 発表（警戒）/ 解除 */
  status: "発表" | "解除";
  /** 対象市町村 */
  municipalities: LandslideMunicipality[];
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => ["Information", "Item", "Kind", "Area"].includes(name),
  parseTagValue: false,
  trimValues: true,
});

function toArr(v: any): any[] {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}

/** VXWW50 XML をパース。訓練・試験電文は null。 */
export function parseLandslideAlertXml(xmlString: string): ParsedLandslideAlert | null {
  let raw: any;
  try {
    raw = xmlParser.parse(xmlString);
  } catch (e) {
    console.error("[Landslide] XMLパースエラー:", e);
    return null;
  }

  const report = raw?.Report;
  if (!report) return null;
  const control = report.Control ?? {};
  const head = report.Head ?? {};

  const telegramStatus = (control.Status ?? "通常") as TelegramStatus;
  if (telegramStatus !== "通常") {
    console.info(`[Landslide] スキップ（${telegramStatus}電文）`);
    return null;
  }

  const infoArr: any[] = head.Headline?.Information ?? [];
  const info = infoArr.find((i) => String(i?.["@_type"] ?? "").includes("土砂災害警戒情報"));

  const municipalities: LandslideMunicipality[] = [];
  let isCancel = false;
  const seen = new Set<string>();

  for (const item of toArr(info?.Item)) {
    for (const kind of toArr(item.Kind)) {
      const name = String(kind.Name ?? "");
      if (name.includes("解除")) isCancel = true;
    }
    // Area は Item 直下または Item/Areas 配下
    const areas = [...toArr(item.Area), ...toArr(item.Areas?.Area)];
    for (const a of areas) {
      const name = String(a.Name ?? "");
      const code = String(a.Code ?? "");
      if (!code || seen.has(code)) continue;
      seen.add(code);
      municipalities.push({ name, code });
    }
  }

  return {
    controlTitle: String(control.Title ?? ""),
    telegramStatus,
    headTitle: String(head.Title ?? ""),
    infoType: (head.InfoType ?? "発表") as InfoType,
    reportDateTime: String(head.ReportDateTime ?? ""),
    status: isCancel ? "解除" : "発表",
    municipalities,
  };
}

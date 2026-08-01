/**
 * src/parsers/typhoon.ts
 * 台風解析・予報情報（VPTW60、Ｈ３０ 5日予報）XML パーサー
 *
 * 出典: 気象庁防災情報XMLフォーマット「台風解析・予報情報」解説資料
 *
 * 設計判断:
 * - 「実況」（DateTime type="実況"）の台風本体情報のみを対象とする。
 *   予報（各予報時刻の位置・強さ）は本 Bot では投稿しない。
 * - 台風本体の呼称・階級・中心・風を Item/Kind/Property から抽出する。
 * - jmx_eb: 名前空間要素は fast-xml-parser が `jmx_eb:XXX` キーで保持する。
 *   同名要素が単位違いで複数並ぶ（ノット/m/s、海里/km 等）ため属性で選別する。
 */

import { XMLParser } from "fast-xml-parser";

export type TelegramStatus = "通常" | "訓練" | "試験";
export type InfoType = "発表" | "訂正" | "取消";

export interface ParsedTyphoon {
  controlTitle: string;
  telegramStatus: TelegramStatus;
  infoType: InfoType;
  /** 発表時刻 JST ISO8601 */
  reportDateTime: string;
  /** 実況日時 JST ISO8601（DateTime type="実況"） */
  analysisDateTime: string;
  /** 台風番号（例: "2613" = 2026年台風第13号） */
  number: string;
  /** 国際名（例: "DOLPHIN"） */
  name: string;
  /** 国際名カナ（例: "ドルフィン"） */
  nameKana: string;
  /** 熱帯擾乱種類（例: "台風(TY)", "熱帯低気圧(TD)"） */
  typhoonClass: string;
  /** 強さ階級（例: "非常に強い", "強い", "猛烈な", ""） */
  intensityClass: string;
  /** 大きさ階級（例: "大型", "超大型", ""） */
  areaClass: string;
  /** 中心位置の地名（例: "南鳥島近海"） */
  location: string;
  /** 移動方向（例: "西北西"） */
  direction: string;
  /** 移動速度 km/h（例: "20"、"ほとんど停滞" 等の非数値もそのまま） */
  speedKmh: string;
  /** 中心気圧 hPa（例: "925"） */
  pressureHpa: string;
  /** 中心付近の最大風速 m/s（例: "50"） */
  maxWindMs: string;
  /** 最大瞬間風速 m/s（例: "70"） */
  maxGustMs: string;
  /** 暴風域の最大半径 km（例: "150"、無ければ ""） */
  stormRadiusKm: string;
  /** 強風域の最大半径 km（例: "500"、無ければ ""） */
  galeRadiusKm: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) =>
    ["MeteorologicalInfos", "MeteorologicalInfo", "Item", "Kind", "WarningAreaPart"].includes(name),
  parseTagValue: false,
  trimValues: true,
});

// ---- 汎用ヘルパー ----

function toArr(v: any): any[] {
  return Array.isArray(v) ? v : v == null ? [] : [v];
}
function text(v: any): string {
  if (v == null) return "";
  if (typeof v === "object") return String(v["#text"] ?? "");
  return String(v);
}
function attr(v: any, a: string): string {
  return v && typeof v === "object" ? String(v[`@_${a}`] ?? "") : "";
}
/** 単位属性が unit に一致する要素のテキストを返す */
function pickByUnit(v: any, unit: string): string {
  for (const e of toArr(v)) {
    if (attr(e, "unit") === unit) return text(e);
  }
  return "";
}

/**
 * VPTW60 XML 文字列をパースして構造化データを返す。訓練・試験電文は null。
 */
export function parseTyphoonXml(xmlString: string): ParsedTyphoon | null {
  let raw: any;
  try {
    raw = xmlParser.parse(xmlString);
  } catch (e) {
    console.error("[Typhoon] XMLパースエラー:", e);
    return null;
  }

  const report = raw?.Report;
  if (!report) {
    console.warn("[Typhoon] <Report>要素が見つかりません");
    return null;
  }
  const control = report.Control ?? {};
  const head = report.Head ?? {};
  const body = report.Body ?? {};

  const telegramStatus = (control.Status ?? "通常") as TelegramStatus;
  if (telegramStatus !== "通常") {
    console.info(`[Typhoon] スキップ（${telegramStatus}電文）`);
    return null;
  }

  // 「実況」の MeteorologicalInfo を探す
  const info = findAnalysisInfo(body);
  if (!info) {
    console.info("[Typhoon] 実況情報が見つかりません（予報のみ等）、スキップ");
    return null;
  }

  const result: ParsedTyphoon = {
    controlTitle: String(control.Title ?? ""),
    telegramStatus,
    infoType: (head.InfoType ?? "発表") as InfoType,
    reportDateTime: String(head.ReportDateTime ?? ""),
    analysisDateTime: text(info.DateTime),
    number: "",
    name: "",
    nameKana: "",
    typhoonClass: "",
    intensityClass: "",
    areaClass: "",
    location: "",
    direction: "",
    speedKmh: "",
    pressureHpa: "",
    maxWindMs: "",
    maxGustMs: "",
    stormRadiusKm: "",
    galeRadiusKm: "",
  };

  for (const item of toArr(info.Item)) {
    for (const kind of toArr(item.Kind)) {
      const prop = kind.Property;
      if (!prop) continue;
      extractProperty(prop, result);
    }
  }

  // 台風番号も中心情報も取れない場合は投稿価値なしと判断
  if (!result.number && !result.pressureHpa && !result.location) return null;

  return result;
}

/** DateTime type="実況" を持つ MeteorologicalInfo を返す。 */
function findAnalysisInfo(body: any): any {
  for (const infos of toArr(body.MeteorologicalInfos)) {
    for (const info of toArr(infos.MeteorologicalInfo)) {
      if (attr(info.DateTime, "type") === "実況") return info;
    }
  }
  // フォールバック: 最初の MeteorologicalInfo
  const firstInfos = toArr(body.MeteorologicalInfos)[0];
  return firstInfos ? toArr(firstInfos.MeteorologicalInfo)[0] ?? null : null;
}

function extractProperty(prop: any, out: ParsedTyphoon): void {
  const type = String(prop.Type ?? "");

  if (type === "呼称" && prop.TyphoonNamePart) {
    const p = prop.TyphoonNamePart;
    out.name = String(p.Name ?? "");
    out.nameKana = String(p.NameKana ?? "");
    out.number = String(p.Number ?? "");
  } else if (type === "階級" && prop.ClassPart) {
    const p = prop.ClassPart;
    out.typhoonClass = text(p["jmx_eb:TyphoonClass"]);
    out.intensityClass = text(p["jmx_eb:IntensityClass"]);
    out.areaClass = text(p["jmx_eb:AreaClass"]);
  } else if (type === "中心" && prop.CenterPart) {
    const p = prop.CenterPart;
    out.location = String(p.Location ?? "");
    out.direction = text(p["jmx_eb:Direction"]);
    out.speedKmh = pickByUnit(p["jmx_eb:Speed"], "km/h");
    out.pressureHpa = pickByUnit(p["jmx_eb:Pressure"], "hPa");
  } else if (type === "風" && prop.WindPart) {
    const wp = prop.WindPart;
    const winds = toArr(wp["jmx_eb:WindSpeed"]);
    out.maxWindMs = pickWind(winds, "最大風速", "m/s");
    out.maxGustMs = pickWind(winds, "最大瞬間風速", "m/s");
    // 暴風域・強風域の半径（km、最大値）
    for (const wa of toArr(prop.WarningAreaPart)) {
      const kind = attr(wa, "type"); // 暴風域 / 強風域
      const km = maxRadiusKm(wa);
      if (kind === "暴風域") out.stormRadiusKm = km;
      else if (kind === "強風域") out.galeRadiusKm = km;
    }
  }
}

/** WindSpeed 配列から type と unit の一致する値を返す。 */
function pickWind(winds: any[], typeVal: string, unit: string): string {
  for (const w of winds) {
    if (attr(w, "type") === typeVal && attr(w, "unit") === unit) return text(w);
  }
  return "";
}

/** WarningAreaPart 配下の Circle/Axes/Axis/Radius（km）の最大値を返す。 */
function maxRadiusKm(wa: any): string {
  const axes = wa?.["jmx_eb:Circle"]?.["jmx_eb:Axes"];
  const axisArr = toArr(axes?.["jmx_eb:Axis"]);
  let max = -1;
  for (const axis of axisArr) {
    for (const r of toArr(axis?.["jmx_eb:Radius"])) {
      if (attr(r, "unit") === "km") {
        const n = parseFloat(text(r));
        if (isFinite(n) && n > max) max = n;
      }
    }
  }
  return max >= 0 ? String(max) : "";
}

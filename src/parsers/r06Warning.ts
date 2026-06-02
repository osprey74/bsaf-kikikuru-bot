/**
 * src/parsers/r06Warning.ts
 * 新気象警報・注意報（Ｒ０６）VPWW55〜61 XML パーサー
 *
 * 出典: 気象庁防災情報XMLフォーマット解説資料
 *       「気象警報・注意報（Ｒ０６）_解説資料.pdf」（令和8年4月30日版）
 *
 * 重要な設計判断:
 * - 投稿対象は Body/Warning[@type="気象警報・注意報（市町村等）"] を主データソースとする
 * - 警戒レベルは Item/Kind/Property/SignificancyPart/Base/Significancy/Code で取得
 * - 量的予想要素（風速・波高・視程等）も同 Property 配下から取得
 * - 1 つの Item に複数 Kind が並列出現しうる（特に VPWW61）
 */

import { XMLParser } from "fast-xml-parser";

// ============================================================
// 型定義
// ============================================================

export type TelegramStatus = "通常" | "訓練" | "試験";
export type InfoType = "発表" | "訂正" | "取消";

/**
 * Kind/Status のとりうる値（仕様書 3-2-4-1-1-1 解説 3）。
 * 文字列直値で扱い、解釈はマッパー側に委ねる。
 */
export type KindStatus =
  | "発表"
  | "継続"
  | "解除"
  | "発表警報・注意報はなし"
  | "特別警報から危険警報"
  | "特別警報から警報"
  | "特別警報から注意報"
  | "危険警報から警報"
  | "危険警報から注意報"
  | "警報から注意報"
  | string;

/** 量的予想（風速・波高・視程・潮位・降雪量・湿度等） */
export interface QuantitativeForecast {
  /** Property/Type の値（例: "風", "波", "濃霧", "乾燥", "雪", "高潮ピーク"） */
  propertyType: string;
  /** 計測値の種別属性（例: "最大風速", "波高", "視程", "実効湿度"） */
  attrType: string;
  /** 数値（例: "15", "5"）。文字列のまま保持。 */
  value: string;
  /** 単位（例: "m/s", "m", "cm", "%"） */
  unit: string;
  /** 表示用文字列（電文の description 属性そのまま）。例: "１５メートル" */
  description: string;
  /** condition 属性（"以下"/"値なし"/"風雪" 等） */
  condition?: string;
  /** 補助情報: 区域名（陸上/海上/内海/外海等） */
  areaName?: string;
  /** Base/Time の値（ISO8601、例: "2026-06-01T19:00:00+09:00"）。高潮ピーク等で出現。 */
  time?: string;
}

/** 警戒レベル到達予想期間（Property/CriteriaPeriod、Lv2-Lv3 で上位レベル到達見込み時に出現） */
export interface CriteriaPeriod {
  /** 期間の人間可読文（例: "１日１７時から２０時まで、警戒レベル４相当"） */
  sentence: string;
  /** 到達クラス名（例: "警戒レベル４相当"） */
  criteriaClassName: string;
  /** 到達クラスコード（別表 5、例: "41"） */
  criteriaClassCode: string;
  /** 開始時刻 ISO8601（例: "2026-06-01T17:00:00+09:00"） */
  time: string;
  /** 期間（ISO8601 duration、例: "PT3H"） */
  duration: string;
  /** どの Property に属するか（例: "高潮危険度"） */
  propertyType: string;
}

/** 危険度（Significancy） */
export interface Significancy {
  /** Significancy の type 属性（"風危険度"/"波危険度"/"大雨浸水危険度" 等） */
  type: string;
  /** Significancy/Name */
  name: string;
  /** Significancy/Code（"21","31","41","51","20","30","50","00","01","11" 等） */
  code: string;
  /** 補助情報: 区域名（高潮の水位基準地点等で出現） */
  areaName?: string;
}

/** 1つの Kind に対応する解析結果（同一 Item 内に複数並ぶ場合がある） */
export interface WarningKind {
  /** Kind/Name */
  name: string;
  /** Kind/Code（別表3 の値、"00"〜"49"） */
  code: string;
  /** Kind/Status */
  status: KindStatus;
  /** 付加事項（Kind/Addition/Note の値配列） */
  additions: string[];
  /** 危険度（Property/SignificancyPart/Base/Significancy）の集合 */
  significancies: Significancy[];
  /** 量的予想（Property/[WindSpeedPart|WaveHeightPart|VisibilityPart|...]） */
  quantitative: QuantitativeForecast[];
  /** 警戒レベル到達予想期間（Property/CriteriaPeriod） */
  criteriaPeriods: CriteriaPeriod[];
}

/** 市町村等レベルの Warning Item */
export interface MunicipalityWarningItem {
  /** 市町村等コード（7桁） */
  areaCode: string;
  /** 市町村等名 */
  areaName: string;
  /** Item に含まれる Kind 群（複数並列出現あり） */
  kinds: WarningKind[];
}

/** パース結果 */
export interface ParsedR06Warning {
  /** Control/Title（例: "気象警報・注意報（Ｒ０６）（暴風）"） */
  controlTitle: string;
  /** 電文発信日時 UTC ISO8601（Control/DateTime） */
  controlDateTimeUtc: string;
  /** 運用種別（通常/訓練/試験） */
  telegramStatus: TelegramStatus;
  /** 発表官署名 */
  editorialOffice: string;
  /** Head/Title（例: "上川・留萌地方暴風（雪）警報・注意報"） */
  headTitle: string;
  /** 発表時刻 JST ISO8601（Head/ReportDateTime、+09:00 付き） */
  reportDateTime: string;
  /** 情報形態（発表/訂正/取消） */
  infoType: InfoType;
  /** 見出し文 */
  headlineText: string;
  /** Body/Warning[@type="気象警報・注意報（市町村等）"] から抽出した市町村等単位の Item 群 */
  municipalityItems: MunicipalityWarningItem[];
}

// ============================================================
// XML パーサー設定
// ============================================================

const xmlParser = new XMLParser({
  ignoreAttributes:    false,
  attributeNamePrefix: "@_",
  // 注: Body/Warning/Item/Area と Head/Information/Item/Areas/Area は仕様上いずれも単一なので
  //     Area / Areas は isArray に含めない。
  isArray: (name) =>
    [
      "Item", "Kind", "Property", "Information", "Warning",
      "Note", "Local", "Significancy",
    ].includes(name),
  parseTagValue: false,
  trimValues:    true,
});

// ============================================================
// メインパーサー
// ============================================================

/**
 * VPWW55-61 XML 文字列をパースして構造化データを返す。
 * 訓練・試験電文は null を返す。
 */
export function parseR06WarningXml(xmlString: string): ParsedR06Warning | null {
  let raw: any;
  try {
    raw = xmlParser.parse(xmlString);
  } catch (e) {
    console.error("[R06] XMLパースエラー:", e);
    return null;
  }

  const report = raw?.Report;
  if (!report) {
    console.warn("[R06] <Report>要素が見つかりません");
    return null;
  }

  const control = report.Control ?? {};
  const head    = report.Head    ?? {};
  const body    = report.Body    ?? {};

  const telegramStatus = (control.Status ?? "通常") as TelegramStatus;
  if (telegramStatus !== "通常") {
    console.info(`[R06] スキップ（${telegramStatus}電文）`);
    return null;
  }

  // ── Body/Warning[@type="気象警報・注意報（市町村等）"] を抽出 ──
  const warningArr: any[] = Array.isArray(body.Warning)
    ? body.Warning
    : body.Warning != null
      ? [body.Warning]
      : [];

  const municipalityWarning = warningArr.find(
    (w) => w?.["@_type"] === "気象警報・注意報（市町村等）"
  );

  const municipalityItems: MunicipalityWarningItem[] =
    municipalityWarning ? extractMunicipalityItems(municipalityWarning) : [];

  return {
    controlTitle:       String(control.Title ?? ""),
    controlDateTimeUtc: String(control.DateTime ?? ""),
    telegramStatus,
    editorialOffice:    String(control.EditorialOffice ?? ""),
    headTitle:          String(head.Title ?? ""),
    reportDateTime:     String(head.ReportDateTime ?? ""),
    infoType:           (head.InfoType ?? "発表") as InfoType,
    headlineText:       String(head.Headline?.Text ?? ""),
    municipalityItems,
  };
}

// ============================================================
// Warning[@type="気象警報・注意報（市町村等）"] 抽出
// ============================================================

function extractMunicipalityItems(warning: any): MunicipalityWarningItem[] {
  const items: any[] = warning.Item ?? [];
  return items
    .map((item) => parseMunicipalityItem(item))
    .filter((x): x is MunicipalityWarningItem => x !== null);
}

function parseMunicipalityItem(item: any): MunicipalityWarningItem | null {
  // 市町村等レベルでは Area は単一（Areas でラップされない、子要素として直接）
  const area = item.Area;
  if (!area) return null;

  const areaCode = String(area.Code ?? "");
  const areaName = String(area.Name ?? "");
  if (!areaCode) return null;

  const kindArr: any[] = item.Kind ?? [];
  const kinds = kindArr
    .map((k) => parseKind(k))
    .filter((k): k is WarningKind => k !== null);

  return { areaCode, areaName, kinds };
}

function parseKind(kind: any): WarningKind | null {
  const status = String(kind.Status ?? "発表") as KindStatus;
  const name   = String(kind.Name ?? "");
  const code   = String(kind.Code ?? "");

  // Status="発表警報・注意報はなし" の場合、Name/Code は省略される。
  // この Kind は投稿対象外だが、データとしては保持し、マッパー側でフィルタする。

  const additions = collectNoteTexts(kind.Addition);

  const propertyArr: any[] = kind.Property ?? [];
  const significancies: Significancy[] = [];
  const quantitative: QuantitativeForecast[] = [];
  const criteriaPeriods: CriteriaPeriod[] = [];

  for (const prop of propertyArr) {
    extractFromProperty(prop, significancies, quantitative, criteriaPeriods);
  }

  return { name, code, status, additions, significancies, quantitative, criteriaPeriods };
}

function extractFromProperty(
  prop: any,
  outSig: Significancy[],
  outQuant: QuantitativeForecast[],
  outCriteria: CriteriaPeriod[],
): void {
  const propertyType = String(prop.Type ?? "");

  // ── SignificancyPart ──
  if (prop.SignificancyPart?.Base) {
    const base = prop.SignificancyPart.Base;
    // 地域全体パターン: Base 直下に Significancy
    const directSigs: any[] = Array.isArray(base.Significancy)
      ? base.Significancy
      : base.Significancy != null
        ? [base.Significancy]
        : [];
    for (const s of directSigs) {
      outSig.push(buildSignificancy(s));
    }
    // 地域別パターン: Base/Local[]/Significancy
    const localArr: any[] = base.Local ?? [];
    for (const local of localArr) {
      const localSigs: any[] = Array.isArray(local.Significancy)
        ? local.Significancy
        : local.Significancy != null
          ? [local.Significancy]
          : [];
      const areaName = String(local.AreaName ?? "");
      for (const s of localSigs) {
        const sig = buildSignificancy(s);
        if (areaName) sig.areaName = areaName;
        outSig.push(sig);
      }
    }
  }

  // ── CriteriaPeriod（警戒レベル到達予想期間） ──
  if (prop.CriteriaPeriod?.Base) {
    const base = prop.CriteriaPeriod.Base;
    const cls = base.CriteriaClass ?? {};
    outCriteria.push({
      sentence:          String(base.Sentence ?? ""),
      criteriaClassName: String(cls.Name ?? ""),
      criteriaClassCode: String(cls.Code ?? ""),
      time:              String(base.Time ?? ""),
      duration:          String(base.Duration ?? ""),
      propertyType,
    });
  }

  // ── 量的予想各種 ──
  collectQuantitative(prop.WindDirectionPart, "WindDirection", propertyType, outQuant);
  collectQuantitative(prop.WindSpeedPart,     "WindSpeed",     propertyType, outQuant);
  collectQuantitative(prop.WaveHeightPart,    "WaveHeight",    propertyType, outQuant);
  collectQuantitative(prop.TidalLevelPart,    "TidalLevel",    propertyType, outQuant);
  collectQuantitative(prop.SnowfallDepthPart, "SnowfallDepth", propertyType, outQuant);
  collectQuantitative(prop.HumidityPart,      "HumidityPart",  propertyType, outQuant);
  collectQuantitative(prop.VisibilityPart,    "Visibility",    propertyType, outQuant);
}

function buildSignificancy(s: any): Significancy {
  return {
    type: String(s["@_type"] ?? ""),
    name: String(s.Name ?? ""),
    code: String(s.Code ?? ""),
  };
}

/**
 * `<XXXPart><Base><jmx_eb:Element ...>値</jmx_eb:Element></Base></XXXPart>` または
 * Base/Local[]/Element 構造から QuantitativeForecast を抽出する。
 *
 * 注意: fast-xml-parser は `jmx_eb:` プレフィックス付き要素を `jmx_eb:WindSpeed` のような
 *       キー名でアクセスできる（名前空間プレフィックスを保持）。
 */
function collectQuantitative(
  part: any,
  elementName: string,
  propertyType: string,
  out: QuantitativeForecast[]
): void {
  if (!part) return;
  const base = part.Base;
  if (!base) return;

  const nsKey = `jmx_eb:${elementName}`;
  const baseTime = String(base.Time ?? "") || undefined;

  // Base 直下パターン
  pushFromHolder(base, nsKey, propertyType, undefined, baseTime, out);

  // Base/Local[] パターン
  const localArr: any[] = base.Local ?? [];
  for (const local of localArr) {
    const areaName = String(local.AreaName ?? "") || undefined;
    const localTime = String(local.Time ?? "") || baseTime;
    pushFromHolder(local, nsKey, propertyType, areaName, localTime, out);
  }
}

function pushFromHolder(
  holder: any,
  nsKey: string,
  propertyType: string,
  areaName: string | undefined,
  time: string | undefined,
  out: QuantitativeForecast[]
): void {
  const el = holder[nsKey];
  if (el == null) return;
  const arr: any[] = Array.isArray(el) ? el : [el];
  for (const e of arr) {
    if (e == null) continue;
    // テキスト値は fast-xml-parser のデフォルトでは "#text" キー、または直接プリミティブ
    let value: string;
    let attrs: Record<string, any>;
    if (typeof e === "object") {
      value = String(e["#text"] ?? "");
      attrs = e;
    } else {
      value = String(e);
      attrs = {};
    }
    const q: QuantitativeForecast = {
      propertyType,
      attrType:    String(attrs["@_type"] ?? ""),
      value,
      unit:        String(attrs["@_unit"] ?? ""),
      description: String(attrs["@_description"] ?? ""),
    };
    const cond = attrs["@_condition"];
    if (cond) q.condition = String(cond);
    if (areaName) q.areaName = areaName;
    if (time) q.time = time;
    out.push(q);
  }
}

function collectNoteTexts(addition: any): string[] {
  if (!addition) return [];
  const notes: any[] = Array.isArray(addition.Note) ? addition.Note : addition.Note != null ? [addition.Note] : [];
  return notes.map((n) => (typeof n === "object" ? String(n["#text"] ?? "") : String(n))).filter((s) => s.length > 0);
}

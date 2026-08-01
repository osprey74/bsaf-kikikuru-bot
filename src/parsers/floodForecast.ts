/**
 * src/parsers/floodForecast.ts
 * 指定河川洪水予報（VXKO50〜70）XML パーサー
 *
 * 出典: 気象庁防災情報XMLフォーマット「指定河川洪水予報」解説資料
 *
 * 設計判断:
 * - 警戒レベル・河川・府県予報区は Head/Headline/Information（構造化済み）から取得する。
 *   Body の主文テキストより機械可読性が高い。
 * - 浸水想定地区（市町村）は Body/Warning[@type="指定河川洪水予報"] の
 *   Kind/Name="浸水想定地区" Item から都道府県付きで取得する。
 * - 1 電文に複数の警戒レベルが混在しうる（河川ごとにレベルが異なる）。
 *   Head/Headline/Information の各 Item は Kind/Code でレベルを持つため、
 *   Kind/Code 単位でグルーピングする。
 *
 * Kind/Code 体系（別表・実データ実測）:
 *   先頭桁がレベル → 1:解除 / 2:氾濫注意 / 3:氾濫警戒 / 4:氾濫危険 / 5:氾濫発生
 *   （例: "20" レベル2氾濫注意報発表 / "21" 継続 / "22" 警報解除で注意報降格 /
 *         "30" レベル3氾濫警報 / "10" レベル2氾濫注意報解除）
 */

import { XMLParser } from "fast-xml-parser";

// ============================================================
// 型定義
// ============================================================

export type TelegramStatus = "通常" | "訓練" | "試験";
export type InfoType = "発表" | "訂正" | "取消";

/** 洪水予報の予報区（府県予報区） */
export interface FloodPrefectureArea {
  /** 都道府県名（例: "山形県"） */
  name: string;
  /** 府県予報区コード（例: "060000"）。先頭2桁が都道府県コード。 */
  code: string;
}

/** Kind/Code 単位でまとめた洪水予報グループ（同一警戒レベル） */
export interface FloodForecastGroup {
  /** Kind/Code（別表、例: "20","30","10"） */
  kindCode: string;
  /** Kind/Name（例: "レベル３氾濫警報"、"レベル２氾濫注意報解除"） */
  kindName: string;
  /** 対象河川名（例: ["鮭川","真室川","金山川"]） */
  rivers: string[];
  /** 対象府県予報区（都道府県） */
  prefectures: FloodPrefectureArea[];
}

/** 浸水想定地区（市町村単位、都道府県付き） */
export interface FloodInundationArea {
  /** 都道府県名（例: "山形県"） */
  prefecture: string;
  /** 都道府県コード（5-6桁、先頭2桁が都道府県、例: "06000"） */
  prefectureCode: string;
  /** 市町村名（例: "真室川町"） */
  city: string;
}

/** パース結果 */
export interface ParsedFloodForecast {
  /** Control/Title（"指定河川洪水予報"） */
  controlTitle: string;
  /** 運用種別（通常/訓練/試験） */
  telegramStatus: TelegramStatus;
  /** 発表官署（Control/EditorialOffice、例: "山形地方気象台"） */
  editorialOffice: string;
  /** 発表官署（Control/PublishingOffice、例: "新庄河川事務所 山形地方気象台"） */
  publishingOffice: string;
  /** 情報形態（発表/訂正/取消） */
  infoType: InfoType;
  /** 発表時刻 JST ISO8601（Head/ReportDateTime、+09:00 付き） */
  reportDateTime: string;
  /** 見出し文 */
  headlineText: string;
  /** 警戒レベル単位の予報グループ */
  groups: FloodForecastGroup[];
  /** 浸水想定地区（市町村） */
  inundationAreas: FloodInundationArea[];
}

// ============================================================
// XML パーサー設定
// ============================================================

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) =>
    ["Information", "Item", "Kind", "Area", "Station", "Warning"].includes(name),
  parseTagValue: false,
  trimValues: true,
});

// ============================================================
// メインパーサー
// ============================================================

/**
 * 指定河川洪水予報 XML 文字列をパースして構造化データを返す。
 * 訓練・試験電文は null を返す。
 */
export function parseFloodForecastXml(xmlString: string): ParsedFloodForecast | null {
  let raw: any;
  try {
    raw = xmlParser.parse(xmlString);
  } catch (e) {
    console.error("[Flood] XMLパースエラー:", e);
    return null;
  }

  const report = raw?.Report;
  if (!report) {
    console.warn("[Flood] <Report>要素が見つかりません");
    return null;
  }

  const control = report.Control ?? {};
  const head = report.Head ?? {};
  const body = report.Body ?? {};

  const telegramStatus = (control.Status ?? "通常") as TelegramStatus;
  if (telegramStatus !== "通常") {
    console.info(`[Flood] スキップ（${telegramStatus}電文）`);
    return null;
  }

  const headline = head.Headline ?? {};
  const groups = extractGroups(headline.Information ?? []);
  const inundationAreas = extractInundationAreas(body);

  return {
    controlTitle: String(control.Title ?? ""),
    telegramStatus,
    editorialOffice: String(control.EditorialOffice ?? ""),
    publishingOffice: String(control.PublishingOffice ?? ""),
    infoType: (head.InfoType ?? "発表") as InfoType,
    reportDateTime: String(head.ReportDateTime ?? ""),
    headlineText: String(headline.Text ?? ""),
    groups,
    inundationAreas,
  };
}

// ============================================================
// Head/Headline/Information からグループ抽出
// ============================================================

/**
 * Head/Headline/Information[] を Kind/Code 単位でグルーピングする。
 * - type="指定河川洪水予報（河川）" から河川名を収集
 * - type="指定河川洪水予報（府県予報区等）" から都道府県を収集
 * 河川ブロックと府県予報区ブロックは別々に出現するが、同一 Kind/Code で対応づける。
 */
function extractGroups(informationArr: any[]): FloodForecastGroup[] {
  // kindCode -> group
  const byCode = new Map<string, FloodForecastGroup>();

  const ensure = (code: string, name: string): FloodForecastGroup => {
    let g = byCode.get(code);
    if (!g) {
      g = { kindCode: code, kindName: name, rivers: [], prefectures: [] };
      byCode.set(code, g);
    }
    if (!g.kindName && name) g.kindName = name;
    return g;
  };

  for (const info of informationArr) {
    const type = String(info?.["@_type"] ?? "");
    const items: any[] = info?.Item ?? [];
    for (const item of items) {
      const kindArr: any[] = item?.Kind ?? [];
      const kind = kindArr[0];
      if (!kind) continue;
      const code = String(kind.Code ?? "");
      const name = String(kind.Name ?? "");
      if (!code) continue;

      const areas: any[] = item?.Areas?.Area ?? [];
      const g = ensure(code, name);

      // 注: いずれの type も接頭辞「指定河川洪水予報」を含むため、
      //     "河川" 部分一致では府県予報区ブロックを誤検出する。括弧内で厳密判定する。
      if (type.includes("府県予報区")) {
        for (const a of areas) {
          const n = String(a.Name ?? "");
          const c = String(a.Code ?? "");
          if (n && !g.prefectures.some((p) => p.name === n)) {
            g.prefectures.push({ name: n, code: c });
          }
        }
      } else if (type.includes("（河川）")) {
        for (const a of areas) {
          const n = String(a.Name ?? "");
          if (n && !g.rivers.includes(n)) g.rivers.push(n);
        }
      }
    }
  }

  return [...byCode.values()];
}

// ============================================================
// Body/浸水想定地区 から市町村抽出
// ============================================================

function extractInundationAreas(body: any): FloodInundationArea[] {
  const warningArr: any[] = body?.Warning ?? [];
  const out: FloodInundationArea[] = [];

  for (const warning of warningArr) {
    const items: any[] = warning?.Item ?? [];
    for (const item of items) {
      const kindArr: any[] = item?.Kind ?? [];
      const isInundation = kindArr.some((k) => String(k?.Name ?? "") === "浸水想定地区");
      if (!isInundation) continue;

      const areas: any[] = item?.Areas?.Area ?? [];
      for (const a of areas) {
        const prefecture = String(a.Prefecture ?? "");
        const prefectureCode = String(a.PrefectureCode ?? "");
        const city = String(a.City ?? "");
        if (prefecture && city) {
          out.push({ prefecture, prefectureCode, city });
        }
      }
    }
  }

  return out;
}

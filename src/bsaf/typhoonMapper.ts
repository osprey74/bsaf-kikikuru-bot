/**
 * src/bsaf/typhoonMapper.ts
 * ParsedTyphoon（VPTW60 台風解析・予報情報）→ BsafPost[] 変換
 *
 * BSAF マッピング（2026-08-01 確定）:
 *   - type:typhoon（情報系）
 *   - value: 強さ階級 → violent（猛烈な）/ very-strong（非常に強い）/ strong（強い）/ tropical-storm（それ以外）
 *   - target:jp（全国。台風は特定都道府県に紐づかない全国的情報）
 *
 * 1 投稿 = 1 台風 × 1 発表（実況）。予報・暴風域確率（VPTA50）は対象外。
 */

import type { ParsedTyphoon } from "../parsers/typhoon";
import type { BsafPost } from "./r06Mapper";

const SOURCE_LINE = "出典: 気象庁 https://www.jma.go.jp/bosai/warning/";

export function mapTyphoonToBsafPosts(parsed: ParsedTyphoon): BsafPost[] {
  const value = intensityToValue(parsed.intensityClass);
  const timeUtc = toUtcIso(parsed.analysisDateTime || parsed.reportDateTime);

  const header = buildHeader(parsed);

  const lines: string[] = [header, ""];

  const strengthLine = buildStrengthLine(parsed);
  if (strengthLine) lines.push(strengthLine);
  if (parsed.pressureHpa) lines.push(`中心気圧：${parsed.pressureHpa}hPa`);
  if (parsed.maxWindMs) {
    const gust = parsed.maxGustMs ? `（最大瞬間${parsed.maxGustMs}m/s）` : "";
    lines.push(`最大風速：${parsed.maxWindMs}m/s${gust}`);
  }
  if (parsed.location) lines.push(`中心位置：${parsed.location}`);
  const moveLine = buildMoveLine(parsed);
  if (moveLine) lines.push(moveLine);
  const areaLine = buildAreaLine(parsed);
  if (areaLine) lines.push(areaLine);

  lines.push("");
  lines.push(SOURCE_LINE);

  const post: BsafPost = {
    text: normalizeBodyText(lines.join("\n")),
    tags: [
      "bsaf:v1",
      "type:typhoon",
      `value:${value}`,
      `time:${timeUtc}`,
      "target:jp",
      "source:jma",
    ],
    dedupeKey: `typhoon:${parsed.number || parsed.name || "?"}:${timeUtc}`,
  };

  return [post];
}

/** 強さ階級 → BSAF value */
function intensityToValue(intensityClass: string): string {
  if (intensityClass.includes("猛烈")) return "violent";
  if (intensityClass.includes("非常に強い")) return "very-strong";
  if (intensityClass.includes("強い")) return "strong";
  return "tropical-storm";
}

function buildHeader(p: ParsedTyphoon): string {
  const num = p.number ? parseInt(p.number.slice(-2), 10) : NaN;
  const isTyphoon = p.typhoonClass.includes("台風") || !!p.number;
  if (isTyphoon && Number.isFinite(num) && num > 0) {
    const name = p.nameKana || p.name;
    return name ? `🌀 台風第${num}号（${name}）` : `🌀 台風第${num}号`;
  }
  // 台風以外（熱帯低気圧・温帯低気圧化 等）
  const label = p.typhoonClass ? p.typhoonClass.replace(/\(.*?\)/, "") : "熱帯擾乱";
  return `🌀 ${label}`;
}

function buildStrengthLine(p: ParsedTyphoon): string {
  const parts: string[] = [];
  if (p.intensityClass) parts.push(`強さ：${p.intensityClass}`);
  if (p.areaClass) parts.push(`大きさ：${p.areaClass}`);
  return parts.join("／");
}

function buildMoveLine(p: ParsedTyphoon): string {
  if (p.direction && p.speedKmh) return `移動：${p.direction}へ${p.speedKmh}km/h`;
  if (p.direction) return `移動：${p.direction}`;
  return "";
}

function buildAreaLine(p: ParsedTyphoon): string {
  const parts: string[] = [];
  if (p.stormRadiusKm) parts.push(`暴風域：半径${p.stormRadiusKm}km`);
  if (p.galeRadiusKm) parts.push(`強風域：半径${p.galeRadiusKm}km`);
  return parts.join("／");
}

/** 全角数字を半角へ正規化する（本文可読性向上、URL・タグは対象外）。 */
function normalizeBodyText(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

function toUtcIso(isoLocal: string): string {
  if (!isoLocal) return "";
  const d = new Date(isoLocal);
  return isNaN(d.getTime()) ? isoLocal : d.toISOString();
}

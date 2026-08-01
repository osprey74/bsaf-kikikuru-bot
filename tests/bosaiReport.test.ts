/**
 * tests/bosaiReport.test.ts
 * 府県気象防災速報（VPBS50）パース → BsafPost[] 変換の検証
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseBosaiReportXml } from "../src/parsers/bosaiReport";
import { mapBosaiToBsafPosts } from "../src/bsaf/bosaiMapper";

const FIXTURES = resolve(__dirname, "fixtures");
const load = (name: string) => readFileSync(resolve(FIXTURES, name), "utf-8");

function parseAndMap(name: string) {
  const xml = load(name);
  const parsed = parseBosaiReportXml(xml);
  expect(parsed).not.toBeNull();
  return mapBosaiToBsafPosts(parsed!);
}

describe("VPBS50 パース（線状降水帯 直前予測）", () => {
  const parsed = parseBosaiReportXml(load("vpbs50_linear-rainband_imminent.xml"))!;

  test("サブ種別と細分区域コードが抽出される", () => {
    expect(parsed.subKind).toBe("線状降水帯直前予測");
    expect(parsed.areaCodes).toContain("130030"); // 東京都
    expect(parsed.headlineText).toContain("線状降水帯");
  });
});

describe("VPBS50 → BsafPost（線状降水帯 直前予測 = level4）", () => {
  const posts = parseAndMap("vpbs50_linear-rainband_imminent.xml");

  test("東京都 level4 の投稿が 1 件生成される", () => {
    const p = posts.find((p) => p.dedupeKey === "linear-rainband-warning:jp-tokyo:level4");
    expect(p).toBeDefined();
  });

  test("BSAF タグが確定仕様どおり", () => {
    const p = posts[0];
    expect(p.tags).toContain("bsaf:v1");
    expect(p.tags).toContain("type:linear-rainband-warning");
    expect(p.tags).toContain("value:level4");
    expect(p.tags).toContain("target:jp-tokyo");
    expect(p.tags).toContain("source:jma");
    expect(p.tags.find((t) => t.startsWith("time:"))).toBeDefined();
  });

  test("本文に見出し文・出典を含み 300 字以内・全角数字正規化", () => {
    const p = posts[0];
    expect(p.text).toContain("線状降水帯");
    expect(p.text).toContain("出典: 気象庁");
    expect([...p.text].length).toBeLessThanOrEqual(300);
    expect(p.text).toContain("警戒レベル4相当");
    expect(p.text).not.toContain("３時間"); // 全角→半角
  });
});

describe("VPBS50 → BsafPost（記録的短時間大雨はスキップ）", () => {
  test("記録的短時間大雨は投稿を生成しない（JMABot VPOA50 との二重投稿回避）", () => {
    const posts = parseAndMap("vpbs50_record-rain_skip.xml");
    expect(posts.length).toBe(0);
  });
});

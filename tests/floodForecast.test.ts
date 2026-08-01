/**
 * tests/floodForecast.test.ts
 * 指定河川洪水予報（VXKO）パース → BsafPost[] 変換の検証
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseFloodForecastXml } from "../src/parsers/floodForecast";
import { mapFloodToBsafPosts } from "../src/bsaf/floodMapper";

const FIXTURES = resolve(__dirname, "fixtures");
const load = (name: string) => readFileSync(resolve(FIXTURES, name), "utf-8");

function parseAndMap(name: string) {
  const xml = load(name);
  const parsed = parseFloodForecastXml(xml);
  expect(parsed).not.toBeNull();
  return mapFloodToBsafPosts(parsed!);
}

describe("VXKO パース（Lv2 氾濫注意・山形県）", () => {
  const xml = load("vxko_flood_lv2.xml");
  const parsed = parseFloodForecastXml(xml)!;

  test("河川と府県予報区が正しく分離される", () => {
    const g = parsed.groups[0];
    expect(g.kindCode).toBe("20");
    expect(g.rivers).toEqual(["鮭川", "真室川", "金山川"]);
    expect(g.prefectures.map((p) => p.name)).toEqual(["山形県"]);
    // 府県名が河川に混入しないこと（type 部分一致バグの回帰防止）
    expect(g.rivers).not.toContain("山形県");
  });

  test("浸水想定地区（市町村）が抽出される", () => {
    expect(parsed.inundationAreas.length).toBeGreaterThan(0);
    expect(parsed.inundationAreas.every((a) => a.prefecture === "山形県")).toBe(true);
  });
});

describe("VXKO → BsafPost（Lv2 氾濫注意）", () => {
  const posts = parseAndMap("vxko_flood_lv2.xml");

  test("山形県 level2 の投稿が 1 件生成される", () => {
    const p = posts.find((p) => p.dedupeKey === "flood:jp-yamagata:level2");
    expect(p).toBeDefined();
  });

  test("BSAF タグ 6 件が揃う", () => {
    const p = posts.find((p) => p.dedupeKey === "flood:jp-yamagata:level2")!;
    expect(p.tags).toContain("bsaf:v1");
    expect(p.tags).toContain("type:flood-warning");
    expect(p.tags).toContain("value:level2");
    expect(p.tags).toContain("target:jp-yamagata");
    expect(p.tags).toContain("source:jma");
    expect(p.tags.find((t) => t.startsWith("time:"))).toBeDefined();
  });

  test("本文に河川名・氾濫注意情報・出典が含まれる", () => {
    const p = posts.find((p) => p.dedupeKey === "flood:jp-yamagata:level2")!;
    expect(p.text).toContain("氾濫注意情報");
    expect(p.text).toContain("鮭川");
    expect(p.text).toContain("出典: 気象庁");
  });

  test("本文が 300 字以内", () => {
    for (const p of posts) {
      expect([...p.text].length).toBeLessThanOrEqual(300);
    }
  });

  test("全角数字が半角へ正規化される", () => {
    const p = posts.find((p) => p.dedupeKey === "flood:jp-yamagata:level2")!;
    expect(p.text).toContain("警戒レベル2相当");
    expect(p.text).not.toContain("警戒レベル２相当");
  });
});

describe("VXKO → BsafPost（Lv3 氾濫警戒）", () => {
  const posts = parseAndMap("vxko_flood_lv3.xml");

  test("秋田県 level3 の投稿が生成される", () => {
    const p = posts.find((p) => p.dedupeKey === "flood:jp-akita:level3");
    expect(p).toBeDefined();
    expect(p!.tags).toContain("value:level3");
    expect(p!.text).toContain("氾濫警戒情報");
  });
});

describe("VXKO → BsafPost（解除）", () => {
  const posts = parseAndMap("vxko_flood_cancellation.xml");

  test("解除（cancelled）の投稿が生成される", () => {
    const p = posts.find((p) => p.dedupeKey === "flood:jp-akita:cancelled");
    expect(p).toBeDefined();
    expect(p!.tags).toContain("value:cancelled");
    expect(p!.text).toContain("解除");
  });
});

/**
 * tests/typhoon.test.ts
 * 台風解析・予報情報（VPTW60）パース → BsafPost[] 変換の検証
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTyphoonXml } from "../src/parsers/typhoon";
import { mapTyphoonToBsafPosts } from "../src/bsaf/typhoonMapper";

const FIXTURES = resolve(__dirname, "fixtures");
const load = (name: string) => readFileSync(resolve(FIXTURES, name), "utf-8");

describe("VPTW60 パース（実況）", () => {
  const parsed = parseTyphoonXml(load("vptw60_typhoon.xml"))!;

  test("台風の本体情報が抽出される", () => {
    expect(parsed.number).toBe("2613");
    expect(parsed.nameKana).toBe("ドルフィン");
    expect(parsed.intensityClass).toBe("非常に強い");
    expect(parsed.pressureHpa).toBe("925");
    expect(parsed.maxWindMs).toBe("50");
    expect(parsed.maxGustMs).toBe("70");
    expect(parsed.stormRadiusKm).toBe("150");
    expect(parsed.galeRadiusKm).toBe("500");
  });
});

describe("VPTW60 → BsafPost", () => {
  const parsed = parseTyphoonXml(load("vptw60_typhoon.xml"))!;
  const posts = mapTyphoonToBsafPosts(parsed);
  const p = posts[0];

  test("投稿が 1 件生成される", () => {
    expect(posts.length).toBe(1);
  });

  test("BSAF タグが確定仕様どおり（type:typhoon / value:very-strong / target:jp）", () => {
    expect(p.tags).toContain("bsaf:v1");
    expect(p.tags).toContain("type:typhoon");
    expect(p.tags).toContain("value:very-strong");
    expect(p.tags).toContain("target:jp");
    expect(p.tags).toContain("source:jma");
    expect(p.tags.find((t) => t.startsWith("time:"))).toBeDefined();
  });

  test("本文に台風番号・強さ・気圧・出典を含み 300 字以内", () => {
    expect(p.text).toContain("台風第13号");
    expect(p.text).toContain("ドルフィン");
    expect(p.text).toContain("非常に強い");
    expect(p.text).toContain("925hPa");
    expect(p.text).toContain("出典: 気象庁");
    expect([...p.text].length).toBeLessThanOrEqual(300);
  });

  test("dedupeKey が台風番号＋実況時刻で一意", () => {
    expect(p.dedupeKey).toBe("typhoon:2613:2026-08-01T00:00:00.000Z");
  });
});

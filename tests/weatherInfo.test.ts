/**
 * tests/weatherInfo.test.ts
 * 府県気象情報（VPFJ50）パース → BsafPost[] 変換の検証
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseWeatherInfoXml } from "../src/parsers/weatherInfo";
import { mapWeatherInfoToBsafPosts } from "../src/bsaf/weatherInfoMapper";

const FIXTURES = resolve(__dirname, "fixtures");
const load = (name: string) => readFileSync(resolve(FIXTURES, name), "utf-8");

describe("VPFJ50 パース", () => {
  const parsed = parseWeatherInfoXml(load("vpfj50_weather-info.xml"))!;

  test("都道府県名と見出し種別が抽出される", () => {
    expect(parsed.prefName).toBe("岩手県");
    expect(parsed.topic).toBe("大雨・落雷");
    expect(parsed.headlineText.length).toBeGreaterThan(0);
  });
});

describe("VPFJ50 → BsafPost", () => {
  const parsed = parseWeatherInfoXml(load("vpfj50_weather-info.xml"))!;
  const posts = mapWeatherInfoToBsafPosts(parsed);
  const p = posts[0];

  test("岩手県の投稿が 1 件生成される", () => {
    expect(posts.length).toBe(1);
    expect(p.dedupeKey.startsWith("weather-info:jp-iwate:")).toBe(true);
  });

  test("BSAF タグが確定仕様どおり（type:weather-info / value:info / target:jp-iwate）", () => {
    expect(p.tags).toContain("bsaf:v1");
    expect(p.tags).toContain("type:weather-info");
    expect(p.tags).toContain("value:info");
    expect(p.tags).toContain("target:jp-iwate");
    expect(p.tags).toContain("source:jma");
    expect(p.tags.find((t) => t.startsWith("time:"))).toBeDefined();
  });

  test("本文に見出し種別・出典を含み 300 字以内・全角数字正規化", () => {
    expect(p.text).toContain("【気象情報】（大雨・落雷）");
    expect(p.text).toContain("出典: 気象庁");
    expect([...p.text].length).toBeLessThanOrEqual(300);
    expect(p.text).not.toContain("１日"); // 全角→半角
  });
});

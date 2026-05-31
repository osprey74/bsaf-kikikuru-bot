/**
 * tests/r06Mapper.test.ts
 * Parsed → BsafPost[] 変換の検証
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseR06WarningXml } from "../src/parsers/r06Warning";
import { mapToBsafPosts } from "../src/bsaf/r06Mapper";

const FIXTURES = resolve(__dirname, "fixtures");
const load = (name: string) => readFileSync(resolve(FIXTURES, name), "utf-8");

function parseAndMap(name: string) {
  const xml = load(name);
  const parsed = parseR06WarningXml(xml);
  expect(parsed).not.toBeNull();
  return mapToBsafPosts(parsed!);
}

describe("VPWW55 → BsafPost", () => {
  const posts = parseAndMap("vpww55_heavy-rain_lv2.xml");

  test("北海道 Lv2 大雨注意報の投稿が 1 件生成される", () => {
    const hokkaido = posts.find((p) => p.dedupeKey === "heavy-rain:jp-hokkaido:level2");
    expect(hokkaido).toBeDefined();
  });

  test("BSAF タグ 6 件揃う", () => {
    const p = posts.find((p) => p.dedupeKey === "heavy-rain:jp-hokkaido:level2")!;
    expect(p.tags).toContain("bsaf:v1");
    expect(p.tags).toContain("type:heavy-rain-warning");
    expect(p.tags).toContain("value:level2");
    expect(p.tags).toContain("source:jma");
    expect(p.tags).toContain("target:jp-hokkaido");
    expect(p.tags.find((t) => t.startsWith("time:"))).toBeDefined();
  });

  test("投稿本文が 300 字以内", () => {
    const p = posts.find((p) => p.dedupeKey === "heavy-rain:jp-hokkaido:level2")!;
    expect(p.text.length).toBeLessThanOrEqual(300);
  });

  test("投稿本文に「大雨」「警戒レベル」「対象市町村」が含まれる", () => {
    const p = posts.find((p) => p.dedupeKey === "heavy-rain:jp-hokkaido:level2")!;
    expect(p.text).toContain("大雨");
    // Significancy/Name は XML 上は全角数字（"警戒レベル２"）。レベル数字無しで部分一致確認。
    expect(p.text).toContain("警戒レベル");
    expect(p.text).toContain("対象市町村");
  });
});

describe("VPWW56 → BsafPost", () => {
  const posts = parseAndMap("vpww56_landslide_lv2.xml");

  test("新潟 Lv2 土砂災害注意報の投稿が生成される", () => {
    const p = posts.find((p) => p.dedupeKey === "landslide:jp-niigata:level2");
    expect(p).toBeDefined();
  });
});

describe("VPWW58 → BsafPost", () => {
  test("発表電文: 東京 強風注意報（advisory）が生成され、量的予想が本文に含まれる", () => {
    const posts = parseAndMap("vpww58_wind_advisory.xml");
    const p = posts.find((p) => p.dedupeKey === "wind:jp-tokyo:advisory");
    expect(p).toBeDefined();
    expect(p!.text).toContain("最大風速");
    expect(p!.text).toContain("15");
    expect(p!.text).toContain("南西");
    expect(p!.tags).toContain("type:wind-warning");
    expect(p!.tags).toContain("value:advisory");
    expect(p!.text.length).toBeLessThanOrEqual(300);
  });

  test("解除電文: 北海道 暴風 解除の投稿が生成される", () => {
    const posts = parseAndMap("vpww58_wind_cancellation.xml");
    const p = posts.find((p) => p.dedupeKey === "wind:jp-hokkaido:cancelled");
    expect(p).toBeDefined();
    expect(p!.text).toContain("解除");
    expect(p!.tags).toContain("value:cancelled");
  });
});

describe("VPWW59 → BsafPost", () => {
  test("東京 波浪注意報、波高 3m を本文に含む", () => {
    const posts = parseAndMap("vpww59_wave_advisory.xml");
    const p = posts.find((p) => p.dedupeKey === "wave:jp-tokyo:advisory");
    expect(p).toBeDefined();
    expect(p!.text).toContain("波高");
    expect(p!.text).toContain("3");
    expect(p!.tags).toContain("type:wave-warning");
  });
});

describe("VPWW61 → BsafPost（複数 Kind 並列の分解）", () => {
  const posts = parseAndMap("vpww61_thunder-fog.xml");

  test("北海道 雷注意報 と 濃霧注意報 が別投稿として生成される", () => {
    const thunder = posts.find((p) => p.dedupeKey === "thunderstorm:jp-hokkaido:advisory");
    const fog     = posts.find((p) => p.dedupeKey === "dense-fog:jp-hokkaido:advisory");
    expect(thunder).toBeDefined();
    expect(fog).toBeDefined();
  });

  test("雷注意報の本文に付加事項（突風、ひょう）が反映される", () => {
    const thunder = posts.find((p) => p.dedupeKey === "thunderstorm:jp-hokkaido:advisory")!;
    expect(thunder.text).toContain("突風");
    expect(thunder.text).toContain("ひょう");
  });

  test("濃霧注意報の本文に視程 200m 以下が含まれる", () => {
    const fog = posts.find((p) => p.dedupeKey === "dense-fog:jp-hokkaido:advisory")!;
    expect(fog.text).toContain("視程");
    expect(fog.text).toContain("200");
  });

  test("各投稿の BSAF タグが正しい現象種別", () => {
    const thunder = posts.find((p) => p.dedupeKey === "thunderstorm:jp-hokkaido:advisory")!;
    const fog     = posts.find((p) => p.dedupeKey === "dense-fog:jp-hokkaido:advisory")!;
    expect(thunder.tags).toContain("type:thunderstorm-warning");
    expect(fog.tags).toContain("type:dense-fog-warning");
  });

  test("全投稿が 300 字以内", () => {
    for (const p of posts) {
      expect(p.text.length).toBeLessThanOrEqual(300);
    }
  });
});

describe("重複抑制キーの一意性", () => {
  test("全投稿の dedupeKey が一意（重複なし）", () => {
    const all = [
      ...parseAndMap("vpww55_heavy-rain_lv2.xml"),
      ...parseAndMap("vpww56_landslide_lv2.xml"),
      ...parseAndMap("vpww58_wind_advisory.xml"),
      ...parseAndMap("vpww59_wave_advisory.xml"),
      ...parseAndMap("vpww61_thunder-fog.xml"),
    ];
    const keys = new Set(all.map((p) => p.dedupeKey));
    expect(keys.size).toBe(all.length);
  });
});

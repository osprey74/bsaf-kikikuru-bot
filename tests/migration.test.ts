/**
 * tests/migration.test.ts
 * bsaf-jma-bot からの移管電文（竜巻・土砂災害警戒情報・記録的短時間大雨）の検証
 * BSAF 仕様「同一データは同一タグ」に基づき JMABot のタグを踏襲することを確認する。
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseTornadoWarningXml } from "../src/parsers/tornadoWarning";
import { mapTornadoToBsafPosts } from "../src/bsaf/tornadoMapper";
import { parseLandslideAlertXml } from "../src/parsers/landslideAlert";
import { mapLandslideAlertToBsafPosts } from "../src/bsaf/landslideAlertMapper";
import { parseBosaiReportXml } from "../src/parsers/bosaiReport";
import { mapBosaiToBsafPosts } from "../src/bsaf/bosaiMapper";

const FIX = resolve(__dirname, "fixtures");
const load = (n: string) => readFileSync(resolve(FIX, n), "utf-8");

describe("竜巻注意情報（VPHW50）移管", () => {
  const posts = mapTornadoToBsafPosts(parseTornadoWarningXml(load("vphw50_tornado.xml"))!);
  const p = posts[0];

  test("type:tornado-warning / value:warning / 都道府県 target", () => {
    expect(posts.length).toBe(1);
    expect(p.tags).toContain("type:tornado-warning");
    expect(p.tags).toContain("value:warning");
    expect(p.tags).toContain("target:jp-kanagawa");
  });
  test("本文に竜巻注意情報・出典を含み 300 字以内", () => {
    expect(p.text).toContain("竜巻注意情報");
    expect(p.text).toContain("出典: 気象庁");
    expect([...p.text].length).toBeLessThanOrEqual(300);
  });
});

describe("土砂災害警戒情報（VXWW50）移管", () => {
  const posts = mapLandslideAlertToBsafPosts(parseLandslideAlertXml(load("vxww50_landslide-alert.xml"))!);
  const p = posts[0];

  test("type:landslide-warning / value:warning / 都道府県 target", () => {
    expect(posts.length).toBe(1);
    expect(p.tags).toContain("type:landslide-warning");
    expect(p.tags).toContain("value:warning");
    expect(p.tags).toContain("target:jp-iwate");
  });
  test("R06 土砂（landslide:…:level4）と重複キーが衝突しない", () => {
    expect(p.dedupeKey).toBe("landslide-alert:jp-iwate:warning");
  });
  test("対象市町村を本文に列挙", () => {
    expect(p.text).toContain("対象市町村:");
    expect(p.text).toContain("西和賀町");
  });
});

describe("記録的短時間大雨（VPBS50 サブ種別）移管", () => {
  const posts = mapBosaiToBsafPosts(parseBosaiReportXml(load("vpbs50_record-rain.xml"))!);
  const p = posts[0];

  test("type:heavy-rain / value:warning / 都道府県 target", () => {
    expect(posts.length).toBe(1);
    expect(p.tags).toContain("type:heavy-rain");
    expect(p.tags).toContain("value:warning");
    expect(p.tags).toContain("target:jp-nagano");
  });
  test("R06 大雨（heavy-rain-warning）と type が異なり区別可能", () => {
    expect(p.tags).not.toContain("type:heavy-rain-warning");
    expect(p.dedupeKey.startsWith("heavy-rain:jp-nagano:warning")).toBe(true);
  });
});

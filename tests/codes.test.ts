/**
 * tests/codes.test.ts
 * コード表モジュールの基本検証
 */

import { describe, test, expect } from "bun:test";
import { lookupKindCode, KIND_CODE_TABLE, PHENOMENON_TO_BSAF_TYPE } from "../src/codes/kindCode";
import { lookupSignificancy, SIGNIFICANCY_TABLE } from "../src/codes/significancy";

describe("kindCode (別表3)", () => {
  test("Code 10 = レベル2大雨注意報 / heavy-rain / advisory / level=2", () => {
    const k = lookupKindCode("10");
    expect(k).not.toBeNull();
    expect(k!.name).toBe("レベル2大雨注意報");
    expect(k!.phenomenon).toBe("heavy-rain");
    expect(k!.severity).toBe("advisory");
    expect(k!.level).toBe(2);
  });

  test("Code 15 = 強風注意報 / wind / advisory / level=null", () => {
    const k = lookupKindCode("15");
    expect(k!.name).toBe("強風注意報");
    expect(k!.phenomenon).toBe("wind");
    expect(k!.severity).toBe("advisory");
    expect(k!.level).toBeNull();
  });

  test("Code 33 = レベル5大雨特別警報", () => {
    const k = lookupKindCode("33");
    expect(k!.name).toBe("レベル5大雨特別警報");
    expect(k!.severity).toBe("special-warning");
    expect(k!.level).toBe(5);
  });

  test("Code 49 = レベル4土砂災害危険警報", () => {
    const k = lookupKindCode("49");
    expect(k!.name).toBe("レベル4土砂災害危険警報");
    expect(k!.phenomenon).toBe("landslide");
    expect(k!.severity).toBe("danger-warning");
    expect(k!.level).toBe(4);
  });

  test("Code 00 = 解除", () => {
    const k = lookupKindCode("00");
    expect(k!.name).toBe("解除");
    expect(k!.severity).toBe("cancelled");
  });

  test("未知コード → null", () => {
    expect(lookupKindCode("99")).toBeNull();
  });

  test("別表3 の全エントリ数（実装すべき値）", () => {
    // 解除1 + VPWW58 暴風6 + VPWW55 大雨4 + VPWW56 土砂4 + VPWW57 高潮4
    //   + VPWW59 波浪3 + VPWW60 大雪3 + VPWW61 その他12（04,18 洪水含む） = 37
    expect(Object.keys(KIND_CODE_TABLE).length).toBe(37);
  });

  test("Phenomenon → BSAF type 値が空でない", () => {
    for (const [p, t] of Object.entries(PHENOMENON_TO_BSAF_TYPE)) {
      expect(t.length).toBeGreaterThan(0);
      expect(t.endsWith("-warning")).toBe(true);
    }
  });
});

describe("significancy (別表5)", () => {
  test("Code 21 = 警戒レベル2 / level2 / level=2 / rank=21", () => {
    const s = lookupSignificancy("21");
    expect(s!.name).toBe("警戒レベル2");
    expect(s!.value).toBe("level2");
    expect(s!.level).toBe(2);
    expect(s!.rank).toBe(21);
  });

  test("Code 51 = 警戒レベル5相当 / level5", () => {
    const s = lookupSignificancy("51");
    expect(s!.value).toBe("level5");
    expect(s!.level).toBe(5);
    expect(s!.rank).toBe(51);
  });

  test("Code 20 = 注意報級 / advisory / level=null", () => {
    const s = lookupSignificancy("20");
    expect(s!.value).toBe("advisory");
    expect(s!.level).toBeNull();
  });

  test("Code 01 = 注意報級未満 / value=null（投稿対象外）", () => {
    const s = lookupSignificancy("01");
    expect(s!.value).toBeNull();
  });

  test("rank の単調性（51 > 41 > 31 > 22 > 21 > 11 > 01 > 00）", () => {
    const r = (c: string) => lookupSignificancy(c)!.rank;
    expect(r("51")).toBeGreaterThan(r("41"));
    expect(r("41")).toBeGreaterThan(r("31"));
    expect(r("31")).toBeGreaterThan(r("22"));
    expect(r("22")).toBeGreaterThan(r("21"));
    expect(r("21")).toBeGreaterThan(r("11"));
    expect(r("11")).toBeGreaterThan(r("01"));
    expect(r("01")).toBeGreaterThan(r("00"));
  });

  test("別表5 の全エントリ数", () => {
    // 00, 01, 11, 20, 21, 22, 30, 31, 41, 50, 51 = 11
    expect(Object.keys(SIGNIFICANCY_TABLE).length).toBe(11);
  });
});

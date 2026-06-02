/**
 * tests/r06Warning.test.ts
 * VPWW55-61 パーサーの実電文サンプルに対する動作検証
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseR06WarningXml } from "../src/parsers/r06Warning";

const FIXTURES = resolve(__dirname, "fixtures");
const load = (name: string) => readFileSync(resolve(FIXTURES, name), "utf-8");

describe("VPWW55（大雨）— 美幌町 Lv2", () => {
  const xml = load("vpww55_heavy-rain_lv2.xml");
  const parsed = parseR06WarningXml(xml);

  test("通常電文として正しくパースされる", () => {
    expect(parsed).not.toBeNull();
    expect(parsed!.telegramStatus).toBe("通常");
    expect(parsed!.controlTitle).toContain("大雨");
    expect(parsed!.editorialOffice.length).toBeGreaterThan(0);
  });

  test("市町村等 Item が抽出される", () => {
    expect(parsed!.municipalityItems.length).toBeGreaterThan(0);
  });

  test("美幌町に レベル2大雨注意報 が含まれる（Significancy=21）", () => {
    const biboro = parsed!.municipalityItems.find((i) => i.areaName === "美幌町");
    expect(biboro).toBeDefined();
    const activeKind = biboro!.kinds.find((k) => k.code === "10");
    expect(activeKind).toBeDefined();
    expect(activeKind!.name).toBe("レベル２大雨注意報");
    expect(activeKind!.status).toBe("発表");

    const sig = activeKind!.significancies.find((s) => s.code === "21");
    expect(sig).toBeDefined();
    expect(sig!.type).toBe("大雨浸水危険度");
  });
});

describe("VPWW56（土砂）— 村上市 Lv2", () => {
  const xml = load("vpww56_landslide_lv2.xml");
  const parsed = parseR06WarningXml(xml);

  test("通常電文・控制 Title に「土砂」を含む", () => {
    expect(parsed).not.toBeNull();
    expect(parsed!.controlTitle).toContain("土砂");
  });

  test("村上市に レベル2土砂災害注意報 が含まれる", () => {
    const muraKami = parsed!.municipalityItems.find((i) => i.areaName === "村上市");
    expect(muraKami).toBeDefined();
    const kind = muraKami!.kinds.find((k) => k.code === "29");
    expect(kind).toBeDefined();
    expect(kind!.name).toBe("レベル２土砂災害注意報");
    const sig = kind!.significancies.find((s) => s.code === "21");
    expect(sig).toBeDefined();
    expect(sig!.type).toBe("土砂災害危険度");
  });
});

describe("VPWW58（暴風）— 八丈町 強風注意報", () => {
  const xml = load("vpww58_wind_advisory.xml");
  const parsed = parseR06WarningXml(xml);

  test("Control Title に「暴風」", () => {
    expect(parsed).not.toBeNull();
    expect(parsed!.controlTitle).toContain("暴風");
  });

  test("八丈町に 強風注意報 と Significancy=注意報級(20)", () => {
    const hachijo = parsed!.municipalityItems.find((i) => i.areaName === "八丈町");
    expect(hachijo).toBeDefined();
    const kind = hachijo!.kinds.find((k) => k.code === "15");
    expect(kind).toBeDefined();
    const sig = kind!.significancies.find((s) => s.code === "20");
    expect(sig).toBeDefined();
    expect(sig!.type).toBe("風危険度");
  });

  test("量的予想に風向（南西）と最大風速（15m/s）が含まれる", () => {
    const hachijo = parsed!.municipalityItems.find((i) => i.areaName === "八丈町")!;
    const kind = hachijo.kinds.find((k) => k.code === "15")!;
    const dir = kind.quantitative.find((q) => q.attrType === "風向");
    expect(dir).toBeDefined();
    expect(dir!.value).toBe("南西");
    const speed = kind.quantitative.find((q) => q.attrType === "最大風速");
    expect(speed).toBeDefined();
    expect(speed!.value).toBe("15");
    expect(speed!.unit).toBe("m/s");
  });
});

describe("VPWW58（暴風）— 解除電文", () => {
  const xml = load("vpww58_wind_cancellation.xml");
  const parsed = parseR06WarningXml(xml);

  test("通常電文としてパースされる", () => {
    expect(parsed).not.toBeNull();
  });

  test("留萌地方の各市町村に Status=解除 の Kind が含まれる", () => {
    const items = parsed!.municipalityItems;
    expect(items.length).toBeGreaterThan(0);
    const hasCancellation = items.some((i) =>
      i.kinds.some((k) => k.status === "解除" && k.code === "15"),
    );
    expect(hasCancellation).toBe(true);
  });
});

describe("VPWW57（高潮）— 南城市 Lv2 高潮注意報", () => {
  const xml = load("vpww57_storm-surge_lv2.xml");
  const parsed = parseR06WarningXml(xml);

  test("Control Title に「高潮」", () => {
    expect(parsed).not.toBeNull();
    expect(parsed!.controlTitle).toContain("高潮");
  });

  test("南城市に レベル2高潮注意報（code=19）と Significancy=21（高潮危険度）", () => {
    const nanjo = parsed!.municipalityItems.find((i) => i.areaName === "南城市");
    expect(nanjo).toBeDefined();
    const kind = nanjo!.kinds.find((k) => k.code === "19");
    expect(kind).toBeDefined();
    expect(kind!.name).toBe("レベル２高潮注意報");
    expect(kind!.status).toBe("発表");
    const sig = kind!.significancies.find((s) => s.code === "21");
    expect(sig).toBeDefined();
    expect(sig!.type).toBe("高潮危険度");
  });

  test("量的予想に 高潮基準超過 / 高潮ピーク の 2 種の潮位（2.0m）が並列で出現", () => {
    const nanjo = parsed!.municipalityItems.find((i) => i.areaName === "南城市")!;
    const kind = nanjo.kinds.find((k) => k.code === "19")!;
    const over = kind.quantitative.find((q) => q.propertyType === "高潮基準超過");
    const peak = kind.quantitative.find((q) => q.propertyType === "高潮ピーク");
    expect(over).toBeDefined();
    expect(peak).toBeDefined();
    expect(over!.attrType).toBe("潮位");
    expect(over!.value).toBe("2.0");
    expect(over!.unit).toBe("m");
    expect(peak!.attrType).toBe("潮位");
    expect(peak!.value).toBe("2.0");
  });

  test("各潮位 Quantitative に Base/Time が time として取得される", () => {
    const nanjo = parsed!.municipalityItems.find((i) => i.areaName === "南城市")!;
    const kind = nanjo.kinds.find((k) => k.code === "19")!;
    const over = kind.quantitative.find((q) => q.propertyType === "高潮基準超過")!;
    const peak = kind.quantitative.find((q) => q.propertyType === "高潮ピーク")!;
    expect(over.time).toBe("2026-06-01T17:00:00+09:00");
    expect(peak.time).toBe("2026-06-01T19:00:00+09:00");
  });

  test("CriteriaPeriod（Lv4 到達予想期間）が抽出される", () => {
    const nanjo = parsed!.municipalityItems.find((i) => i.areaName === "南城市")!;
    const kind = nanjo.kinds.find((k) => k.code === "19")!;
    expect(kind.criteriaPeriods.length).toBeGreaterThan(0);
    const cp = kind.criteriaPeriods[0];
    expect(cp.criteriaClassCode).toBe("41");
    expect(cp.criteriaClassName).toBe("警戒レベル４相当");
    expect(cp.time).toBe("2026-06-01T17:00:00+09:00");
    expect(cp.duration).toBe("PT3H");
    expect(cp.sentence).toContain("警戒レベル４相当");
    expect(cp.propertyType).toBe("高潮危険度");
  });
});

describe("VPWW57（高潮）— 解除電文（南城市）", () => {
  const xml = load("vpww57_storm-surge_cancellation.xml");
  const parsed = parseR06WarningXml(xml);

  test("通常電文としてパースされる", () => {
    expect(parsed).not.toBeNull();
    expect(parsed!.controlTitle).toContain("高潮");
  });

  test("南城市に Status=解除 の Kind が含まれる", () => {
    const nanjo = parsed!.municipalityItems.find((i) => i.areaName === "南城市");
    expect(nanjo).toBeDefined();
    const cancelled = nanjo!.kinds.find((k) => k.status === "解除" && k.code === "19");
    expect(cancelled).toBeDefined();
  });
});

describe("VPWW59（波浪）— 八丈町 波浪注意報", () => {
  const xml = load("vpww59_wave_advisory.xml");
  const parsed = parseR06WarningXml(xml);

  test("Control Title に「波浪」", () => {
    expect(parsed!.controlTitle).toContain("波浪");
  });

  test("八丈町に 波浪注意報 と 波高 3m", () => {
    const hachijo = parsed!.municipalityItems.find((i) => i.areaName === "八丈町")!;
    const kind = hachijo.kinds.find((k) => k.code === "16")!;
    expect(kind.name).toBe("波浪注意報");
    const wave = kind.quantitative.find((q) => q.attrType === "波高");
    expect(wave).toBeDefined();
    expect(wave!.value).toBe("3");
    expect(wave!.unit).toBe("m");
  });
});

describe("VPWW61（その他）— 札幌市 雷＋濃霧 複数 Kind 並列", () => {
  const xml = load("vpww61_thunder-fog.xml");
  const parsed = parseR06WarningXml(xml);

  test("Control Title に「その他注意報」", () => {
    expect(parsed!.controlTitle).toContain("その他注意報");
  });

  test("札幌市の Item に 雷注意報 と 濃霧注意報 の 2 つの Kind が並列で含まれる", () => {
    const sapporo = parsed!.municipalityItems.find((i) => i.areaName === "札幌市");
    expect(sapporo).toBeDefined();
    const thunder = sapporo!.kinds.find((k) => k.code === "14");
    const fog     = sapporo!.kinds.find((k) => k.code === "20");
    expect(thunder).toBeDefined();
    expect(fog).toBeDefined();
    expect(thunder!.name).toBe("雷注意報");
    expect(fog!.name).toBe("濃霧注意報");
  });

  test("雷注意報の Addition に「突風」「ひょう」が含まれる", () => {
    const sapporo = parsed!.municipalityItems.find((i) => i.areaName === "札幌市")!;
    const thunder = sapporo.kinds.find((k) => k.code === "14")!;
    expect(thunder.additions).toContain("突風");
    expect(thunder.additions).toContain("ひょう");
  });

  test("濃霧注意報の量的予想に 視程 200m が含まれる", () => {
    const sapporo = parsed!.municipalityItems.find((i) => i.areaName === "札幌市")!;
    const fog = sapporo.kinds.find((k) => k.code === "20")!;
    const vis = fog.quantitative.find((q) => q.attrType === "視程");
    expect(vis).toBeDefined();
    expect(vis!.value).toBe("200");
    expect(vis!.unit).toBe("m");
    expect(vis!.condition).toBe("以下");
  });
});

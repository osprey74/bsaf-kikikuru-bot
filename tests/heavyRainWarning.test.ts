/**
 * tests/heavyRainWarning.test.ts
 * VPWW55/56/57/58 パーサー & マッパーのユニットテスト
 *
 * 実行: bun test
 */

import { describe, expect, test } from "bun:test";
import {
  parseHeavyRainWarningXml,
  hasAnyActiveWarning,
  hasHighLevelWarning,
} from "../src/parsers/heavyRainWarning";
import { mapToBsafPosts } from "../src/bsaf/mapper";
import { prefectureFromMunicipalityCode } from "../src/bsaf/prefectures";

// ============================================================
// テスト用サンプルXML
// ============================================================

/** Lv4 大雨危険警報（VPWW55） 正常系 / 北海道2市 */
const SAMPLE_VPWW55_LV4 = `<?xml version="1.0" encoding="UTF-8"?>
<Report xmlns="http://xml.kishou.go.jp/jmaxml1/informationBusiness/meteorology1/">
  <Control>
    <Title>気象警報・注意報（Ｒ０６）（大雨）</Title>
    <DateTime>2026-05-28T12:00:00Z</DateTime>
    <Status>通常</Status>
    <EditorialOffice>札幌管区気象台</EditorialOffice>
    <PublishingOffice>札幌管区気象台</PublishingOffice>
  </Control>
  <Head>
    <Title>大雨に関する警戒レベル情報</Title>
    <ReportDateTime>2026-05-28T21:00:00+09:00</ReportDateTime>
    <TargetDateTime>2026-05-28T21:00:00+09:00</TargetDateTime>
    <InfoType>発表</InfoType>
    <Serial>1</Serial>
    <InfoKind>気象警報・注意報</InfoKind>
    <Headline>
      <Text>北海道では、28日夜遅くまで土砂災害に警戒してください。</Text>
    </Headline>
  </Head>
  <Body>
    <Warning type="気象警報・注意報（市町村等）">
      <Item>
        <Kind>
          <Name>大雨危険警報</Name>
          <Code>14</Code>
          <Status>発表</Status>
        </Kind>
        <Areas codeType="市町村等">
          <Area><Name>函館市</Name><Code>011002</Code></Area>
          <Area><Name>北斗市</Name><Code>011011</Code></Area>
        </Areas>
      </Item>
    </Warning>
  </Body>
</Report>`;

/** 訓練電文（スキップされるべき）*/
const SAMPLE_TRAINING = SAMPLE_VPWW55_LV4.replace(
  "<Status>通常</Status>",
  "<Status>訓練</Status>"
);

/** 土砂災害 Lv4（VPWW56）*/
const SAMPLE_VPWW56_LANDSLIDE = SAMPLE_VPWW55_LV4
  .replace("大雨に関する警戒レベル情報", "土砂災害に関する警戒レベル情報")
  .replace("<Name>大雨危険警報</Name>", "<Name>土砂災害危険警報</Name>")
  .replace(/<Code>14<\/Code>/g, "<Code>16</Code>");

/** Lv3 大雨警報のみ */
const SAMPLE_LV3_ONLY = SAMPLE_VPWW55_LV4
  .replace("<Name>大雨危険警報</Name>", "<Name>大雨警報</Name>")
  .replace(/<Code>14<\/Code>/g, "<Code>03</Code>");

/** Lv2 大雨注意報のみ */
const SAMPLE_LV2_ONLY = SAMPLE_VPWW55_LV4
  .replace("<Name>大雨危険警報</Name>", "<Name>大雨注意報</Name>")
  .replace(/<Code>14<\/Code>/g, "<Code>02</Code>");

/** Lv4 が解除された電文（status=解除）*/
const SAMPLE_LV4_CANCEL_ITEM = SAMPLE_VPWW55_LV4.replace(
  "<Status>発表</Status>",
  "<Status>解除</Status>"
);

/** 取消電文（infoType=取消）*/
const SAMPLE_CANCEL_INFOTYPE = SAMPLE_VPWW55_LV4.replace(
  "<InfoType>発表</InfoType>",
  "<InfoType>取消</InfoType>"
);

/** 複数県またがり (北海道 + 青森県) */
const SAMPLE_MULTI_PREFECTURE = SAMPLE_VPWW55_LV4.replace(
  "<Area><Name>北斗市</Name><Code>011011</Code></Area>",
  "<Area><Name>北斗市</Name><Code>011011</Code></Area>\n          <Area><Name>青森市</Name><Code>022012</Code></Area>"
);

// ============================================================
// パーサーテスト
// ============================================================

describe("parseHeavyRainWarningXml", () => {
  test("正常系: Lv4大雨危険警報をパースできる", () => {
    const result = parseHeavyRainWarningXml(SAMPLE_VPWW55_LV4);
    expect(result).not.toBeNull();
    expect(result!.warningType).toBe("heavy-rain");
    expect(result!.infoType).toBe("発表");
    expect(result!.editorialOffice).toBe("札幌管区気象台");
    expect(result!.level4Areas.length).toBe(2);
    expect(result!.level5Areas.length).toBe(0);
    expect(result!.level4Areas[0]!.name).toBe("函館市");
    expect(result!.level4Areas[0]!.code).toBe("011002");
  });

  test("土砂災害（VPWW56）を landslide と判定", () => {
    const result = parseHeavyRainWarningXml(SAMPLE_VPWW56_LANDSLIDE);
    expect(result).not.toBeNull();
    expect(result!.warningType).toBe("landslide");
    expect(result!.level4Areas.length).toBe(2);
  });

  test("Lv3 警報を正しく level3Areas に分類", () => {
    const result = parseHeavyRainWarningXml(SAMPLE_LV3_ONLY);
    expect(result).not.toBeNull();
    expect(result!.level3Areas.length).toBe(2);
    expect(result!.level4Areas.length).toBe(0);
  });

  test("Lv2 注意報を正しく level2Areas に分類", () => {
    const result = parseHeavyRainWarningXml(SAMPLE_LV2_ONLY);
    expect(result).not.toBeNull();
    expect(result!.level2Areas.length).toBe(2);
    expect(result!.level4Areas.length).toBe(0);
  });

  test("status=解除 のItemは cancelledAreas に振り分けられ active には入らない", () => {
    const result = parseHeavyRainWarningXml(SAMPLE_LV4_CANCEL_ITEM);
    expect(result).not.toBeNull();
    expect(result!.cancelledAreas.length).toBe(2);
    expect(result!.level4Areas.length).toBe(0);
  });

  test("訓練電文は null", () => {
    expect(parseHeavyRainWarningXml(SAMPLE_TRAINING)).toBeNull();
  });

  test("不正なXMLは null", () => {
    expect(parseHeavyRainWarningXml("<broken<xml")).toBeNull();
  });

  test("空文字列は null", () => {
    expect(parseHeavyRainWarningXml("")).toBeNull();
  });
});

describe("hasAnyActiveWarning / hasHighLevelWarning", () => {
  test("Lv4あり: 両方 true", () => {
    const r = parseHeavyRainWarningXml(SAMPLE_VPWW55_LV4)!;
    expect(hasAnyActiveWarning(r)).toBe(true);
    expect(hasHighLevelWarning(r)).toBe(true);
  });

  test("Lv3のみ: any=true / high=false", () => {
    const r = parseHeavyRainWarningXml(SAMPLE_LV3_ONLY)!;
    expect(hasAnyActiveWarning(r)).toBe(true);
    expect(hasHighLevelWarning(r)).toBe(false);
  });

  test("Lv2のみ: any=true / high=false", () => {
    const r = parseHeavyRainWarningXml(SAMPLE_LV2_ONLY)!;
    expect(hasAnyActiveWarning(r)).toBe(true);
    expect(hasHighLevelWarning(r)).toBe(false);
  });

  test("status=解除 のみの電文: any=false", () => {
    const r = parseHeavyRainWarningXml(SAMPLE_LV4_CANCEL_ITEM)!;
    expect(hasAnyActiveWarning(r)).toBe(false);
  });
});

// ============================================================
// 都道府県マッピング
// ============================================================

describe("prefectureFromMunicipalityCode", () => {
  test("011002 → 北海道", () => {
    const p = prefectureFromMunicipalityCode("011002");
    expect(p?.target).toBe("jp-hokkaido");
    expect(p?.name).toBe("北海道");
  });

  test("131016 → 東京都", () => {
    const p = prefectureFromMunicipalityCode("131016");
    expect(p?.target).toBe("jp-tokyo");
  });

  test("471006 → 沖縄県", () => {
    const p = prefectureFromMunicipalityCode("471006");
    expect(p?.target).toBe("jp-okinawa");
  });

  test("未知コード（99）は null", () => {
    expect(prefectureFromMunicipalityCode("991234")).toBeNull();
  });

  test("空文字列は null", () => {
    expect(prefectureFromMunicipalityCode("")).toBeNull();
  });
});

// ============================================================
// マッパーテスト
// ============================================================

describe("mapToBsafPosts", () => {
  test("Lv4 単一県: 1ポスト生成", () => {
    const parsed = parseHeavyRainWarningXml(SAMPLE_VPWW55_LV4)!;
    const posts = mapToBsafPosts(parsed);
    expect(posts.length).toBe(1);
    expect(posts[0]!.dedupeKey).toBe("heavy-rain:jp-hokkaido:level4");
  });

  test("BSAFタグ配列が必須6個でスロット順どおり", () => {
    const parsed = parseHeavyRainWarningXml(SAMPLE_VPWW55_LV4)!;
    const post = mapToBsafPosts(parsed)[0]!;
    expect(post.tags.length).toBe(6);
    expect(post.tags[0]).toBe("bsaf:v1");
    expect(post.tags[1]).toBe("type:heavy-rain-warning");
    expect(post.tags[2]).toBe("value:level4");
    expect(post.tags[3]).toMatch(/^time:\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(post.tags[4]).toBe("target:jp-hokkaido");
    expect(post.tags[5]).toBe("source:jma");
  });

  test("time タグは UTC 形式（末尾Z）", () => {
    const parsed = parseHeavyRainWarningXml(SAMPLE_VPWW55_LV4)!;
    const post = mapToBsafPosts(parsed)[0]!;
    const timeTag = post.tags.find((t) => t.startsWith("time:"))!;
    expect(timeTag.endsWith("Z")).toBe(true);
  });

  test("土砂災害のtypeは landslide-warning", () => {
    const parsed = parseHeavyRainWarningXml(SAMPLE_VPWW56_LANDSLIDE)!;
    const post = mapToBsafPosts(parsed)[0]!;
    expect(post.tags).toContain("type:landslide-warning");
  });

  test("複数県にまたがる電文は県ごとに別ポスト", () => {
    const parsed = parseHeavyRainWarningXml(SAMPLE_MULTI_PREFECTURE)!;
    const posts = mapToBsafPosts(parsed);
    expect(posts.length).toBe(2);
    const targets = posts.map((p) =>
      p.tags.find((t) => t.startsWith("target:"))!
    );
    expect(targets).toContain("target:jp-hokkaido");
    expect(targets).toContain("target:jp-aomori");
  });

  test("Lv3 のみでも投稿が生成される（BSAFポリシー: 全レベル配信）", () => {
    const parsed = parseHeavyRainWarningXml(SAMPLE_LV3_ONLY)!;
    const posts = mapToBsafPosts(parsed);
    expect(posts.length).toBe(1);
    expect(posts[0]!.tags).toContain("value:level3");
  });

  test("Lv2 のみでも投稿が生成される", () => {
    const parsed = parseHeavyRainWarningXml(SAMPLE_LV2_ONLY)!;
    const posts = mapToBsafPosts(parsed);
    expect(posts.length).toBe(1);
    expect(posts[0]!.tags).toContain("value:level2");
  });

  test("部分解除エリアは cancelled ポストとして生成", () => {
    const parsed = parseHeavyRainWarningXml(SAMPLE_LV4_CANCEL_ITEM)!;
    const posts = mapToBsafPosts(parsed);
    expect(posts.length).toBe(1);
    expect(posts[0]!.tags).toContain("value:cancelled");
    expect(posts[0]!.dedupeKey).toBe("heavy-rain:jp-hokkaido:cancelled");
  });

  test("取消電文（infoType=取消）は解除ポスト生成", () => {
    const parsed = parseHeavyRainWarningXml(SAMPLE_CANCEL_INFOTYPE)!;
    const posts = mapToBsafPosts(parsed);
    expect(posts.length).toBe(1);
    expect(posts[0]!.tags).toContain("value:cancelled");
  });

  test("投稿本文に市町村名・気象庁出典が含まれる", () => {
    const parsed = parseHeavyRainWarningXml(SAMPLE_VPWW55_LV4)!;
    const text = mapToBsafPosts(parsed)[0]!.text;
    expect(text).toContain("函館市");
    expect(text).toContain("北斗市");
    expect(text).toContain("北海道");
    expect(text).toContain("気象庁");
  });
});

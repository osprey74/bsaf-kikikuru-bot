/**
 * src/dry-run.ts
 * 投稿せずに、典型的なサンプル電文を mapToBsafPosts に通して
 * 投稿テキストとBSAFタグを目視確認するためのドライランスクリプト。
 *
 * 実行: bun run src/dry-run.ts
 */

import { parseHeavyRainWarningXml } from "./parsers/heavyRainWarning";
import { mapToBsafPosts } from "./bsaf/mapper";

// ============================================================
// サンプル電文（VPWW55〜58 想定）
// ============================================================

const SAMPLES: Array<{ label: string; xml: string }> = [
  {
    label: "VPWW55 Lv4 大雨危険警報（北海道 2市）",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Report>
  <Control>
    <Title>気象警報・注意報（大雨）</Title>
    <DateTime>2026-05-28T12:00:00Z</DateTime>
    <Status>通常</Status>
    <EditorialOffice>札幌管区気象台</EditorialOffice>
  </Control>
  <Head>
    <Title>大雨に関する警戒レベル情報</Title>
    <ReportDateTime>2026-05-28T21:00:00+09:00</ReportDateTime>
    <InfoType>発表</InfoType>
    <Headline><Text>北海道では、28日夜遅くまで土砂災害に警戒してください。</Text></Headline>
  </Head>
  <Body>
    <Warning>
      <Item>
        <Kind><Name>大雨危険警報</Name><Code>14</Code><Status>発表</Status></Kind>
        <Areas codeType="市町村等">
          <Area><Name>函館市</Name><Code>011002</Code></Area>
          <Area><Name>北斗市</Name><Code>011011</Code></Area>
        </Areas>
      </Item>
    </Warning>
  </Body>
</Report>`,
  },
  {
    label: "VPWW55 Lv5 大雨特別警報（東京都 多摩地区）",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Report>
  <Control>
    <Title>気象警報・注意報（大雨）</Title>
    <DateTime>2026-07-15T03:00:00Z</DateTime>
    <Status>通常</Status>
    <EditorialOffice>気象庁</EditorialOffice>
  </Control>
  <Head>
    <Title>大雨に関する警戒レベル情報</Title>
    <ReportDateTime>2026-07-15T12:00:00+09:00</ReportDateTime>
    <InfoType>発表</InfoType>
    <Headline><Text>東京都では、これまでに経験したことのないような大雨となっています。命を守る行動をとってください。</Text></Headline>
  </Head>
  <Body>
    <Warning>
      <Item>
        <Kind><Name>大雨特別警報</Name><Code>15</Code><Status>発表</Status></Kind>
        <Areas codeType="市町村等">
          <Area><Name>八王子市</Name><Code>132012</Code></Area>
          <Area><Name>立川市</Name><Code>132021</Code></Area>
          <Area><Name>武蔵野市</Name><Code>132030</Code></Area>
          <Area><Name>三鷹市</Name><Code>132047</Code></Area>
        </Areas>
      </Item>
    </Warning>
  </Body>
</Report>`,
  },
  {
    label: "VPWW56 Lv4 土砂災害危険警報（熊本県・大分県 複数県）",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Report>
  <Control>
    <Title>気象警報・注意報（土砂災害）</Title>
    <DateTime>2026-06-20T05:00:00Z</DateTime>
    <Status>通常</Status>
    <EditorialOffice>福岡管区気象台</EditorialOffice>
  </Control>
  <Head>
    <Title>土砂災害に関する警戒レベル情報</Title>
    <ReportDateTime>2026-06-20T14:00:00+09:00</ReportDateTime>
    <InfoType>発表</InfoType>
    <Headline><Text>九州北部では土砂災害の危険度が高まっています。</Text></Headline>
  </Head>
  <Body>
    <Warning>
      <Item>
        <Kind><Name>土砂災害危険警報</Name><Code>16</Code><Status>発表</Status></Kind>
        <Areas codeType="市町村等">
          <Area><Name>熊本市中央区</Name><Code>431016</Code></Area>
          <Area><Name>八代市</Name><Code>432024</Code></Area>
          <Area><Name>水俣市</Name><Code>432059</Code></Area>
          <Area><Name>大分市</Name><Code>442011</Code></Area>
          <Area><Name>別府市</Name><Code>442020</Code></Area>
        </Areas>
      </Item>
    </Warning>
  </Body>
</Report>`,
  },
  {
    label: "VPWW58 Lv3 洪水警報（千葉県 単一市）",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Report>
  <Control>
    <Title>気象警報・注意報（洪水）</Title>
    <DateTime>2026-09-10T01:00:00Z</DateTime>
    <Status>通常</Status>
    <EditorialOffice>銚子地方気象台</EditorialOffice>
  </Control>
  <Head>
    <Title>洪水に関する警戒レベル情報</Title>
    <ReportDateTime>2026-09-10T10:00:00+09:00</ReportDateTime>
    <InfoType>発表</InfoType>
    <Headline><Text>利根川流域で氾濫の恐れがあります。</Text></Headline>
  </Head>
  <Body>
    <Warning>
      <Item>
        <Kind><Name>洪水警報</Name><Code>04</Code><Status>発表</Status></Kind>
        <Areas codeType="市町村等">
          <Area><Name>銚子市</Name><Code>122025</Code></Area>
        </Areas>
      </Item>
    </Warning>
  </Body>
</Report>`,
  },
  {
    label: "VPWW55 Lv2 大雨注意報（沖縄県 3市）",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Report>
  <Control>
    <Title>気象警報・注意報（大雨）</Title>
    <DateTime>2026-05-30T22:00:00Z</DateTime>
    <Status>通常</Status>
    <EditorialOffice>沖縄気象台</EditorialOffice>
  </Control>
  <Head>
    <Title>大雨に関する警戒レベル情報</Title>
    <ReportDateTime>2026-05-31T07:00:00+09:00</ReportDateTime>
    <InfoType>発表</InfoType>
    <Headline><Text>沖縄本島地方では大雨に注意してください。</Text></Headline>
  </Head>
  <Body>
    <Warning>
      <Item>
        <Kind><Name>大雨注意報</Name><Code>02</Code><Status>発表</Status></Kind>
        <Areas codeType="市町村等">
          <Area><Name>那覇市</Name><Code>472018</Code></Area>
          <Area><Name>宜野湾市</Name><Code>472051</Code></Area>
          <Area><Name>浦添市</Name><Code>472085</Code></Area>
        </Areas>
      </Item>
    </Warning>
  </Body>
</Report>`,
  },
  {
    label: "VPWW55 解除（北海道 status=解除）",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Report>
  <Control>
    <Title>気象警報・注意報（大雨）</Title>
    <DateTime>2026-05-29T03:00:00Z</DateTime>
    <Status>通常</Status>
    <EditorialOffice>札幌管区気象台</EditorialOffice>
  </Control>
  <Head>
    <Title>大雨に関する警戒レベル情報</Title>
    <ReportDateTime>2026-05-29T12:00:00+09:00</ReportDateTime>
    <InfoType>発表</InfoType>
    <Headline><Text>函館市・北斗市の大雨危険警報を解除します。</Text></Headline>
  </Head>
  <Body>
    <Warning>
      <Item>
        <Kind><Name>大雨危険警報</Name><Code>14</Code><Status>解除</Status></Kind>
        <Areas codeType="市町村等">
          <Area><Name>函館市</Name><Code>011002</Code></Area>
          <Area><Name>北斗市</Name><Code>011011</Code></Area>
        </Areas>
      </Item>
    </Warning>
  </Body>
</Report>`,
  },
];

// ============================================================
// 実行
// ============================================================

function run(): void {
  console.log("");
  console.log("=".repeat(72));
  console.log("  bsaf-kikikuru-bot — DRY RUN");
  console.log("  投稿は行いません。生成される投稿テキストとBSAFタグを表示します。");
  console.log("=".repeat(72));

  let totalPosts = 0;

  for (const sample of SAMPLES) {
    console.log("");
    console.log("─".repeat(72));
    console.log(`📨 ${sample.label}`);
    console.log("─".repeat(72));

    const parsed = parseHeavyRainWarningXml(sample.xml);
    if (!parsed) {
      console.log("⚠️  パース失敗 or 訓練・試験電文扱い → スキップ");
      continue;
    }

    const posts = mapToBsafPosts(parsed);
    console.log(`生成ポスト数: ${posts.length}`);

    posts.forEach((p, idx) => {
      console.log("");
      console.log(`  📝 Post ${idx + 1}/${posts.length}  (dedupeKey: ${p.dedupeKey})`);
      console.log("  " + "-".repeat(60));
      const indented = p.text.split("\n").map((l) => `  │ ${l}`).join("\n");
      console.log(indented);
      console.log("  " + "-".repeat(60));
      console.log(`  tags (${p.tags.length}個 / ${tagsByteSize(p.tags)}バイト):`);
      p.tags.forEach((t, i) => console.log(`    [${i + 1}] ${t}`));
      console.log(`  本文長: ${p.text.length} 文字`);
    });

    totalPosts += posts.length;
  }

  console.log("");
  console.log("=".repeat(72));
  console.log(`  サマリ: ${SAMPLES.length} 電文 → ${totalPosts} 投稿生成`);
  console.log("=".repeat(72));
  console.log("");
}

function tagsByteSize(tags: string[]): number {
  return tags.reduce((sum, t) => sum + new TextEncoder().encode(t).length, 0);
}

run();

/**
 * src/test-post.ts
 * Bluesky への実投稿テスト用スクリプト。
 *
 * .env に BSKY_IDENTIFIER / BSKY_PASSWORD を設定してから実行する。
 * 引数:
 *   --sample=<index>  どのサンプルを投稿するか（既定: 0）
 *
 * 実行例:
 *   bun run src/test-post.ts --sample=0
 *
 * ⚠️ 実際の Bluesky アカウントに投稿されます。テスト投稿は確認後に削除してください。
 */

import { parseHeavyRainWarningXml } from "./parsers/heavyRainWarning";
import { mapToBsafPosts } from "./bsaf/mapper";
import { post as atpPost } from "./atproto/client";

const SAMPLES: Array<{ label: string; xml: string }> = [
  {
    label: "テスト: 大雨注意報 Lv2 / 北海道 函館市",
    xml: `<?xml version="1.0" encoding="UTF-8"?>
<Report>
  <Control>
    <Title>気象警報・注意報（大雨）</Title>
    <DateTime>${new Date().toISOString()}</DateTime>
    <Status>通常</Status>
    <EditorialOffice>札幌管区気象台</EditorialOffice>
  </Control>
  <Head>
    <Title>大雨に関する警戒レベル情報</Title>
    <ReportDateTime>${new Date().toISOString()}</ReportDateTime>
    <InfoType>発表</InfoType>
    <Headline><Text>これは bsaf-kikikuru-bot の動作確認テストです。気象庁の実電文ではありません。</Text></Headline>
  </Head>
  <Body>
    <Warning>
      <Item>
        <Kind><Name>大雨注意報</Name><Code>02</Code><Status>発表</Status></Kind>
        <Areas codeType="市町村等">
          <Area><Name>函館市</Name><Code>011002</Code></Area>
        </Areas>
      </Item>
    </Warning>
  </Body>
</Report>`,
  },
];

async function main(): Promise<void> {
  // CLI 引数: --sample=N
  const sampleArg = process.argv.find((a) => a.startsWith("--sample="));
  const sampleIdx = sampleArg ? Number(sampleArg.split("=")[1]) : 0;
  const sample = SAMPLES[sampleIdx];

  if (!sample) {
    console.error(`サンプル ${sampleIdx} は存在しません（0..${SAMPLES.length - 1}）`);
    process.exit(1);
  }

  console.log("=".repeat(64));
  console.log("  bsaf-kikikuru-bot — TEST POST");
  console.log("=".repeat(64));
  console.log(`📨 ${sample.label}`);
  console.log("");

  const parsed = parseHeavyRainWarningXml(sample.xml);
  if (!parsed) {
    console.error("❌ パース失敗");
    process.exit(1);
  }

  const posts = mapToBsafPosts(parsed);
  if (posts.length === 0) {
    console.error("❌ 生成ポストなし");
    process.exit(1);
  }

  // 安全のため最初の1件のみ投稿
  const p = posts[0]!;
  console.log("📝 投稿予定:");
  console.log("-".repeat(64));
  console.log(p.text);
  console.log("-".repeat(64));
  console.log(`tags: ${p.tags.join(" / ")}`);
  console.log("");
  console.log("🚀 Bluesky に投稿中...");

  try {
    await atpPost(p.text, p.tags);
    console.log("✅ 投稿完了");
    console.log("");
    console.log("ℹ️  確認後、Bluesky 上でテスト投稿を削除してください。");
  } catch (e) {
    console.error("❌ 投稿失敗:", e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ 予期せぬエラー:", e);
  process.exit(1);
});

/**
 * scripts/dry-bosai.ts
 * 府県気象防災速報（VPBS50）サンプル電文のパース＆マッピング dry-run
 */
import { readFileSync } from "node:fs";
import { parseBosaiReportXml } from "../src/parsers/bosaiReport";
import { mapBosaiToBsafPosts } from "../src/bsaf/bosaiMapper";

const samples = [
  { label: "線状降水帯 直前予測（東京都）", path: "tests/fixtures/vpbs50_linear-rainband_imminent.xml" },
  { label: "記録的短時間大雨（スキップ想定）", path: "tests/fixtures/vpbs50_record-rain_skip.xml" },
];

for (const s of samples) {
  console.log("=".repeat(70));
  console.log(`[${s.label}] ${s.path}`);
  console.log("=".repeat(70));

  const xml = readFileSync(s.path, "utf-8");
  const parsed = parseBosaiReportXml(xml);
  if (!parsed) {
    console.log("(parsed === null)");
    continue;
  }

  console.log("controlTitle    :", parsed.controlTitle);
  console.log("headTitle       :", parsed.headTitle);
  console.log("subKind         :", parsed.subKind);
  console.log("infoType        :", parsed.infoType);
  console.log("reportDateTime  :", parsed.reportDateTime);
  console.log("areaNames/codes :", parsed.areaNames, parsed.areaCodes);
  console.log("headlineText    :", parsed.headlineText.slice(0, 80));

  const posts = mapBosaiToBsafPosts(parsed);
  console.log(`\n  → 生成投稿: ${posts.length} 件`);
  for (const p of posts) {
    console.log("\n--- post ---");
    console.log("dedupeKey:", p.dedupeKey);
    console.log("tags     :", p.tags);
    console.log("text len :", [...p.text].length, "文字");
    console.log(p.text);
  }
  console.log();
}

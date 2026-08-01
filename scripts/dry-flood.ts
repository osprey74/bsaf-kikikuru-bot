/**
 * scripts/dry-flood.ts
 * 指定河川洪水予報（VXKO）サンプル電文のパース＆マッピング dry-run（実機検証）
 */
import { readFileSync } from "node:fs";
import { parseFloodForecastXml } from "../src/parsers/floodForecast";
import { mapFloodToBsafPosts } from "../src/bsaf/floodMapper";

const samples = [
  { label: "発表（Lv2 氾濫注意・山形県）", path: "tests/fixtures/vxko_flood_lv2.xml" },
  { label: "発表（Lv3 氾濫警戒）",         path: "tests/fixtures/vxko_flood_lv3.xml" },
  { label: "解除",                        path: "tests/fixtures/vxko_flood_cancellation.xml" },
];

for (const s of samples) {
  console.log("=".repeat(70));
  console.log(`[${s.label}] ${s.path}`);
  console.log("=".repeat(70));

  const xml = readFileSync(s.path, "utf-8");
  const parsed = parseFloodForecastXml(xml);
  if (!parsed) {
    console.log("(parsed === null)");
    continue;
  }

  console.log("controlTitle    :", parsed.controlTitle);
  console.log("editorialOffice :", parsed.editorialOffice);
  console.log("publishingOffice:", parsed.publishingOffice);
  console.log("infoType        :", parsed.infoType);
  console.log("reportDateTime  :", parsed.reportDateTime);
  console.log("headlineText    :", parsed.headlineText);
  console.log("groups          :", parsed.groups.length);
  for (const g of parsed.groups) {
    console.log(`  - code=${g.kindCode} name=${g.kindName} rivers=[${g.rivers.join("、")}] prefs=[${g.prefectures.map((p) => `${p.name}:${p.code}`).join(", ")}]`);
  }
  console.log("inundationAreas :", parsed.inundationAreas.length, "件");

  const posts = mapFloodToBsafPosts(parsed);
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

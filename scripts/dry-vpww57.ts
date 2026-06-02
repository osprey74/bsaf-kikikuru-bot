/**
 * scripts/dry-vpww57.ts
 * VPWW57 サンプル電文のパース＆マッピング dry-run（実機検証）
 */
import { readFileSync } from "node:fs";
import { parseR06WarningXml } from "../src/parsers/r06Warning";
import { mapToBsafPosts } from "../src/bsaf/r06Mapper";

const samples = [
  { label: "発表（Lv2 注意報・南城市）", path: "tests/fixtures/vpww57_storm-surge_lv2.xml" },
  { label: "解除（南城市）",              path: "tests/fixtures/vpww57_storm-surge_cancellation.xml" },
];

for (const s of samples) {
  console.log("=".repeat(70));
  console.log(`[${s.label}] ${s.path}`);
  console.log("=".repeat(70));

  const xml = readFileSync(s.path, "utf-8");
  const parsed = parseR06WarningXml(xml);
  if (!parsed) {
    console.log("(parsed === null)");
    continue;
  }

  console.log("controlTitle      :", parsed.controlTitle);
  console.log("controlDateTimeUtc:", parsed.controlDateTimeUtc);
  console.log("editorialOffice   :", parsed.editorialOffice);
  console.log("headTitle         :", parsed.headTitle);
  console.log("reportDateTime    :", parsed.reportDateTime);
  console.log("infoType          :", parsed.infoType);
  console.log("headlineText      :", parsed.headlineText);
  console.log("municipalityItems :", parsed.municipalityItems.length, "件");

  for (const item of parsed.municipalityItems) {
    for (const k of item.kinds) {
      if (k.status === "発表警報・注意報はなし") continue;
      console.log(`  - ${item.areaName}(${item.areaCode}) ${k.status} ${k.name} code=${k.code}`);
      for (const s of k.significancies) {
        console.log(`      Significancy: type=${s.type} name=${s.name} code=${s.code}`);
      }
      for (const q of k.quantitative) {
        console.log(`      Quantitative: propertyType=${q.propertyType} attrType=${q.attrType} value=${q.value}${q.unit}${q.description ? ` desc=${q.description}` : ""}${q.areaName ? ` area=${q.areaName}` : ""}`);
      }
      for (const a of k.additions) {
        console.log(`      Addition: ${a}`);
      }
    }
  }

  const posts = mapToBsafPosts(parsed);
  console.log(`\n  → 生成投稿: ${posts.length} 件`);
  for (const p of posts) {
    console.log("\n--- post ---");
    console.log("dedupeKey:", p.dedupeKey);
    console.log("tags     :", p.tags);
    console.log("text len :", p.text.length, "文字");
    console.log(p.text);
  }
  console.log();
}

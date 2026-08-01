/**
 * scripts/dry-typhoon.ts
 * 台風解析・予報情報（VPTW60）dry-run
 */
import { readFileSync } from "node:fs";
import { parseTyphoonXml } from "../src/parsers/typhoon";
import { mapTyphoonToBsafPosts } from "../src/bsaf/typhoonMapper";

const xml = readFileSync("tests/fixtures/vptw60_typhoon.xml", "utf-8");
const parsed = parseTyphoonXml(xml);
console.log("parsed:", parsed);
if (parsed) {
  const posts = mapTyphoonToBsafPosts(parsed);
  console.log(`\n→ 生成投稿: ${posts.length} 件`);
  for (const p of posts) {
    console.log("\n--- post ---");
    console.log("dedupeKey:", p.dedupeKey);
    console.log("tags     :", p.tags);
    console.log("text len :", [...p.text].length, "文字");
    console.log(p.text);
  }
}

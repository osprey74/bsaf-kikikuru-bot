import { readFileSync } from "node:fs";
import { parseWeatherInfoXml } from "../src/parsers/weatherInfo";
import { mapWeatherInfoToBsafPosts } from "../src/bsaf/weatherInfoMapper";
const xml = readFileSync("tests/fixtures/vpfj50_weather-info.xml", "utf-8");
const parsed = parseWeatherInfoXml(xml);
console.log("parsed:", { prefName: parsed?.prefName, topic: parsed?.topic, headTitle: parsed?.headTitle, len: parsed?.headlineText.length });
if (parsed) {
  const posts = mapWeatherInfoToBsafPosts(parsed);
  console.log(`\n→ 生成投稿: ${posts.length} 件`);
  for (const p of posts) {
    console.log("\n--- post ---");
    console.log("dedupeKey:", p.dedupeKey);
    console.log("tags     :", p.tags);
    console.log("text len :", [...p.text].length, "文字");
    console.log(p.text);
  }
}

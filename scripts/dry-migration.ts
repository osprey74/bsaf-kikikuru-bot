import { readFileSync } from "node:fs";
import { parseTornadoWarningXml } from "../src/parsers/tornadoWarning";
import { mapTornadoToBsafPosts } from "../src/bsaf/tornadoMapper";
import { parseLandslideAlertXml } from "../src/parsers/landslideAlert";
import { mapLandslideAlertToBsafPosts } from "../src/bsaf/landslideAlertMapper";
import { parseBosaiReportXml } from "../src/parsers/bosaiReport";
import { mapBosaiToBsafPosts } from "../src/bsaf/bosaiMapper";
function show(label:string, posts:any[]) {
  console.log(`\n===== ${label}: ${posts.length}件 =====`);
  for (const p of posts) { console.log("tags:", p.tags.join(" ")); console.log("dedupe:", p.dedupeKey, "len:", [...p.text].length); console.log(p.text); }
}
show("竜巻 VPHW50", mapTornadoToBsafPosts(parseTornadoWarningXml(readFileSync("tests/fixtures/vphw50_tornado.xml","utf-8"))!));
show("土砂 VXWW50", mapLandslideAlertToBsafPosts(parseLandslideAlertXml(readFileSync("tests/fixtures/vxww50_landslide-alert.xml","utf-8"))!));
show("記録的短時間大雨 VPBS50", mapBosaiToBsafPosts(parseBosaiReportXml(readFileSync("tests/fixtures/vpbs50_record-rain.xml","utf-8"))!));

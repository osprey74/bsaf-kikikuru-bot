# bsaf-kikikuru-bot v0.3.0

Release date: 2026-06-03

---

## English

### Highlights

This release brings full storm-surge (VPWW57) support to bsaf-kikikuru-bot, after seasonal samples became available from JMA's Okinawa office on 2026-05-31 (Lv2 storm-surge advisory for Nanjo City). Two new XML elements were observed in real traffic for the first time and added to the parser/mapper. The post layout was also revamped with level-coded color icons for at-a-glance triage on Bluesky.

### What's new

- **VPWW57 (storm-surge) verified in production.** Real telegrams for Lv2 advisory issuance and cancellation were obtained, fixtures added, and the parser/mapper paths confirmed.
- **`CriteriaPeriod` extraction (new).** Telegrams now expose a predicted escalation window — e.g. *"From 17:00 to 20:00 on the 1st, conditions equivalent to Warning Level 4"* — extracted from `Property/CriteriaPeriod` and surfaced as a `到達予想:` (Predicted escalation:) section in the post body.
- **`Base/Time` on quantitative forecasts (new).** Each tidal level / wind / wave / etc. reading now carries the associated observation time. Storm-surge posts render this as a hint such as `(reaching at ~17:00 on the 1st)`.
- **Tidal-level labels disambiguated.** `Property/Type="高潮基準超過"` and `"高潮ピーク"` are now rendered as `警報級到達時の潮位` (Tidal level at warning-criterion crossing) and `最高潮位` (Peak tidal level) respectively, instead of two indistinguishable `潮位 2.0m` lines.
- **Level-coded color icons in post headers.**
  - Warning-level-system phenomena (heavy rain / landslide / storm-surge): `⬛` Lv5 / `🟪` Lv4 / `🟥` Lv3 / `🟨` Lv2
  - Non-level-system phenomena (wind / wave / snow / etc.): `⚠️` advisory & warning
  - Special warnings outside the level system: `🚨`
  - Cancellations: no icon (kept visually quiet)
- **Body text normalized to half-width digits.** Source XML contains full-width digits in fields like `警戒レベル２` and `１日１７時から`; these are now uniformly rendered as half-width (`警戒レベル2`, `1日17時から`) for readability on Bluesky.

### Sample output (VPWW57 Lv2, Okinawa)

```
🟨【高潮警報・注意報】レベル2高潮注意報

沖縄県の1市町村にレベル2高潮注意報が発表されました。
レベル：警戒レベル2

到達予想:
・1日17時から20時まで、警戒レベル4相当

主な量的予想:
・警報級到達時の潮位 2.0m（1日17時頃到達）
・最高潮位 2.0m（1日19時頃ピーク）

対象市町村: 南城市

出典: 気象庁 https://www.jma.go.jp/bosai/warning/
```

### Internal changes

- Parser (`src/parsers/r06Warning.ts`): added `CriteriaPeriod` type, `QuantitativeForecast.time` field, and updated `extractFromProperty` / `collectQuantitative` / `pushFromHolder` accordingly.
- Mapper (`src/bsaf/r06Mapper.ts`): added `VALUE_ICON` table, `formatCriteriaPeriods()`, `formatJstTimeHint()`, `normalizeBodyText()`, and tidal-level label split.
- Fixtures: added `tests/fixtures/vpww57_storm-surge_lv2.xml` and `vpww57_storm-surge_cancellation.xml`.
- Tests: 47 → 58 (added 7 parser cases for VPWW57 incl. CriteriaPeriod/Time, 2 mapper cases for VPWW57, 2 mapper cases for icon/half-width verification).
- Dev-only experiment script: `scripts/dry-vpww57.ts`.

### Known limitations / future work

- The following VPWW57 elements were **not** present in the 2026-05-31 sample and remain unverified against real traffic. They are expected to appear in higher-severity events (Lv3-5 storm-surge warning, special warnings, or specific tide-gauge regions such as Tokyo Bay / Osaka Bay):
  - 5th-level `Warning[@type="気象警報・注意報（高潮予報区間）"]`
  - `AdditionalInfo/TidalWarningAddition`
  - `WaveHeight` (run-up wave height)
  - `EventPart`
- VPWW60 (heavy snow) seasonal samples are still pending (target: Dec 2026+).

### Acknowledgements

Sample telegrams courtesy of Japan Meteorological Agency public XML feed.

---

## 日本語

### ハイライト

本リリースは bsaf-kikikuru-bot に **VPWW57（高潮）完全対応** を追加します。2026-05-31 に沖縄気象台が南城市にレベル 2 高潮注意報を発表したことで季節要因により未取得だったサンプルが入手でき、実機検証を経てパーサー・マッパーの両経路を確認しました。実電文で初めて観測した 2 つの新要素（`CriteriaPeriod`、`Base/Time`）に対応したほか、投稿表示も警戒レベル別カラーアイコンで一目で識別できる形に刷新しました。

### 新機能

- **VPWW57（高潮）の本番経路検証**。Lv2 注意報発表電文と解除電文の実サンプルを取得し、フィクスチャ追加とパーサー／マッパーの動作を確認しました。
- **`CriteriaPeriod`（警戒レベル到達予想期間）の抽出に新対応**。`Property/CriteriaPeriod` から「1 日 17 時から 20 時まで、警戒レベル 4 相当」のような昇格予測を取り出し、投稿本文に `到達予想:` セクションとして反映します。
- **量的予想要素の `Base/Time` 取得に新対応**。潮位・風速・波高などの観測時刻を取得し、高潮投稿では「（1 日 17 時頃到達）」のような時刻ヒントとして表示します。
- **潮位 2 ラベル書き分け**。`Property/Type="高潮基準超過"` と `"高潮ピーク"` を、それぞれ `警報級到達時の潮位` と `最高潮位` の別ラベルで表示するようになりました。従来は両方とも `潮位 2.0m` と表示され区別できませんでした。
- **投稿ヘッダーに警戒レベル別カラーアイコン**。
  - 警戒レベル相当情報あり（大雨／土砂／高潮）：`⬛` Lv5 ／ `🟪` Lv4 ／ `🟥` Lv3 ／ `🟨` Lv2
  - 警戒レベル相当情報なし（暴風／波浪／大雪／雷ほか）：`⚠️` 注意報・警報共通
  - レベル体系外の特別警報：`🚨`
  - 解除：アイコンなし（情報密度を下げて視認性確保）
- **本文の全角数字を半角に正規化**。電文では `警戒レベル２`、`１日１７時から` など全角数字が混在しますが、Bluesky 上での可読性を優先して半角に統一しました（`警戒レベル2`、`1日17時から`）。

### 投稿例（VPWW57 Lv2、沖縄）

```
🟨【高潮警報・注意報】レベル2高潮注意報

沖縄県の1市町村にレベル2高潮注意報が発表されました。
レベル：警戒レベル2

到達予想:
・1日17時から20時まで、警戒レベル4相当

主な量的予想:
・警報級到達時の潮位 2.0m（1日17時頃到達）
・最高潮位 2.0m（1日19時頃ピーク）

対象市町村: 南城市

出典: 気象庁 https://www.jma.go.jp/bosai/warning/
```

### 内部変更点

- パーサー（`src/parsers/r06Warning.ts`）：`CriteriaPeriod` 型と `QuantitativeForecast.time` を追加、`extractFromProperty` / `collectQuantitative` / `pushFromHolder` を更新。
- マッパー（`src/bsaf/r06Mapper.ts`）：`VALUE_ICON` テーブル、`formatCriteriaPeriods()`、`formatJstTimeHint()`、`normalizeBodyText()` を追加、潮位ラベル分割を実装。
- フィクスチャ追加：`tests/fixtures/vpww57_storm-surge_lv2.xml` / `vpww57_storm-surge_cancellation.xml`。
- テスト：47 → 58（VPWW57 パーサー検証 7 件、VPWW57 マッパー検証 2 件、アイコン・半角検証 2 件追加）。
- 開発用実験スクリプト：`scripts/dry-vpww57.ts`。

### 既知の制限・今後の課題

- 以下の VPWW57 要素は 2026-05-31 のサンプルでは **未出現** のため、実機検証はまだ行えていません。Lv3 以上の高潮警報級、特別警報、または特定の高潮予報区間（東京湾・大阪湾等）の発表時に出現する見込みです。
  - 5 階層目 `Warning[@type="気象警報・注意報（高潮予報区間）"]`
  - `AdditionalInfo/TidalWarningAddition`
  - `WaveHeight`（うちあげ高水位）
  - `EventPart`
- VPWW60（大雪）の季節要因サンプルは未取得（取得目標：2026 年 12 月以降）。

### 謝辞

サンプル電文は気象庁防災情報 XML フィードを利用しました。

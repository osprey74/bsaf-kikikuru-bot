# bsaf-kikikuru-bot — Remaining Work

> 完了したタスクは `[x]`、進行中は `[~]`、未着手は `[ ]` で表記する。

## Phase 0〜4 — 旧仕様（VPWW55-58＝警戒レベル情報 4 電文）に基づく初期実装

旧設計に基づく初期実装、Fly.io デプロイ、kazahana 登録は完了済み。ただし VPWW58 を「洪水・氾濫」と誤認していたため、Bot は稼働するものの投稿生成 0 件の状態だった（2026-05-29〜31）。

詳細履歴は [HANDOFF_redesign.md §1.1](HANDOFF_redesign.md) を参照。

## Phase R0 — 再設計（2026-05-31）

- [x] JMA 一次資料の取得（`jma-spec/` 配下に保管）
- [x] VPWW55-61 の正しい仕様確認（電文＝現象別の新気象警報・注意報Ｒ０６）
- [x] 別表 3（Kind Code）/別表 5（Significancy Code）の完全マッピング取得
- [x] 実電文サンプルの取得（VPWW55, 56, 58, 59, 61）
- [x] 量的予想 Property 構造の実例確認
- [x] HANDOFF_redesign.md 作成（仕様書・実装計画）
- [x] 設計判断 6.1〜6.5 確定（中粒度 value、本文補足、量予想存在時のみ、複数投稿分解、府県+市町村集約）

## Phase R1 — コア再実装

- [x] 旧パーサー・マッパー・テスト・スクリプト削除（dry-run.ts, test-post.ts, heavyRainWarning.ts, mapper.ts, 旧テスト）
- [x] `src/codes/kindCode.ts`（別表 3 完全実装、37 エントリ、Phenomenon と BSAF type 値マッピング含む）
- [x] `src/codes/significancy.ts`（別表 5 完全実装、11 エントリ、深刻度 rank 付き）
- [x] `src/feeds/atomFeed.ts` の TARGET_CODES を VPWW55-61 に拡張
- [x] `src/parsers/r06Warning.ts`（VPWW55-61 共通パーサー、市町村等レベル Item 抽出、Significancy／量的予想／付加事項を構造化）
- [x] `src/bsaf/r06Mapper.ts`（市町村等から都道府県別・現象別に集約、最深刻 Significancy 採用、value タグ判定、解除分解、量予想本文化）
- [x] `src/poller.ts` を新パーサー／マッパーに繋ぎ込み（スキップロジック削除）
- [x] `src/index.ts` の起動メッセージ更新

## Phase R2 — テスト

- [x] `tests/codes.test.ts`（kindCode / significancy 基本検証、20 ケース）
- [x] `tests/r06Warning.test.ts`（実電文 6 種に対するパーサー検証、15 ケース）
- [x] `tests/r06Mapper.test.ts`（BsafPost 生成検証、12 ケース、文字数・タグ・dedupeKey 一意性）
- [x] `tests/warningState.test.ts`（重複抑制基本検証）
- [x] `tests/fixtures/` に実電文サンプル 6 件配置

## Phase R3 — ローカル検証

- [x] `bun test` で全テストパス（47/47）
- [x] `bun run typecheck` で型エラーなし
- [x] 実生成投稿テキストの目視確認（全 6 サンプル、最長 165 字、300 字制限内）
- [x] BSAF タグ 6 件の正しい付与確認

## Phase R4 — ドキュメント更新

- [x] `bot-definition.json` を 17 種の type フィルタ・拡張 value フィルタに刷新
- [x] `README.md` / `README-ja.md` を VPWW55-61 全現象配信仕様に書き換え
- [x] `remaining-work.md`（本ファイル）刷新

## Phase R5 — 本番デプロイ・検証（次フェーズ）

- [ ] git コミット & プッシュ（v0.2.0 想定）
- [ ] `fly deploy` で本番デプロイ
- [ ] `fly logs` で 24 時間動作観察、投稿生成数とスキップ理由を検証
- [ ] kazahana の Bot 定義キャッシュ更新確認（新 17 種フィルタ表示）
- [ ] 旧 BSAF タグ（`flood-warning` 等）で投稿済みの過去投稿の取り扱い検討（残置 or 整理）

## Phase R6 — 継続観測・季節要因サンプル取得

季節要因により 2026-05-31 時点ではサンプルが取得できなかった電文タイプについて、出現時期到来後にサンプル取得・パーサー実機検証を行う。

- [x] **VPWW57（高潮）**: 台風シーズン（夏〜秋）に実電文サンプル取得（2026-06-03 着手）
  - サンプル取得: 2026-05-31 沖縄気象台発表・南城市 Lv2 高潮注意報 + 解除電文（`tests/fixtures/vpww57_storm-surge_lv2.xml`, `vpww57_storm-surge_cancellation.xml`）
  - 5 階層目 `Warning[@type="気象警報・注意報（高潮予報区間）"]`: 本サンプルでは**未出現**（特別警報級または特殊な高潮予報区間でのみ出現と推測）
  - `AdditionalInfo/TidalWarningAddition`: 本サンプルでは**未出現**
  - 量的予想要素: `TidalLevel`（潮位）は出現確認済み。`WaveHeight`（うちあげ高水位）・`EventPart` は**未出現**
  - `Property/Type` に「高潮基準超過」「高潮ピーク」の 2 種が並列で出現することを確認 → マッパーで書き分け実装
  - `CriteriaPeriod`（Lv4 到達予想期間）が初出現 → パーサー＆マッパーに対応追加
  - `TidalLevel/Base/Time`（時刻情報）の取得を追加し、本文に「N日HH時頃」表記で反映
  - パーサーテスト 5 ケース＋マッパーテスト 2 ケース追加
- [ ] **VPWW60（大雪）**: 冬季（12 月以降）に実電文サンプル取得
  - `SnowfallDepth` の複数 type 属性（6/12/24 時間最大降雪量）並列出現の確認
  - パーサーテストフィクスチャ追加
- [ ] **VPWW55-57 の Lv3〜Lv5 発表時**: 警戒レベル体系の上位レベルの実電文サンプル取得
  - `CriteriaPeriod`（Lv4 到達予想時間）の出現確認と本文反映の検討
  - `Condition="氾濫発生"` 付き VPWW57 サンプルの確認

## Phase R7 — bsaf-jma-bot の旧電文パーサー段階削除

- [ ] kikikuru-bot 安定稼働 1 週間以上を確認
- [ ] bsaf-jma-bot から `weatherWarning.ts` / `landslideWarning.ts` / `specialWarning.ts` パーサーを段階削除
- [ ] 旧 BSAF タグ運用との整合性確認

## Phase R8 — 将来課題

- [ ] 氾濫情報対応（VXKOii / VXSUii）
- [ ] Lv1 早期注意情報対応（VPFD61 / VPFW60）
- [ ] VPWP50（時系列情報）対応
- [ ] VPWS50（集約通報）対応
- [ ] 永続化された重複抑制（SQLite / Fly Volume）
- [ ] 投稿失敗時のリトライキュー
- [ ] フィード取得間隔の最適化（現状 10 分）
- [x] CriteriaPeriod の Lv4 到達予想時間を本文反映（2026-06-03 完了、VPWW57 サンプル対応時）
- [ ] VPWW57 高潮予報区間の本文補足記載のさらなる充実
- [ ] WaveHeight（うちあげ高水位）／EventPart の実電文サンプル取得（Lv3〜Lv5 高潮警報級 or 特別警報級発表時）

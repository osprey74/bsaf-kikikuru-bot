# bsaf-kikikuru-bot — Remaining Work

> 完了したタスクは `[x]`、進行中は `[~]`、未着手は `[ ]` で表記する。

## Phase 0 — リポジトリ初期化

- [x] GitHub リポジトリ作成
- [x] README.md / CLAUDE.md 草稿
- [x] fly.toml 草稿
- [x] パーサ草稿（VPWW55〜58）

## Phase 1 — コア実装

- [x] package.json / tsconfig.json / .env.example / .gitignore
- [x] fly/Dockerfile（Bun ベース）
- [x] src/bsaf/prefectures.ts（市町村コード→都道府県 target マッピング）
- [x] src/parsers/heavyRainWarning.ts を Lv2〜Lv5＋解除に拡張
- [x] src/bsaf/mapper.ts（都道府県×レベル単位の投稿生成・BSAF tags 配列）
- [x] src/atproto/client.ts を `tags: string[]` 方式に書き換え
- [x] src/state/warningState.ts（30 分重複抑制）
- [x] src/poller.ts を新インタフェースに適合
- [x] tests/heavyRainWarning.test.ts（bun:test 形式）
- [x] tests/warningState.test.ts
- [x] bot-definition.json（type / value / target=47都道府県）
- [x] CLAUDE.md / README.md / README-ja.md 最終化

## Phase 2 — ローカル検証

- [x] `bun install` 実行
- [x] `bun test` で全テストパス（31/31）
- [x] `bunx tsc --noEmit` で型エラーなし
- [x] `src/dry-run.ts` 作成・実行 → 投稿テキスト＆BSAFタグを目視確認
- [x] `src/test-post.ts` 作成（実投稿スクリプト）
- [x] Bluesky テストアカウントで実投稿確認（2026-05-28 完了、Lv2 注意報サンプル投稿で6タグ表示確認）

## Phase 3 — Fly.io デプロイ

- [x] Fly.io アプリ作成（`fly apps create bsaf-kikikuru-bot --org personal`）
- [x] `fly secrets set BSKY_IDENTIFIER=bsaf-kikikuru-bot.bsky.social`
- [x] `fly secrets set BSKY_PASSWORD=xxxx-xxxx-xxxx-xxxx`
- [x] `fly deploy` で初回デプロイ
- [x] HA 2 台運用を `fly scale count 1` で 1 台に固定（重複投稿防止）
- [x] FEED_URL を `www.data.jma.go.jp` 系の現行URLへ修正（旧 `xml.kishou.go.jp` は Fly から 403）
- [x] User-Agent ヘッダ追加（防御的措置）
- [x] `fly logs` で起動・ポーリング動作確認（取得 0件 = 新電文未運用、稼働は正常）
- [x] `/health` エンドポイント疎通確認（待機中）

## Phase 4 — 公開・連携

- [x] bot-definition.json の DID を実値に更新（`did:plc:kxwz5cz7o6g4jlmxh6doyfsm`）
- [x] README.md / README-ja.md を bsaf-jma-bot 同等の構造で整備
- [x] git 初回コミット & プッシュ（2026-05-28）
- [x] kazahana に本Botを登録テスト（2026-05-28 完了、フィルタUI自動構築を確認）
- [ ] VPWW55〜58 の実運用開始日を気象庁公式アナウンスで確認

## Phase 5 — 将来課題

- [ ] Lv1（早期注意情報 VPWP50）対応
- [ ] 永続化された重複抑制（SQLite / Fly Volume）
- [ ] 投稿失敗時のリトライキュー
- [ ] フィード取得間隔の最適化（現状10分。プロフィール再合意の上で短縮検討、気象庁推奨30〜60秒との兼ね合い）
- [ ] 旧電文 VPWW53 系との並行運用期の重複排除設計
- [ ] GitHub Pages 等にステータスダッシュボード設置

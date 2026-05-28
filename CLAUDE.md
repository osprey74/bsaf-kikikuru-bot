# CLAUDE.md — bsaf-kikikuru-bot

## プロジェクト概要

気象庁防災情報XML（VPWW55〜58）から大雨・土砂災害・高潮・洪水・氾濫の警戒レベル情報を
取得し、BSAF v1 タグ付きで AT Protocol (Bluesky) に配信する BOT。

- **アカウント**: @bsaf-kikikuru-bot.bsky.social
- **配信レベル**: Lv2（注意報）〜 Lv5（特別警報）＋ 解除（BSAFポリシーに従い全レベル配信、取捨選択はクライアント側）
- **Lv1（早期注意情報）**: 対象外（別電文 VPWP50 で将来対応予定）
- **関連BOT**: bsaf-jma-bot（地震・津波・噴火・気象警報担当）

## BSAF タグ仕様（v1）

1 投稿あたり **必須 6 タグ**（AT Protocol 上限 8 / 残り 2 スロットは予備）。

```text
tags: [
  "bsaf:v1",
  "type:heavy-rain-warning",       // or landslide-warning / storm-surge-warning / flood-warning
  "value:level4",                  // or level2 / level3 / level5 / cancelled
  "time:2026-05-28T12:00:00Z",     // UTC ISO8601（電文の ReportDateTime を UTC 化）
  "target:jp-hokkaido",            // 都道府県粒度（jp-hokkaido 〜 jp-okinawa）
  "source:jma"
]
```

### 設計上の取り決め

- **1 投稿 = 1 都道府県 × 1 警報種別 × 1 警戒レベル** に分割する
- target にカンマ区切り複数値は **使わない**（重複検知キーの一意性確保のため）
- 市町村粒度の詳細は **投稿本文（text）** に列挙する（市町村名最大 8 件 + 残数）
- 重複抑制キー: `${warningType}:${prefectureTarget}:${value}` を 30 分間保持
- bsaf-jma-bot と本 Bot は別情報粒度（気象警報 vs 危険度分布）のため、type は被っても問題なし

## スタック

- Runtime: Bun
- HTTP: Hono（ヘルスチェック用）
- AT Protocol: @atproto/api
- XML Parse: fast-xml-parser
- Test: bun:test
- Infra: Fly.io
- 機密管理: Fly.io secrets

## ディレクトリ構成

```text
src/
  index.ts                    # エントリポイント・Hono サーバー起動
  poller.ts                   # Atom Feed ポーリングループ
  parsers/
    heavyRainWarning.ts       # VPWW55〜58 XML パーサ
  bsaf/
    prefectures.ts            # 市町村コード2桁→都道府県 target マッピング
    mapper.ts                 # ParsedHeavyRainWarning → BsafPost[]
  feeds/
    atomFeed.ts               # Atom Feed 取得・パース
  state/
    warningState.ts           # 重複投稿防止（インメモリ・30 分）
  atproto/
    client.ts                 # AtpAgent ラッパー（tags:string[] で投稿）
tests/
  heavyRainWarning.test.ts    # パーサ＆マッパー
  warningState.test.ts        # 重複抑制
fly/
  Dockerfile                  # Bun ベース
fly.toml
bot-definition.json           # BSAF クライアント向け Bot 定義
remaining-work.md             # タスク管理
```

## 環境変数（Fly.io secrets）

<!-- markdownlint-disable MD060 -->
| 変数名 | 説明 |
|---|---|
| `BSKY_IDENTIFIER` | Bluesky ハンドル（bsaf-kikikuru-bot.bsky.social） |
| `BSKY_PASSWORD` | Bluesky App Password |
| `LOG_LEVEL` | ログレベル（debug / info / warn / error） |
| `PORT` | HTTP ヘルスチェックポート（デフォルト 3000） |
<!-- markdownlint-enable MD060 -->

## 開発ルール

- `Status !== "通常"` の電文は必ずスキップ（訓練・試験）
- BSAF タグの `bsaf:v1` は必須・先頭スロット
- `source` は常に `"jma"` 固定
- 投稿テキストには必ず `出典: 気象庁` と URL を含める（BSAF MUST）
- 重複抑制ウィンドウ: 30 分（同一 `type:target:value`）
- ポーリング間隔: 10 分（プロフィール記載・気象庁サーバー負荷配慮）
- エラー時はリトライせずログに残し次サイクルへ
- `time:` タグはソースイベント（電文 ReportDateTime）の UTC ISO8601、Bot 投稿時刻ではない

## コード規約

- TypeScript strict モード
- named export のみ（default export 禁止）
- 非同期は async/await（Promise チェーン禁止）
- コメントは日本語OK

## よく使うコマンド

```bash
bun install                     # 依存インストール
bun run dev                     # 開発（watch）
bun run start                   # 通常起動
bun test                        # テスト実行
bun run typecheck               # 型チェック（tsc --noEmit）
fly deploy                      # Fly.io デプロイ
fly logs                        # ログ確認
fly secrets set BSKY_PASSWORD=xxx
```

---

## Task Management

- **task_file**: `remaining-work.md`
- **done_marker**: `[x]`
- **progress_summary**: false

## Documentation

- **docs_to_update**:
  - `README.md`
  - `README-ja.md`
- **doc_pairs**:
  - `README.md` ↔ `README-ja.md`

## Versioning

- **version_files**:
  - `package.json`
- **extra_version_files**: none
- **cargo_lockfile**: false

## CI/CD

- **cicd**: false
- **deploy_platform**: Fly.io
- **deploy_file**: `fly.toml`
- **deploy_note**: Bun + Docker ベースのデプロイ（`fly/Dockerfile`）

## SNS

- **sns_accounts**: none

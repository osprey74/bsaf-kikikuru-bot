# bsaf-kikikuru-bot

**気象庁のキキクル（土砂災害・浸水害・洪水害の危険度分布情報）をBlueskyに自動投稿する [BSAF](https://github.com/osprey74/bsaf-protocol) 対応Botです。**

[@bsaf-kikikuru-bot.bsky.social](https://bsky.app/profile/bsaf-kikikuru-bot.bsky.social)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English README](README.md)

---

## 概要

bsaf-kikikuru-bot は気象庁の公開XMLフィードを監視し、キキクル（大雨・土砂災害・高潮・洪水の危険度分布警報）をBSAFタグ付きでBlueskyに自動投稿します。BSAF対応クライアントでは、警報種別・警戒レベル・都道府県によるフィルタリングが可能です。

[BSAFプロトコル](https://github.com/osprey74/bsaf-protocol)のリファレンスBot実装の1つで、[bsaf-jma-bot](https://github.com/osprey74/bsaf-jma-bot)（地震・津波・噴火・気象警報担当）と相互補完する役割を担います。

## 対応電文

<!-- markdownlint-disable MD060 -->
| 電文 | 内容 | レベル |
|---|---|---|
| VPWW55 | 大雨に関する警戒レベル情報 | Lv2〜Lv5 |
| VPWW56 | 土砂災害に関する警戒レベル情報 | Lv2〜Lv5 |
| VPWW57 | 高潮に関する警戒レベル情報 | Lv2〜Lv5 |
| VPWW58 | 洪水・氾濫に関する警戒レベル情報 | Lv2〜Lv5 |
<!-- markdownlint-enable MD060 -->

BSAFの「情報は可能な限り多く提供し、取捨選択はクライアント利用者に委ねる」という設計思想に従い、**Lv2（注意報）〜Lv5（特別警報）＋解除をすべて配信**します。

**Lv1（早期注意情報 / VPWP50）は現在対象外**です（将来別Botで対応予定）。

## 投稿粒度

- **1投稿 = 1都道府県 × 1警報種別 × 1警戒レベル**
- 複数都道府県にまたがる電文は複数投稿に分割されます。
- 市町村粒度の詳細は投稿本文に列挙されます（最大8件＋残数）。

## BSAFタグ

すべての投稿に6つの必須BSAFタグが付与されます（AT Protocol上限: 8）:

```text
bsaf:v1
type:heavy-rain-warning      # または landslide-warning / storm-surge-warning / flood-warning
value:level4                 # または level2 / level3 / level5 / cancelled
time:2026-05-28T12:00:00Z    # UTC ISO 8601（電文の ReportDateTime）
target:jp-hokkaido           # jp-hokkaido ... jp-okinawa（47都道府県）
source:jma
```

利用可能なフィルタオプションは [bot-definition.json](bot-definition.json) を参照してください。

## ヘルスチェック

- [ヘルスチェック](https://bsaf-kikikuru-bot.fly.dev/health) — 正常/異常の簡易エンドポイント

## アーキテクチャ

```text
気象庁XMLフィード (extra.xml)
  │  10分間隔でポーリング
  ▼
Poller → Atomパーサー → キキクル電文パーサー → BSAFマッパー → AT Protocol投稿
                                                      │
                                              WarningState (メモリ・30分重複抑制)
                                                      │
                                              /health エンドポイント (HTTP :3000)
```

## 技術スタック

- **ランタイム:** [Bun](https://bun.sh) v1.1+
- **言語:** TypeScript (strict)
- **HTTPサーバー:** Hono（ヘルスチェック用）
- **Bluesky SDK:** @atproto/api
- **XMLパーサー:** fast-xml-parser
- **テストランナー:** `bun test`
- **デプロイ:** Docker / Fly.io（東京 `nrt` リージョン）

## セットアップ

### 前提条件

- [Bun](https://bun.sh) v1.1+
- [アプリパスワード](https://bsky.app/settings/app-passwords)を設定済みのBlueskyアカウント

### インストール

```bash
git clone https://github.com/osprey74/bsaf-kikikuru-bot.git
cd bsaf-kikikuru-bot
bun install
```

### 設定

`.env` ファイルを作成:

```bash
BSKY_IDENTIFIER=your-bot.bsky.social
BSKY_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

オプションの環境変数:

<!-- markdownlint-disable MD060 -->
| 変数 | デフォルト | 説明 |
|---|---|---|
| `PORT` | `3000` | ヘルスチェック用 HTTP ポート |
| `LOG_LEVEL` | `info` | ログレベル（`debug`, `info`, `warn`, `error`） |
<!-- markdownlint-enable MD060 -->

### 実行

```bash
# 開発モード（ホットリロード）
bun run dev

# 本番モード
bun run start

# テスト
bun test

# 型チェック
bun run typecheck

# ドライラン（投稿なし。サンプル電文に対する投稿テキスト＆BSAFタグを表示）
bun run dry-run

# 実投稿テスト（要 .env。テスト用の1件を Bluesky に投稿）
bun run test-post
```

### Fly.io へのデプロイ

```bash
fly apps create bsaf-kikikuru-bot --org personal
fly secrets set BSKY_IDENTIFIER=your-bot.bsky.social -a bsaf-kikikuru-bot
fly secrets set BSKY_PASSWORD=xxxx-xxxx-xxxx-xxxx  -a bsaf-kikikuru-bot
fly deploy -a bsaf-kikikuru-bot

# 重要: 本Botはインメモリで状態を持つため、HA構成では重複投稿が発生します。
# 必ず1台運用に固定してください:
fly scale count 1 -a bsaf-kikikuru-bot
```

## Bot定義ファイル

[bot-definition.json](bot-definition.json) は、このBotの情報と対応フィルタを記述した機械可読なJSONファイルです。BSAF対応クライアント（[kazahana](https://github.com/osprey74/kazahana) など）にこのファイルを登録することで、Botの投稿に対するフィルタリング機能が有効になります。

### 設置URL

ファイルは以下のURLでホストされています。クライアントにBotを登録する際はこのURLを使用してください:

```text
https://raw.githubusercontent.com/osprey74/bsaf-kikikuru-bot/main/bot-definition.json
```

### 使い方

1. BSAF対応クライアント（kazahana など）のBot管理画面を開く
2. 上記URLを入力してBotを登録する
3. クライアントが `bot-definition.json` を読み込み、フィルタUIを自動構築する
4. 警報種別・警戒レベル・都道府県のフィルタを設定して、必要な情報だけを受け取る

### ファイル構造

<!-- markdownlint-disable MD060 -->
| フィールド | 説明 |
|---|---|
| `bsaf_schema` | BSAFスキーマバージョン（`"1.0"`） |
| `updated_at` | 定義ファイルの最終更新日時（ISO 8601） |
| `self_url` | このファイル自身のホストURL |
| `bot` | Bot情報（ハンドル、DID、名前、説明、データソース） |
| `filters` | 対応フィルタの配列 |
<!-- markdownlint-enable MD060 -->

`filters` 配列には、以下の3種類のフィルタが定義されています:

<!-- markdownlint-disable MD060 -->
| フィルタ (`tag`) | ラベル | 内容 |
|---|---|---|
| `type` | 情報種別 | 大雨、土砂災害、高潮、洪水・氾濫 |
| `value` | 警戒レベル | Lv.2 注意報、Lv.3 警報、Lv.4 危険警報、Lv.5 特別警報、解除 |
| `target` | 都道府県 | 北海道、青森県、...、沖縄県（全47都道府県） |
<!-- markdownlint-enable MD060 -->

各フィルタの `options` には `value`（BSAFタグ値）と `label`（表示名）のペアが含まれており、クライアントはこれを元にフィルタUIを構築します。

## bsaf-jma-bot との関係

[bsaf-jma-bot](https://github.com/osprey74/bsaf-jma-bot) と bsaf-kikikuru-bot は同じデータソース（気象庁）を扱いますが、情報の粒度・性質が異なります:

<!-- markdownlint-disable MD060 -->
| Bot | 情報の種類 | 対象電文 |
|---|---|---|
| bsaf-jma-bot | 地震・津波・噴火・気象警報（面的なエリア注意） | eqvol.xml, VPWW53/54 等 |
| bsaf-kikikuru-bot | キキクル（危険度分布、都道府県粒度） | VPWW55〜58 |
<!-- markdownlint-enable MD060 -->

BSAFの重複検知は `type + value + time + target` の完全一致で判定されますが、両Botでは `type` 値が異なるため衝突は発生しません。

## データソース

すべてのデータは[気象庁の防災情報XML](https://www.data.jma.go.jp/developer/xml/)を出典としています。本Botは非公式であり、気象庁とは無関係です。

データを引用する際は「**出典：気象庁ホームページ**」と明記してください。

## 関連プロジェクト

- [BSAFプロトコル](https://github.com/osprey74/bsaf-protocol) — プロトコル仕様書
- [bsaf-jma-bot](https://github.com/osprey74/bsaf-jma-bot) — 地震・津波・気象警報担当Bot
- [kazahana](https://github.com/osprey74/kazahana) — BSAF対応 Blueskyデスクトップクライアント

## サポート

このプロジェクトが役に立ったら、開発を支援していただけると嬉しいです:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?logo=github)](https://github.com/sponsors/osprey74)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?logo=ko-fi)](https://ko-fi.com/osprey74)

## ライセンス

[MIT License](LICENSE)

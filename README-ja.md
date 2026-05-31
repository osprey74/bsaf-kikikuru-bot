# bsaf-kikikuru-bot

**気象庁の新気象警報・注意報（Ｒ０６）を Bluesky に自動投稿する [BSAF](https://github.com/osprey74/bsaf-protocol) 対応 Bot です。**

[@bsaf-kikikuru-bot.bsky.social](https://bsky.app/profile/bsaf-kikikuru-bot.bsky.social)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English README](README.md)

---

## 概要

bsaf-kikikuru-bot は気象庁の防災情報XMLフィードを監視し、新気象警報・注意報（Ｒ０６）電文（VPWW55〜61、2026-05-29 運用開始）を BSAF タグ付きで Bluesky に自動投稿します。BSAF 対応クライアントでは、現象種別・警戒レベル・都道府県によるフィルタリングが可能です。

[BSAF プロトコル](https://github.com/osprey74/bsaf-protocol)のリファレンス Bot 実装の 1 つで、[bsaf-jma-bot](https://github.com/osprey74/bsaf-jma-bot)（地震・津波・噴火・経過措置気象警報担当）と相互補完する役割を担います。

## 対応電文

<!-- markdownlint-disable MD060 -->
| 電文 | 内容 | 含まれる警報・注意報 |
|---|---|---|
| VPWW55 | 大雨に関する警戒レベル情報 | Lv5特別 / Lv4危険 / Lv3警報 / Lv2注意報 |
| VPWW56 | 土砂災害に関する警戒レベル情報 | Lv5特別 / Lv4危険 / Lv3警報 / Lv2注意報 |
| VPWW57 | 高潮に関する警戒レベル情報 | Lv5特別 / Lv4危険 / Lv3警報 / Lv2注意報 |
| VPWW58 | 暴風・暴風雪に関する警報・注意報 | 暴風雪特別 / 暴風特別 / 暴風雪 / 暴風 / 風雪注意 / 強風注意 |
| VPWW59 | 波浪に関する警報・注意報 | 波浪特別 / 波浪 / 波浪注意 |
| VPWW60 | 大雪に関する警報・注意報 | 大雪特別 / 大雪 / 大雪注意 |
| VPWW61 | その他の注意報 | 雷 / 融雪 / 濃霧 / 乾燥 / なだれ / 低温 / 霜 / 着氷 / 着雪 |
<!-- markdownlint-enable MD060 -->

BSAF の「情報は可能な限り多く提供し、取捨選択はクライアント利用者に委ねる」という設計思想に従い、**全現象・全警戒レベル・全警報級・解除をすべて配信**します。

**氾濫情報（VXKOii / VXSUii）と Lv1 早期注意情報（VPFD61 / VPFW60）は現在対象外**です（将来別 Bot で対応予定）。

## 投稿粒度

- **1 投稿 = 1 都道府県 × 1 現象 × 1 値**
- 複数都道府県・複数現象にまたがる電文は複数投稿に分割されます。
- 解除も同じ単位で別投稿として配信します。
- 市町村粒度の詳細は投稿本文に列挙されます（最大 8 件＋残数）。
- 量的予想（最大風速・波高・視程・降雪量・湿度・潮位等）は存在する場合のみ本文に含めます。

## BSAF タグ

すべての投稿に 6 つの必須 BSAF タグが付与されます（AT Protocol 上限: 8）:

```text
bsaf:v1
type:wind-warning           # 現象別。heavy-rain-warning / landslide-warning / storm-surge-warning /
                            # wind-warning / wave-warning / snow-warning / thunderstorm-warning /
                            # dense-fog-warning / dry-air-warning / avalanche-warning /
                            # low-temperature-warning / frost-warning / icing-warning /
                            # snow-accretion-warning / melting-snow-warning / other-warning
value:advisory              # 警戒レベル: level2 / level3 / level4 / level5
                            # 警報級ベース: advisory / warning / special-warning
                            # 解除: cancelled
time:2026-05-31T04:18:00Z   # UTC ISO 8601（電文の ReportDateTime）
target:jp-tokyo             # jp-hokkaido ... jp-okinawa（47都道府県）
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
Poller → Atomパーサー → R06警報・注意報パーサー → BSAFマッパー → AT Protocol投稿
                                                         │
                                                 WarningState (メモリ・30分重複抑制)
                                                         │
                                                 /health エンドポイント (HTTP :3000)
```

## 技術スタック

- **ランタイム:** [Bun](https://bun.sh) v1.1+
- **言語:** TypeScript (strict)
- **HTTP サーバー:** Hono（ヘルスチェック用）
- **Bluesky SDK:** @atproto/api
- **XML パーサー:** fast-xml-parser
- **テストランナー:** `bun test`
- **デプロイ:** Docker / Fly.io（東京 `nrt` リージョン）

## セットアップ

### 前提条件

- [Bun](https://bun.sh) v1.1+
- [アプリパスワード](https://bsky.app/settings/app-passwords)を設定済みの Bluesky アカウント

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
```

### Fly.io へのデプロイ

```bash
fly apps create bsaf-kikikuru-bot --org personal
fly secrets set BSKY_IDENTIFIER=your-bot.bsky.social -a bsaf-kikikuru-bot
fly secrets set BSKY_PASSWORD=xxxx-xxxx-xxxx-xxxx  -a bsaf-kikikuru-bot
fly deploy -a bsaf-kikikuru-bot

# 重要: 本 Bot はインメモリで状態を持つため、HA 構成では重複投稿が発生します。
# 必ず 1 台運用に固定してください:
fly scale count 1 -a bsaf-kikikuru-bot
```

## Bot 定義ファイル

[bot-definition.json](bot-definition.json) は、この Bot の情報と対応フィルタを記述した機械可読な JSON ファイルです。BSAF 対応クライアント（[kazahana](https://github.com/osprey74/kazahana) など）にこのファイルを登録することで、Bot の投稿に対するフィルタリング機能が有効になります。

### 設置 URL

ファイルは以下の URL でホストされています。クライアントに Bot を登録する際はこの URL を使用してください:

```text
https://raw.githubusercontent.com/osprey74/bsaf-kikikuru-bot/main/bot-definition.json
```

### 使い方

1. BSAF 対応クライアント（kazahana など）の Bot 管理画面を開く
2. 上記 URL を入力して Bot を登録する
3. クライアントが `bot-definition.json` を読み込み、フィルタ UI を自動構築する
4. 現象種別・警戒レベル・都道府県のフィルタを設定して、必要な情報だけを受け取る

### ファイル構造

<!-- markdownlint-disable MD060 -->
| フィールド | 説明 |
|---|---|
| `bsaf_schema` | BSAF スキーマバージョン（`"1.0"`） |
| `updated_at` | 定義ファイルの最終更新日時（ISO 8601） |
| `self_url` | このファイル自身のホスト URL |
| `bot` | Bot 情報（ハンドル、DID、名前、説明、データソース） |
| `filters` | 対応フィルタの配列 |
<!-- markdownlint-enable MD060 -->

`filters` 配列には、以下の 3 種類のフィルタが定義されています:

<!-- markdownlint-disable MD060 -->
| フィルタ (`tag`) | ラベル | 内容 |
|---|---|---|
| `type` | 情報種別 | 17 種類（大雨/土砂/高潮/暴風/波浪/大雪/雷/融雪/濃霧/乾燥/なだれ/低温/霜/着氷/着雪/洪水経過措置/その他） |
| `value` | 警戒レベル・警報級 | level2〜level5 / advisory / warning / special-warning / cancelled |
| `target` | 都道府県 | 北海道、青森県、...、沖縄県（全 47 都道府県） |
<!-- markdownlint-enable MD060 -->

各フィルタの `options` には `value`（BSAF タグ値）と `label`（表示名）のペアが含まれており、クライアントはこれを元にフィルタ UI を構築します。

## bsaf-jma-bot との関係

[bsaf-jma-bot](https://github.com/osprey74/bsaf-jma-bot) と bsaf-kikikuru-bot は同じデータソース（気象庁）を扱いますが、対象電文が異なります:

<!-- markdownlint-disable MD060 -->
| Bot | 情報の種類 | 対象電文 |
|---|---|---|
| bsaf-jma-bot | 地震・津波・噴火・降灰・南海トラフ ＋ VPBS50（気象防災速報） | eqvol.xml, VPBS50 等 |
| bsaf-kikikuru-bot | 新気象警報・注意報（Ｒ０６）全現象 | VPWW55〜61 |
<!-- markdownlint-enable MD060 -->

旧 VPWW54（気象警報・注意報Ｈ２７）／VXWW50（土砂災害警戒情報）／VPNO50（気象特別警報報知）は経過措置電文として bsaf-jma-bot 側で扱っていますが、kikikuru-bot 安定稼働後に段階的に廃止予定です（経過措置期間は 2028 年頃まで）。

BSAF の重複検知は `type + value + time + target` の完全一致で判定されますが、両 Bot では `type` 値が異なるため衝突は発生しません。

## データソース

すべてのデータは[気象庁の防災情報 XML](https://www.data.jma.go.jp/developer/xml/)を出典としています。本 Bot は非公式であり、気象庁とは無関係です。

データを引用する際は「**出典：気象庁ホームページ**」と明記してください。

## 関連プロジェクト

- [BSAF プロトコル](https://github.com/osprey74/bsaf-protocol) — プロトコル仕様書
- [bsaf-jma-bot](https://github.com/osprey74/bsaf-jma-bot) — 地震・津波・噴火担当 Bot
- [kazahana](https://github.com/osprey74/kazahana) — BSAF 対応 Bluesky デスクトップクライアント

## サポート

このプロジェクトが役に立ったら、開発を支援していただけると嬉しいです:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?logo=github)](https://github.com/sponsors/osprey74)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?logo=ko-fi)](https://ko-fi.com/osprey74)

## ライセンス

[MIT License](LICENSE)

# HANDOFF: bsaf-kikikuru-bot 再設計 — VPWW55-61 全現象配信化

**作成日**: 2026-05-31
**作成経緯**: 当初設計（VPWW55-58 = 警戒レベル情報の独立電文）が仕様誤認と判明。総司様より方針1（全現象を全件配信）採用の判断。本書は再設計の完全な仕様書。

---

## 1. プロジェクトの再定義

### 1.1 旧コンセプトと誤認

| 旧設計 | 実仕様 |
|---|---|
| VPWW55=大雨警戒レベル情報、56=土砂、57=高潮、58=洪水・氾濫 | VPWW55-61 は新気象警報・注意報（Ｒ０６）を**現象別に7分割**した置き換え電文 |
| VPWW58 = 洪水・氾濫 | VPWW58 = **暴風** |
| Kind Code "15" = Lv5 大雨特別警報 | Kind Code "15" = **強風注意報**（VPWW58 用） |
| 警戒レベルは Kind Code で表現 | 警戒レベルは `Body/Warning/Item/Kind/Property/SignificancyPart/Base/Significancy/Code` |
| 洪水・氾濫は VPWW58 | 洪水・氾濫は VPWW 系に**存在せず**、`VXKOii`/`VXSUii` で別途提供 |

### 1.2 新コンセプト

bsaf-kikikuru-bot は **新気象警報・注意報（Ｒ０６）VPWW55-61 全 7 電文を漏れなく BSAF v1 タグ付きで Bluesky に配信する Bot** として再定義する。BSAF 情報配信原則（「情報は可能な限り多く提供し、取捨選択はクライアント側」）に従い、全現象・全レベル・全都道府県を対象とする。

氾濫情報（VXKOii/VXSUii）は Phase 2 の将来課題（別電文体系・別パーサー必須）として本書では対象外。

### 1.3 bsaf-jma-bot との役割分担（最終確定）

- **kikikuru-bot**（本 Bot）: VPWW55〜61（気象警報・注意報Ｒ０６ 全現象）
- **bsaf-jma-bot**: 地震・津波・噴火・降灰・南海トラフ ＋ VPBS50（府県気象防災速報：記録的短時間大雨・竜巻注意統合）

bsaf-jma-bot 側の旧電文パーサー（VPWW54 / VXWW50 / VPNO50 を扱う `weather-warning` / `landslide-warning` / `special-warning`）は、kikikuru-bot の再実装稼働確認後に段階削除する。経過措置で旧電文は 2028 年まで並行配信されるため、削除タイミングは並行配信状況を観察しながら判断。

---

## 2. 監視対象電文と仕様

### 2.1 電文一覧（出典: JMA 表1.1, 2026-01-29 版）

| データ種類コード | Control/Title | 内容 |
|---|---|---|
| VPWW55 | "気象警報・注意報（Ｒ０６）（大雨）" | レベル5大雨特別警報/レベル4大雨危険警報/レベル3大雨警報/レベル2大雨注意報 ＋ 解除 |
| VPWW56 | "気象警報・注意報（Ｒ０６）（土砂）" | レベル5土砂特別警報/レベル4土砂危険警報/レベル3土砂警報/レベル2土砂注意報 ＋ 解除 |
| VPWW57 | "気象警報・注意報（Ｒ０６）（高潮）" | レベル5高潮特別警報/レベル4高潮危険警報/レベル3高潮警報/レベル2高潮注意報 ＋ 解除 |
| VPWW58 | "気象警報・注意報（Ｒ０６）（暴風）" | 暴風雪特別警報/暴風特別警報/暴風雪警報/暴風警報/風雪注意報/強風注意報 ＋ 解除 |
| VPWW59 | "気象警報・注意報（Ｒ０６）（波浪）" | 波浪特別警報/波浪警報/波浪注意報 ＋ 解除 |
| VPWW60 | "気象警報・注意報（Ｒ０６）（大雪）" | 大雪特別警報/大雪警報/大雪注意報 ＋ 解除 |
| VPWW61 | "気象警報・注意報（Ｒ０６）（その他注意報）" | 雷/融雪/濃霧/乾燥/なだれ/低温/霜/着氷/着雪注意報 ＋ 解除 |

**監視対象外（Phase 2 課題）**:
- VPWP50（気象警報・注意報時系列情報Ｒ０６）
- VPWS50（集約通報電文Ｒ０６）
- VXKOii / VXSUii（洪水・氾濫情報）

### 2.2 Atom Feed の扱い

- **Feed URL**: `https://www.data.jma.go.jp/developer/xml/feed/extra.xml`
- **ID 形式**: `https://www.data.jma.go.jp/developer/xml/data/{timestamp}_{serial}_{code}_{areaCode}.xml`
- **コード抽出**: ファイル名から `_(VPWW5[5-9]|VPWW6[01])_` を抽出
- **訓練・試験電文の扱い**: `Control/Status != "通常"` の場合は処理スキップ

---

## 3. XML 構造（実電文サンプル検証済み）

### 3.1 Kind Code 表（別表3、code.WeatherWarning）

VPWW55-61 共通で使用される警報・注意報種別コード（出典: `R06_別表類.xlsx > 別表3`）：

```typescript
const KIND_CODE_TO_NAME: Record<string, string> = {
  // 解除
  "00": "解除",
  // VPWW58 暴風電文
  "02": "暴風雪警報",
  "05": "暴風警報",
  "13": "風雪注意報",
  "15": "強風注意報",
  "32": "暴風雪特別警報",
  "35": "暴風特別警報",
  // VPWW55 大雨電文（警戒レベル情報）
  "03": "レベル3大雨警報",
  "10": "レベル2大雨注意報",
  "33": "レベル5大雨特別警報",
  "43": "レベル4大雨危険警報",
  // VPWW56 土砂電文（警戒レベル情報）
  "09": "レベル3土砂災害警報",
  "29": "レベル2土砂災害注意報",
  "39": "レベル5土砂災害特別警報",
  "49": "レベル4土砂災害危険警報",
  // VPWW57 高潮電文（警戒レベル情報）
  "08": "レベル3高潮警報",
  "19": "レベル2高潮注意報",
  "38": "レベル5高潮特別警報",
  "48": "レベル4高潮危険警報",
  // VPWW59 波浪
  "07": "波浪警報",
  "16": "波浪注意報",
  "37": "波浪特別警報",
  // VPWW60 大雪
  "06": "大雪警報",
  "12": "大雪注意報",
  "36": "大雪特別警報",
  // VPWW61 その他注意報
  "04": "洪水警報",      // ※新電文では未使用の可能性あり、要観察
  "14": "雷注意報",
  "17": "融雪注意報",
  "18": "洪水注意報",    // ※同上
  "20": "濃霧注意報",
  "21": "乾燥注意報",
  "22": "なだれ注意報",
  "23": "低温注意報",
  "24": "霜注意報",
  "25": "着氷注意報",
  "26": "着雪注意報",
  "27": "その他の注意報",
};
```

### 3.2 Significancy Code 表（別表5、code.Significancy）

警戒レベル・危険度コード（出典: `R06_別表類.xlsx > 別表5`）：

```typescript
const SIGNIFICANCY_CODE: Record<string, { level: "1" | "2" | "3" | "4" | "5" | null; label: string }> = {
  "00": { level: null, label: "値なし" },
  "01": { level: null, label: "注意報級未満" },
  "11": { level: null, label: "警戒レベル2未満" },
  "20": { level: null, label: "注意報級" },        // Lv に紐づかない警報級
  "21": { level: "2",  label: "警戒レベル2" },
  "22": { level: "2",  label: "警戒レベル2相当" },
  "30": { level: null, label: "警報級" },          // Lv に紐づかない警報級
  "31": { level: "3",  label: "警戒レベル3相当" },
  "41": { level: "4",  label: "警戒レベル4相当" },
  "50": { level: null, label: "特別警報級" },      // Lv に紐づかない特別警報級
  "51": { level: "5",  label: "警戒レベル5相当" },
};
```

### 3.3 Property/Type 値（別表4）

警報・注意報種別ごとの Property.Type の値：

| 警報・注意報 | Property/Type | 危険度の type 属性 | 量的予想要素 |
|---|---|---|---|
| 大雨警報・注意報 (VPWW55) | "大雨浸水危険度" | "大雨浸水危険度" | — |
| 土砂災害警報・注意報 (VPWW56) | "土砂災害危険度" | "土砂災害危険度" | — |
| 高潮警報・注意報 (VPWW57) | "高潮危険度" / "高潮基準超過" / "高潮ピーク" / "観測" | "高潮危険度" | WaveHeight, TidalLevel |
| 暴風(雪)警報・注意報 (VPWW58) | "風危険度" / "風" | "風危険度" | WindDirection, WindSpeed |
| 波浪警報・注意報 (VPWW59) | "波危険度" / "波" | "波危険度" | WaveHeight |
| 大雪警報・注意報 (VPWW60) | "雪危険度" / "雪" | "雪危険度" | SnowfallDepth |
| 雷注意報 (VPWW61) | "雷危険度" | "雷危険度" | — |
| 融雪注意報 (VPWW61) | "融雪危険度" | "融雪危険度" | — |
| 濃霧注意報 (VPWW61) | "濃霧危険度" / "濃霧" | "濃霧危険度" | Visibility |
| 乾燥注意報 (VPWW61) | "乾燥危険度" / "乾燥" | "乾燥危険度" | Humidity (実効湿度, 最小湿度) |
| なだれ/低温/霜/着氷/着雪注意報 (VPWW61) | "○○危険度" | "○○危険度" | — |

### 3.4 XML 階層構造

```
<Report>
  <Control>
    <Title>気象警報・注意報（Ｒ０６）（○○）</Title>
    <Status>通常|訓練|試験</Status>
    <EditorialOffice>○○地方気象台</EditorialOffice>
    <DateTime>UTC ISO8601</DateTime>
  </Control>
  <Head>
    <Title>地域名＋警報・注意報名</Title>
    <ReportDateTime>JST ISO8601</ReportDateTime>
    <InfoType>発表|訂正</InfoType>
    <Headline>
      <Text>注意警戒文</Text>
      <Information type="気象警報・注意報（府県予報区等）">    <!-- 要約 1 -->
        <Item><Kind><Name/><Code/></Kind><Areas/></Item>
      </Information>
      <Information type="気象警報・注意報（一次細分区域等）">  <!-- 要約 2 -->
      <Information type="気象警報・注意報（市町村等をまとめた地域等）">
      <Information type="気象警報・注意報（市町村等）">
      <Information type="気象警報・注意報（高潮予報区間）">    <!-- VPWW57 のみ -->
    </Headline>
  </Head>
  <Body>
    <Warning type="気象警報・注意報（府県予報区等）">          <!-- 詳細 1 -->
      <Item>
        <Kind>
          <Name>レベル３大雨警報</Name>                       <!-- 別表3 -->
          <Code>03</Code>
          <Status>発表|継続|解除|発表警報・注意報はなし|特別警報から○○|警報から注意報 等</Status>
          <Condition>氾濫発生</Condition>                    <!-- 高潮特別警報のみ -->
          <LastKind><Name/><Code/></LastKind>                <!-- 前回電文 -->
          <Addition><Note/></Addition>
          <Property>                                          <!-- 量的予想 / 警戒レベル -->
            <Type>大雨浸水危険度</Type>
            <SignificancyPart>
              <Base>
                <Significancy type="大雨浸水危険度">
                  <Name>警戒レベル３相当</Name>
                  <Code>31</Code>                            <!-- 別表5 -->
                </Significancy>
              </Base>
            </SignificancyPart>
            <CriteriaPeriod>...</CriteriaPeriod>             <!-- 土砂Lv3-4, 高潮Lv2-4のみ -->
          </Property>
          <Property> ... </Property>                          <!-- 量的予想（風向・風速等） -->
        </Kind>
        <Area><Name/><Code/></Area>
        <ChangeStatus>警報・注意報種別に変化有 等</ChangeStatus>
        <FullStatus>全域|一部</FullStatus>
        <EditingMark>1|0</EditingMark>
      </Item>
    </Warning>
    <Warning type="気象警報・注意報（一次細分区域等）">       <!-- 詳細 2 -->
    <Warning type="気象警報・注意報（市町村等をまとめた地域等）">
    <Warning type="気象警報・注意報（市町村等）">              <!-- ★ Property はここで詳細記載 -->
    <Warning type="気象警報・注意報（高潮予報区間）">          <!-- VPWW57 のみ -->
    <AdditionalInfo>...</AdditionalInfo>                      <!-- VPWW57 のみ -->
    <Comment>...</Comment>                                    <!-- VPWW56 のみ -->
    <OfficeInfo>...</OfficeInfo>
  </Body>
</Report>
```

### 3.5 重要な解釈ルール

1. **Status="発表警報・注意報はなし"** は「該当地域に何も発表されていない（過去も現在もなし）」を意味する。投稿対象外。
2. **Status="解除"** は前回電文で発表中だった警報・注意報が今回解除されたことを意味する。投稿対象（解除通知）。
3. **Status="発表" / "継続"** は現に発表中。投稿対象。
4. **Status="特別警報から○○" / "警報から注意報" 等の遷移** は格下げ・格上げ通知。投稿対象（種別変化通知）。
5. 同一電文内に **4 階層（府県/一次細分/市町村集約/市町村）** の Warning が出現する。要約と詳細の関係。BSAF タグ化は **府県予報区等レベル** で行う（市町村粒度は本文に列挙）。
6. **Property/SignificancyPart は市町村等レベルにのみ存在**（府県・一次細分・市町村集約レベルにはない）。警戒レベルを取得するには Warning[@type="気象警報・注意報（市町村等）"] を読み、市町村ごとの Significancy/Code を集約する必要がある。
7. **同一現象の警報組合せ表示ルール**: 大雨特別警報・大雨危険警報・大雨警報・大雨注意報など同一現象では、上位警報のみ Kind に出現する（下位は省略）。下位を含めて全状態を把握するには市町村等レベルを横断する必要がある。

---

## 4. BSAF タグ設計（再設計案）

### 4.1 タグ方針

1 投稿 = **1 都道府県 × 1 警報種別 × 1 Significancy（または警報級）**。必須 6 タグ＋付加 1（合計 7、AT Protocol 上限 8 以内）。

```text
tags: [
  "bsaf:v1",
  "type:○○-warning",             // 案 A: 現象別タイプ（後述）
  "value:level3" | "warning" | "advisory" | "cancelled",
  "time:2026-05-31T04:18:00Z",    // 電文 ReportDateTime を UTC ISO8601 化
  "target:jp-okinawa",            // 都道府県粒度
  "source:jma",
  "phenomenon:wind"               // 案 A 採用時は省略可、案 B 採用時は必須
]
```

### 4.2 type タグ設計（要決定）

**案 A: 現象別 type（推奨）**

| BSAF type | 対応電文 |
|---|---|
| `heavy-rain-warning` | VPWW55 |
| `landslide-warning` | VPWW56 |
| `storm-surge-warning` | VPWW57 |
| `wind-warning` | VPWW58 |
| `wave-warning` | VPWW59 |
| `snow-warning` | VPWW60 |
| `thunderstorm-warning` | VPWW61 (雷) |
| `dry-air-warning` | VPWW61 (乾燥) |
| `dense-fog-warning` | VPWW61 (濃霧) |
| `avalanche-warning` | VPWW61 (なだれ) |
| `low-temperature-warning` | VPWW61 (低温) |
| `frost-warning` | VPWW61 (霜) |
| `icing-warning` | VPWW61 (着氷) |
| `snow-accretion-warning` | VPWW61 (着雪) |
| `melting-snow-warning` | VPWW61 (融雪) |

**案 B: 統一 type + phenomenon サブタグ**

```
type:weather-warning
phenomenon:heavy-rain | landslide | storm-surge | wind | wave | snow | thunderstorm | ...
```

**推奨は案 A**。理由: BSAF クライアント（kazahana 等）のフィルタ UI が単一タグで完結し、ユーザにとってわかりやすい。bsaf-jma-bot の既存 type 命名（`weather-warning`, `landslide-warning`）とは衝突するが、kikikuru-bot 側を採用すれば旧運用と差別化できる。

### 4.3 value タグ設計

**Lv 体系を持つ電文（VPWW55/56/57）**:
- `value:level5` (Code 33/39/38)
- `value:level4` (Code 43/49/48)
- `value:level3` (Code 03/09/08)
- `value:level2` (Code 10/29/19)
- `value:cancelled` (解除)

**Lv 体系を持たない電文（VPWW58/59/60/61）**:
- `value:special-warning`（特別警報級、Code 32/35/36/37）
- `value:warning`（警報級、Code 02/05/06/07/04/18）
- `value:advisory`（注意報級、Code 13/14/15/16/17/12/20-27）
- `value:cancelled`（解除）

または、より詳細に：
- `value:advisory-strong-wind`（強風注意報）
- `value:warning-storm`（暴風警報）
等の現象＋級別の組み合わせ命名も検討余地あり。**要協議**。

### 4.4 重複抑制キー

`${type}:${target}:${value}` を 30 分保持（現行と同じ方針）。

### 4.5 投稿本文の構成

```
【○○警報・注意報】（種別）

[都道府県名]に[警報名]が発表されました。
※レベル○相当（該当時のみ）

対象市町村: [○○市、××町、△△村]
（最大8件、超過時は「他N件」）

量的予想（該当時のみ）:
- 最大風速: 25m/s
- 視程: 200m以下
- 降雪量: 24時間最大60cm
等

出典: 気象庁
https://www.jma.go.jp/bosai/warning/
```

文字数は 300 字以内（Bluesky 上限）。

---

## 5. 実装計画

### Phase 0: 既存実装の整理（最優先）

- [ ] `src/parsers/heavyRainWarning.ts` を削除（誤った前提に基づく）
- [ ] `src/bsaf/mapper.ts` を削除
- [ ] `src/feeds/atomFeed.ts` の `TARGET_CODES` を VPWW55-61 に拡張
- [ ] 既存 `tests/` を全削除（新仕様に合わない）

### Phase 1: コア再実装

- [ ] `src/codes/kindCode.ts` — 別表3 を TS 定数化（KIND_CODE_TO_NAME）
- [ ] `src/codes/significancy.ts` — 別表5 を TS 定数化（SIGNIFICANCY_CODE）
- [ ] `src/codes/prefectures.ts` — 市町村コード上2-3桁 → 都道府県 target マッピング（現行 `src/bsaf/prefectures.ts` を再利用検討）
- [ ] `src/parsers/r06Warning.ts` — VPWW55-61 共通パーサー
  - 入力: XML 文字列
  - 出力: `ParsedR06Warning`（Control, Head, Body/Warning 全階層を構造化）
  - 訓練・試験電文は null 返却
- [ ] `src/bsaf/r06Mapper.ts` — Parsed → BsafPost[] 変換
  - 府県予報区等レベルの Warning から都道府県粒度の集約を生成
  - 市町村粒度の Warning から Significancy を集約し、レベルを決定
  - 解除電文は別途解除通知投稿を生成
  - 1 都道府県 × 1 警報種別 × 1 値 単位で BsafPost を生成

### Phase 2: テスト

- [ ] `tests/parsers/r06Warning.test.ts` — 各 VPWW55-61 のサンプル XML をパース
  - 発表電文（級別の警報・注意報）
  - 解除電文
  - 訓練・試験電文（null 返却確認）
  - 複数市町村等の集約
  - LastKind による種別変化（特別警報→警報、警報→注意報）
- [ ] `tests/bsaf/r06Mapper.test.ts` — 各電文タイプから生成される BsafPost を検証
- [ ] サンプル XML は `tests/fixtures/` に格納（既存 sample-xml/ から）

### Phase 3: 統合・デプロイ

- [ ] `src/poller.ts` を新パーサーに繋ぎ込み
- [ ] ログメッセージ刷新（旧スキップロジック削除）
- [ ] Fly.io 再デプロイ
- [ ] 実稼働で 24 時間観察、投稿数・スキップ理由を検証
- [ ] kazahana に Bot 定義（`bot-definition.json`）を更新登録

### Phase 4: bsaf-jma-bot 旧電文パーサー段階削除

- [ ] kikikuru-bot 安定稼働 1 週間以上を確認
- [ ] bsaf-jma-bot から `weatherWarning.ts`, `landslideWarning.ts`, `specialWarning.ts` パーサーを削除
- [ ] 旧 BSAF タグ運用との整合性確認（既に投稿済みの旧投稿は AT Protocol 上残置）

---

## 6. 設計判断（2026-05-31 総司様確定）

### 6.1 value タグの粒度 — **中粒度採用**

```text
type:○○-warning       ← 現象別タイプ（VPWW別、§4.2 案A）
value:level2 | level3 | level4 | level5     ← Significancy/Code が 21/22/31/41/51 のとき
value:special-warning | warning | advisory  ← Significancy/Code が 50/30/20 のとき（Lv体系外電文）
value:cancelled                               ← Status="解除" または Kind/Code="00"
```

判定ロジック:

- Significancy/Code = 21 or 22 → `value:level2`
- Significancy/Code = 31 → `value:level3`
- Significancy/Code = 41 → `value:level4`
- Significancy/Code = 51 → `value:level5`
- Significancy/Code = 50 → `value:special-warning`
- Significancy/Code = 30 → `value:warning`
- Significancy/Code = 20 → `value:advisory`
- Significancy/Code = 01, 11, 00 → 投稿対象外（注意報級未満）
- Status="解除" or Kind/Code="00" → `value:cancelled`

### 6.2 高潮予報区間 — **本文補足記載のみ**

VPWW57 の `Warning[@type="気象警報・注意報（高潮予報区間）"]` は BSAF タグ化せず、投稿本文に「高潮予報区間: ○○海岸」等の補足を追記するに留める。AdditionalInfo の水位基準地点情報も同様に本文に最小限で記載。

### 6.3 量的予想事項の本文表現 — **存在時のみ含める**

`<jmx_eb:○○>` 系の量予想要素が存在する場合のみ本文に「主な量的予想」セクションを追加。

含める対象:

- VPWW58 暴風: 最大風速 + 風向（例: 「最大風速 15m/s（南西の風）」）
- VPWW59 波浪: 波高（例: 「波高 5m」）
- VPWW60 大雪: 降雪量（例: 「24時間最大降雪量 90cm」）— 複数の type 属性は最大値1件のみ
- VPWW61 濃霧: 視程（例: 「視程 200m以下」）
- VPWW61 乾燥: 湿度（例: 「実効湿度 60%、最小湿度 30%」）
- VPWW57 高潮: 潮位 + うちあげ高水位（例: 「最高潮位 2.3m」）

付加事項（Addition/Note）は括弧書きで該当現象に併記（例: 「うねり」「突風、ひょう」）。

VPWW55/56 と VPWW61 の雷・融雪・なだれ・低温・霜・着氷・着雪は量予想要素を持たない（危険度のみ）。

CriteriaPeriod（VPWW56/57 の Lv3-4 到達予想時間）は Phase 1 では実装対象外（Phase 2 で追加検討）。

### 6.4 解除電文の扱い — **複数投稿に分解**

1 都道府県 × 1 警報種別 × 1 値 単位で複数投稿に分解する。複数現象が同時解除される場合も現象ごとに別投稿。dedupeKey が一意に保たれる利点を優先する。

### 6.5 4 階層 Warning の解釈 — **府県予報区等基準＋市町村等から集約**

- 投稿生成は **府県予報区等レベルの Warning** をループ起点とする
- Significancy（警戒レベル）と量的予想は **市町村等レベルの Warning から集約**して取得
- 市町村等レベルでは 1 つの Item に複数 Kind が並列出現しうる（特に VPWW61）。Item ループ → Kind ループの二重ループ
- 同一現象・同一都道府県内で複数の Significancy が出現した場合は **最大値（最も深刻なレベル）** を採用
- 投稿本文には市町村等名を最大 8 件、超過分は「ほか N 市町村」と省略

---

## 7. 一次資料参照先

すべて `g:/dev/bsaf-kikikuru-bot/jma-spec/` 配下にローカル取得済み：

| 資料 | 内容 |
|---|---|
| `jmaxml_20221209_format_v1_3.pdf` | XML フォーマット本文 |
| `jmaxml_20260430_code.xlsx` + `code_dump.tsv` | code.WeatherWarning / code.Significancy 等の管理表 |
| `manual/気象警報・注意報（Ｒ０６）_解説資料.pdf` + `r06_manual.txt` | 主仕様書（27ページ） |
| `manual/R06_別表類.xlsx` + `R06_betshu_dump.tsv` | 別表1（電文割当）/別表2（ヘッダ）/別表3（Kind Code）/別表4（Property）/別表5（Significancy）/別表6（時間表現）/別表7（Ｈ２７対応） |
| `sample-xml/20260530185534_0_VPWW58_012000.xml` | VPWW58 暴風 実電文（解除パターン） |
| `sample-xml/20260530191836_0_VPWW59_473000.xml` | VPWW59 波浪 実電文（注意報発表中＋Property付き） |
| `sample-xml/20260530181804_0_VPWW61_050000.xml` | VPWW61 その他 実電文 |

---

## 8. 参照リンク（一次情報）

- JMA 防災情報XMLフォーマット技術資料: https://xml.kishou.go.jp/tec_material.html
- XML一覧表（表1.1）: https://xml.kishou.go.jp/jmaxml_20260129_format_v1_3_hyo1_1.pdf
- コード管理表: https://xml.kishou.go.jp/jmaxml_20260430_code.xlsx
- 個別コード表: https://xml.kishou.go.jp/jmaxml_20260430_Code.zip
- 解説資料セット: https://xml.kishou.go.jp/jmaxml_20260527_Manual(pdf).zip
- 防災情報XML Atom Feed（高頻度）: https://www.data.jma.go.jp/developer/xml/feed/extra.xml

---

**本書は再設計の起点。実装着手前に総司様と論点 6.1〜6.5 を協議すること。**

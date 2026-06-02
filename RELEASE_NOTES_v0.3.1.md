# bsaf-kikikuru-bot v0.3.1

Release date: 2026-06-03

---

## English

### Highlights

Replaces the single-square level icon introduced in v0.3.0 with a **5-step level meter** that visually communicates how far the alert level has escalated. For example, Level 2 now appears as `🟨🟨⬜⬜⬜` (2 of 5 squares filled), making the alert level immediately intuitive.

### Changes

- **Level-system header icons are now 5-step meters.**

  | Value | Icon |
  |---|---|
  | `level5` | `⬛⬛⬛⬛⬛` |
  | `level4` | `🟪🟪🟪🟪⬜` |
  | `level3` | `🟥🟥🟥⬜⬜` |
  | `level2` | `🟨🟨⬜⬜⬜` |

- Non-level-system icons (`⚠️` for advisory/warning, `🚨` for non-level special warning, no icon for cancellation) are unchanged.
- Body length stays comfortably under 300 grapheme clusters (VPWW57 Lv2 sample: 211 graphemes).

### Sample output (VPWW57 Lv2)

```
🟨🟨⬜⬜⬜【高潮警報・注意報】レベル2高潮注意報

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

- Updated `VALUE_ICON` table in `src/bsaf/r06Mapper.ts`.
- Updated 2 tests in `tests/r06Mapper.test.ts` to assert the new bar header.
- All 58 tests pass; `tsc --noEmit` clean.

---

## 日本語

### ハイライト

v0.3.0 で導入した単一の四角アイコンを **5 段階レベルメーター** に置き換えました。たとえば Lv2 は `🟨🟨⬜⬜⬜`（5 マス中 2 マス塗りつぶし）として表示され、警戒レベルの到達度が直感的に伝わる表示になります。

### 変更点

- **警戒レベル相当情報のヘッダーアイコンを 5 段階メーター化**

  | 値 | アイコン |
  |---|---|
  | `level5` | `⬛⬛⬛⬛⬛` |
  | `level4` | `🟪🟪🟪🟪⬜` |
  | `level3` | `🟥🟥🟥⬜⬜` |
  | `level2` | `🟨🟨⬜⬜⬜` |

- レベル体系外のアイコン（注意報・警報は `⚠️`、レベル外特別警報は `🚨`、解除はアイコンなし）は据え置きです。
- 本文長は 300 grapheme cluster 制限内に余裕（VPWW57 Lv2 サンプルで 211 grapheme）。

### 投稿例（VPWW57 Lv2）

```
🟨🟨⬜⬜⬜【高潮警報・注意報】レベル2高潮注意報

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

- `src/bsaf/r06Mapper.ts` の `VALUE_ICON` テーブルを更新。
- `tests/r06Mapper.test.ts` の 2 件のテストを新バー表記に追随。
- 全 58 テストパス、`tsc --noEmit` エラーなし。

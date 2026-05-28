# bsaf-kikikuru-bot

**A [BSAF](https://github.com/osprey74/bsaf-protocol)-compliant Bluesky bot that posts JMA Kikikuru (real-time landslide / inundation / flood risk) warning information.**

[@bsaf-kikikuru-bot.bsky.social](https://bsky.app/profile/bsaf-kikikuru-bot.bsky.social)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[日本語 README](README-ja.md)

---

## Overview

bsaf-kikikuru-bot monitors the Japan Meteorological Agency (JMA) public XML feed for "Kikikuru" — real-time risk-distribution warnings for heavy rain, landslide, storm-surge, and flooding — and automatically posts them to Bluesky with structured BSAF tags. BSAF-compatible clients can filter posts by warning type, level, and prefecture.

This is a reference bot implementation for the [BSAF protocol](https://github.com/osprey74/bsaf-protocol), complementary to [bsaf-jma-bot](https://github.com/osprey74/bsaf-jma-bot) (which handles earthquakes, tsunamis, eruptions, and weather warnings).

## Supported Telegrams

<!-- markdownlint-disable MD060 -->
| Telegram | Content | Levels |
|---|---|---|
| VPWW55 | Heavy rain warning level information | Lv.2–Lv.5 |
| VPWW56 | Landslide warning level information | Lv.2–Lv.5 |
| VPWW57 | Storm-surge warning level information | Lv.2–Lv.5 |
| VPWW58 | Flood / inundation warning level information | Lv.2–Lv.5 |
<!-- markdownlint-enable MD060 -->

Per the BSAF philosophy — **provide as much information as possible, let the client filter** — Lv.2 (advisory) through Lv.5 (emergency warning) as well as cancellations are all published.

**Level 1 (early-action advisory / VPWP50) is currently out of scope** (planned for a separate future bot).

## Posting Granularity

- **1 post = 1 prefecture × 1 warning type × 1 level.**
- Posts that span multiple prefectures are split into multiple posts.
- Municipality-level detail is included in the post body (up to 8 names + remainder).

## BSAF Tags

Each post carries 6 required BSAF tags (AT Protocol limit: 8):

```text
bsaf:v1
type:heavy-rain-warning      # or landslide-warning / storm-surge-warning / flood-warning
value:level4                 # or level2 / level3 / level5 / cancelled
time:2026-05-28T12:00:00Z    # UTC ISO 8601 (telegram ReportDateTime)
target:jp-hokkaido           # one of jp-hokkaido ... jp-okinawa (47 prefectures)
source:jma
```

See [bot-definition.json](bot-definition.json) for the complete list of filter options.

## Health Check

- [Health endpoint](https://bsaf-kikikuru-bot.fly.dev/health) — Simple OK/degraded JSON

## Architecture

```text
JMA XML feed (extra.xml)
  │  polling every 10 min
  ▼
Poller → Atom parser → Kikikuru XML parser → BSAF mapper → AT Protocol post
                                                  │
                                            WarningState (in-memory, 30 min dedupe)
                                                  │
                                            /health endpoint (HTTP :3000)
```

## Tech Stack

- **Runtime:** [Bun](https://bun.sh) v1.1+
- **Language:** TypeScript (strict)
- **HTTP server:** Hono (health-check only)
- **Bluesky SDK:** @atproto/api
- **XML Parser:** fast-xml-parser
- **Test runner:** `bun test`
- **Deploy:** Docker / Fly.io (Tokyo `nrt` region)

## Setup

### Prerequisites

- [Bun](https://bun.sh) v1.1+
- A Bluesky account with an [App Password](https://bsky.app/settings/app-passwords)

### Installation

```bash
git clone https://github.com/osprey74/bsaf-kikikuru-bot.git
cd bsaf-kikikuru-bot
bun install
```

### Configuration

Create a `.env` file:

```bash
BSKY_IDENTIFIER=your-bot.bsky.social
BSKY_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

Optional environment variables:

<!-- markdownlint-disable MD060 -->
| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port for the health endpoint |
| `LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
<!-- markdownlint-enable MD060 -->

### Run

```bash
# Development (hot reload)
bun run dev

# Production
bun run start

# Tests
bun test

# Type check
bun run typecheck

# Dry-run (no posting; prints generated text + BSAF tags for sample telegrams)
bun run dry-run

# Real test post (requires .env; posts ONE labelled test entry to Bluesky)
bun run test-post
```

### Deploy to Fly.io

```bash
fly apps create bsaf-kikikuru-bot --org personal
fly secrets set BSKY_IDENTIFIER=your-bot.bsky.social -a bsaf-kikikuru-bot
fly secrets set BSKY_PASSWORD=xxxx-xxxx-xxxx-xxxx  -a bsaf-kikikuru-bot
fly deploy -a bsaf-kikikuru-bot

# IMPORTANT: this bot keeps state in-memory; HA replication will cause duplicate posts.
# Lock to a single Machine:
fly scale count 1 -a bsaf-kikikuru-bot
```

## Bot Definition

[bot-definition.json](bot-definition.json) is a machine-readable JSON file that describes this bot's identity and the filters it supports. BSAF-compatible clients (such as [kazahana](https://github.com/osprey74/kazahana)) use this file to register BSAF bots.

### Hosted URL

The file is hosted at the following URL. Use this URL when registering the bot in a client:

```text
https://raw.githubusercontent.com/osprey74/bsaf-kikikuru-bot/main/bot-definition.json
```

### Usage

1. Open the bot management screen in a BSAF-compatible client (e.g., kazahana)
2. Enter the URL above to register the bot
3. The client fetches `bot-definition.json` and automatically builds a filter UI
4. Configure filters by warning type, level, and prefecture to receive only the alerts you need

### File Structure

<!-- markdownlint-disable MD060 -->
| Field | Description |
|---|---|
| `bsaf_schema` | BSAF schema version (`"1.0"`) |
| `updated_at` | Last update timestamp (ISO 8601) |
| `self_url` | Hosted URL of this file |
| `bot` | Bot identity (handle, DID, name, description, data source) |
| `filters` | Array of supported filters |
<!-- markdownlint-enable MD060 -->

The `filters` array defines three filter types:

<!-- markdownlint-disable MD060 -->
| Filter (`tag`) | Label | Options |
|---|---|---|
| `type` | Warning type | heavy-rain-warning, landslide-warning, storm-surge-warning, flood-warning |
| `value` | Level | level2, level3, level4, level5, cancelled |
| `target` | Prefecture | jp-hokkaido, jp-aomori, ..., jp-okinawa (47 prefectures) |
<!-- markdownlint-enable MD060 -->

Each filter's `options` contains `value` (BSAF tag value) and `label` (display name) pairs, which clients use to build the filter UI.

## Relationship to bsaf-jma-bot

[bsaf-jma-bot](https://github.com/osprey74/bsaf-jma-bot) and bsaf-kikikuru-bot share the same data source (JMA), but cover different information granularity:

<!-- markdownlint-disable MD060 -->
| Bot | Information | Telegram codes |
|---|---|---|
| bsaf-jma-bot | Earthquake / tsunami / volcano / weather warnings (area-based) | eqvol.xml, VPWW53/54 etc. |
| bsaf-kikikuru-bot | Real-time risk distribution (Kikikuru, prefecture-level) | VPWW55–58 |
<!-- markdownlint-enable MD060 -->

BSAF duplicate detection works per (`type` + `value` + `time` + `target`); since the two bots use different `type` values for these distinct datasets, they do not conflict.

## Data Source

All data is sourced from [JMA's public XML feed service](https://www.data.jma.go.jp/developer/xml/). This bot is unofficial and not affiliated with or endorsed by JMA.

When citing this data, include the attribution "出典：気象庁ホームページ" (Source: JMA website).

## Related Projects

- [BSAF Protocol](https://github.com/osprey74/bsaf-protocol) — The protocol specification
- [bsaf-jma-bot](https://github.com/osprey74/bsaf-jma-bot) — Earthquake / tsunami / weather warning bot
- [kazahana](https://github.com/osprey74/kazahana) — Bluesky desktop client with BSAF support

## Support

If you find this project useful, consider supporting its development:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?logo=github)](https://github.com/sponsors/osprey74)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?logo=ko-fi)](https://ko-fi.com/osprey74)

## License

[MIT License](LICENSE)

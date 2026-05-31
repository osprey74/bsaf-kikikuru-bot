# bsaf-kikikuru-bot

**A [BSAF](https://github.com/osprey74/bsaf-protocol)-compliant Bluesky bot that posts JMA's new R06 weather warnings and advisories.**

[@bsaf-kikikuru-bot.bsky.social](https://bsky.app/profile/bsaf-kikikuru-bot.bsky.social)

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[日本語 README](README-ja.md)

---

## Overview

bsaf-kikikuru-bot monitors the Japan Meteorological Agency (JMA) public XML feed for the new "R06" weather warnings and advisories — telegrams VPWW55–61, operational since 2026-05-29 — and automatically posts them to Bluesky with structured BSAF tags. BSAF-compatible clients can filter posts by phenomenon, alert level, and prefecture.

This is a reference bot implementation for the [BSAF protocol](https://github.com/osprey74/bsaf-protocol), complementary to [bsaf-jma-bot](https://github.com/osprey74/bsaf-jma-bot) (which handles earthquakes, tsunamis, volcanic eruptions, and transitional weather telegrams).

## Supported Telegrams

<!-- markdownlint-disable MD060 -->
| Telegram | Content | Included alerts |
|---|---|---|
| VPWW55 | Heavy rain warning-level information | Lv5 emergency / Lv4 danger / Lv3 warning / Lv2 advisory |
| VPWW56 | Landslide warning-level information | Lv5 emergency / Lv4 danger / Lv3 warning / Lv2 advisory |
| VPWW57 | Storm-surge warning-level information | Lv5 emergency / Lv4 danger / Lv3 warning / Lv2 advisory |
| VPWW58 | Strong wind / blizzard warnings & advisories | Blizzard emergency / Wind emergency / Blizzard warning / Wind warning / Wind-and-snow advisory / Strong wind advisory |
| VPWW59 | Wave warnings & advisories | Wave emergency / Wave warning / Wave advisory |
| VPWW60 | Heavy snow warnings & advisories | Snow emergency / Snow warning / Snow advisory |
| VPWW61 | Other advisories | Thunderstorm / Snowmelt / Dense fog / Dry air / Avalanche / Low temperature / Frost / Icing / Snow accretion |
<!-- markdownlint-enable MD060 -->

Per the BSAF philosophy — **provide as much information as possible, let the client filter** — all phenomena, all alert levels, and cancellations are published.

**Flood/inundation telegrams (VXKOii / VXSUii) and Level 1 early-action advisories (VPFD61 / VPFW60) are currently out of scope** (planned for a separate future bot).

## Posting Granularity

- **1 post = 1 prefecture × 1 phenomenon × 1 value.**
- Posts that span multiple prefectures or phenomena are split into multiple posts.
- Cancellations are posted separately as their own unit.
- Municipality-level detail is included in the post body (up to 8 names + remainder).
- Quantitative forecasts (max wind speed, wave height, visibility, snowfall, humidity, tidal level) are included only when present in the source telegram.

## BSAF Tags

Each post carries 6 required BSAF tags (AT Protocol limit: 8):

```text
bsaf:v1
type:wind-warning           # phenomenon-specific. One of:
                            # heavy-rain-warning / landslide-warning / storm-surge-warning /
                            # wind-warning / wave-warning / snow-warning /
                            # thunderstorm-warning / dense-fog-warning / dry-air-warning /
                            # avalanche-warning / low-temperature-warning / frost-warning /
                            # icing-warning / snow-accretion-warning / melting-snow-warning /
                            # other-warning
value:advisory              # Level-based: level2 / level3 / level4 / level5
                            # Severity-based: advisory / warning / special-warning
                            # Cancellation: cancelled
time:2026-05-31T04:18:00Z   # UTC ISO 8601 (telegram ReportDateTime)
target:jp-tokyo             # one of jp-hokkaido ... jp-okinawa (47 prefectures)
source:jma
```

See [bot-definition.json](bot-definition.json) for the complete list of filter options.

## Health Check

- [Health endpoint](https://bsaf-kikikuru-bot.fly.dev/health) — Simple OK/degraded JSON

## Architecture

```text
JMA XML feed (extra.xml)
  │  Polled every 10 minutes
  ▼
Poller → Atom parser → R06 warning parser → BSAF mapper → AT Protocol post
                                                     │
                                            WarningState (in-memory, 30-min dedupe)
                                                     │
                                            /health endpoint (HTTP :3000)
```

## Tech Stack

- **Runtime:** [Bun](https://bun.sh) v1.1+
- **Language:** TypeScript (strict)
- **HTTP server:** Hono (for health endpoint)
- **Bluesky SDK:** @atproto/api
- **XML parser:** fast-xml-parser
- **Test runner:** `bun test`
- **Deployment:** Docker / Fly.io (Tokyo `nrt` region)

## Setup

### Prerequisites

- [Bun](https://bun.sh) v1.1+
- A Bluesky account with an [app password](https://bsky.app/settings/app-passwords)

### Install

```bash
git clone https://github.com/osprey74/bsaf-kikikuru-bot.git
cd bsaf-kikikuru-bot
bun install
```

### Configure

Create a `.env` file:

```bash
BSKY_IDENTIFIER=your-bot.bsky.social
BSKY_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

Optional environment variables:

<!-- markdownlint-disable MD060 -->
| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Health-check HTTP port |
| `LOG_LEVEL` | `info` | Log verbosity (`debug`, `info`, `warn`, `error`) |
<!-- markdownlint-enable MD060 -->

### Run

```bash
# Development mode (hot reload)
bun run dev

# Production mode
bun run start

# Tests
bun test

# Type check
bun run typecheck
```

### Deploy to Fly.io

```bash
fly apps create bsaf-kikikuru-bot --org personal
fly secrets set BSKY_IDENTIFIER=your-bot.bsky.social -a bsaf-kikikuru-bot
fly secrets set BSKY_PASSWORD=xxxx-xxxx-xxxx-xxxx  -a bsaf-kikikuru-bot
fly deploy -a bsaf-kikikuru-bot

# IMPORTANT: This bot holds state in memory, so HA deployments would
# cause duplicate posts. Always pin to a single instance:
fly scale count 1 -a bsaf-kikikuru-bot
```

## Bot Definition File

[bot-definition.json](bot-definition.json) is a machine-readable JSON file describing this bot and its supported filters. BSAF-compatible clients (such as [kazahana](https://github.com/osprey74/kazahana)) can register this file to enable filtering UI for the bot's posts.

### Hosted URL

The file is hosted at the following URL. Use this URL when registering the bot with a client:

```text
https://raw.githubusercontent.com/osprey74/bsaf-kikikuru-bot/main/bot-definition.json
```

### Usage

1. Open the bot management screen in a BSAF-compatible client (e.g. kazahana)
2. Enter the URL above to register the bot
3. The client reads `bot-definition.json` and auto-builds the filter UI
4. Configure filters by phenomenon, alert level, and prefecture to receive only the information you need

### File Structure

<!-- markdownlint-disable MD060 -->
| Field | Description |
|---|---|
| `bsaf_schema` | BSAF schema version (`"1.0"`) |
| `updated_at` | Last modified timestamp (ISO 8601) |
| `self_url` | URL where this file is hosted |
| `bot` | Bot info (handle, DID, name, description, data source) |
| `filters` | Array of supported filters |
<!-- markdownlint-enable MD060 -->

The `filters` array contains three filters:

<!-- markdownlint-disable MD060 -->
| Filter (`tag`) | Label | Contents |
|---|---|---|
| `type` | Phenomenon | 17 categories (heavy rain / landslide / storm-surge / wind / wave / snow / thunderstorm / snowmelt / dense fog / dry air / avalanche / low temperature / frost / icing / snow accretion / transitional flood / other) |
| `value` | Alert level / severity | level2..level5 / advisory / warning / special-warning / cancelled |
| `target` | Prefecture | Hokkaido, Aomori, ..., Okinawa (all 47 prefectures) |
<!-- markdownlint-enable MD060 -->

Each filter's `options` contains `value` (BSAF tag value) and `label` (display name) pairs, which clients use to build the filter UI.

## Relationship to bsaf-jma-bot

[bsaf-jma-bot](https://github.com/osprey74/bsaf-jma-bot) and bsaf-kikikuru-bot share the same data source (JMA) but cover different telegrams:

<!-- markdownlint-disable MD060 -->
| Bot | Information type | Source telegrams |
|---|---|---|
| bsaf-jma-bot | Earthquakes, tsunamis, eruptions, ash, Nankai Trough, plus VPBS50 (regional weather emergency) | eqvol.xml, VPBS50, etc. |
| bsaf-kikikuru-bot | New R06 weather warnings & advisories (all phenomena) | VPWW55–61 |
<!-- markdownlint-enable MD060 -->

Legacy telegrams (VPWW54 Weather Warnings H27, VXWW50 Landslide Information, VPNO50 Special Weather Warning Notice) are still handled by bsaf-jma-bot as transitional sources. They will be retired in stages once kikikuru-bot is stable in production (the transition period runs through approximately 2028).

BSAF deduplication is `type + value + time + target` exact match. Since the two bots use disjoint `type` values, there are no collisions.

## Data Source

All data originates from the [JMA Disaster Prevention Information XML feed](https://www.data.jma.go.jp/developer/xml/). This bot is unofficial and not affiliated with JMA.

When citing the data, please credit: "**Source: Japan Meteorological Agency website**".

## Related Projects

- [BSAF Protocol](https://github.com/osprey74/bsaf-protocol) — Protocol specification
- [bsaf-jma-bot](https://github.com/osprey74/bsaf-jma-bot) — Earthquake / tsunami / volcanic bot
- [kazahana](https://github.com/osprey74/kazahana) — BSAF-compatible Bluesky desktop client

## Support

If this project is useful to you, please consider supporting its development:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?logo=github)](https://github.com/sponsors/osprey74)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-ff5e5b?logo=ko-fi)](https://ko-fi.com/osprey74)

## License

[MIT License](LICENSE)

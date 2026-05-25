# RugSentry AI — Reddit Devvit App

**AI-powered crypto scam detection and moderation for Reddit communities.**

RugSentry AI is a self-contained Reddit mod tool that protects crypto communities from rug pulls, honeypot tokens, coordinated shill campaigns, and scam promotions — all running natively on the Devvit platform with zero external servers.

---

## How It Works

Every post and comment is analyzed through a **3-layer detection pipeline**:

1. **Pattern Matching** — Scam keywords, urgency language, excessive emojis, high-risk domains (pump.fun, Telegram), account age/karma scoring
2. **On-Chain Token Scanning** — Contract addresses and token links are verified in real-time via GoPlus, DexScreener, and Honeypot.is (honeypot detection, mint functions, liquidity checks, tax analysis, holder concentration, deployer rug history)
3. **AI Classification** — Google Gemini 2.5 Flash analyzes post content for scam intent with confidence scoring

Posts are scored 0–100 and categorized: **SAFE → LOW → MEDIUM → HIGH → CRITICAL**

---

## Features

### Core Detection
- **Scam keyword & pattern matching** — 25+ scam indicators with urgency/pressure language detection
- **On-chain token scanning** — GoPlus (honeypot, mint, blacklist, taxes, holder concentration), DexScreener (liquidity, price), Honeypot.is
- **Gemini 2.5 Flash AI** — Contextual scam classification with confidence scoring and explanations
- **Entity extraction** — Automatically detects EVM/Solana addresses, DexScreener links, Pump.fun links, Telegram links, token symbols

### Unique Features (Not Available on Reddit Natively)
- **Repeat Offender Strike System** — Tracks users across posts with escalating actions:
  - Strike 1: Flag + modmail alert
  - Strike 2: Auto-remove future posts
  - Strike 3+: Ban recommendation sent to mods
- **Coordinated Shill Detection** — Detects when 3+ different accounts promote the same token/contract within 1 hour and alerts moderators with a list of involved accounts
- **Live Community Dashboard** — Custom post widget showing real-time stats: posts scanned, scams caught, auto-removals, shill campaigns detected, repeat offenders, and community safety score

### Moderation Actions
- **Auto-removal** of posts exceeding the configured risk threshold
- **Modmail alerts** with detailed risk reports for high-risk posts
- **Warning comments** on removed posts explaining the reason
- **Configurable thresholds** per subreddit installation

### Mod Menu Items
| Action | Description |
|--------|-------------|
| **Analyze Post** | Run full RugSentry analysis on any post |
| **View Risk Report** | See risk score, flags, and AI analysis |
| **Check User Strikes** | View a user's offender history and strike count |
| **Remove + Report** | Remove post and add a warning comment |

---

## Installation

### Prerequisites
- [Devvit CLI](https://developers.reddit.com/docs/get-started) installed (`npm install -g devvit`)
- A Reddit account with a test subreddit (< 200 subscribers)

### Setup

```bash
cd apps/devvit-app
npm install
devvit login
devvit upload
```

### Configure Settings

```bash
# Required: Gemini API key for AI classification
devvit settings set geminiApiKey
# Get a free key at https://aistudio.google.com/apikey

# Optional: GoPlus API key for higher rate limits on token scanning
devvit settings set goPlusApiKey
```

### Subreddit Settings (per installation)
- **Auto-Remove Threshold** (default: 85) — Posts scoring above this are auto-removed
- **Alert Threshold** (default: 65) — Posts scoring above this trigger modmail alerts

### Playtest

```bash
devvit playtest r/your_test_subreddit
```

---

## Architecture

```
src/main.tsx (single self-contained file)
├── Configuration & Settings
├── Constants & Patterns (scam keywords, entity regex, chain IDs)
├── Repeat Offender Tracker (strike system with kvStore)
├── Coordinated Shill Detection (cross-user token correlation)
├── Community Stats Tracker (live metrics in kvStore)
├── Analysis Engine
│   ├── analyzePostLocally() — pattern matching & risk scoring
│   ├── extractEntities() — contract addresses, links, symbols
│   └── analyzePost() — orchestrates all 3 analysis layers
├── On-Chain Token Scanning
│   ├── fetchGoPlus() — token security analysis
│   ├── fetchDexScreener() — liquidity & market data
│   ├── fetchHoneypotIs() — honeypot verification
│   └── scanToken() — aggregates all on-chain data
├── AI Classification
│   └── classifyWithGemini() — Gemini 2.5 Flash scam detection
├── Triggers (PostSubmit, CommentSubmit)
├── Menu Items (4 moderator actions)
└── Dashboard Widget (live stats custom post type)
```

**No external backend required.** Everything runs within Devvit's runtime using:
- `fetch()` for external API calls (Gemini, GoPlus, DexScreener, Honeypot.is)
- `kvStore` for persistent data (risk results, offender records, shill tracking, stats)
- `reddit` API for moderation actions (remove, comment, modmail)

---

## External APIs Used

| API | Purpose | Key Required? |
|-----|---------|--------------|
| [Google Gemini 2.5 Flash](https://ai.google.dev) | AI scam classification | Yes (free tier) |
| [GoPlus Security](https://gopluslabs.io) | Token security analysis | No (optional for higher limits) |
| [DexScreener](https://dexscreener.com) | Liquidity & market data | No |
| [Honeypot.is](https://honeypot.is) | Honeypot detection | No |

---

## Risk Scoring

| Score | Level | Action |
|-------|-------|--------|
| 0–20 | SAFE | No action |
| 21–40 | LOW | Logged only |
| 41–60 | MEDIUM | Stored for review |
| 61–80 | HIGH | Modmail alert sent |
| 81–100 | CRITICAL | Auto-removed + modmail + warning comment |

Score is calculated from: keyword matches (+8 each), account age (+15), low karma (+10), contract addresses (+5), Telegram links (+10), Pump.fun links (+20), urgency language (+8), excessive emojis (+5), on-chain scan results (up to +40 for honeypots), AI classification (+0–30), repeat offender bonus (+5 per strike), coordinated shill bonus (+20).

---

## License

MIT

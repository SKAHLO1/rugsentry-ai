# RugSentry AI 🛡️

**AI-Powered Anti-Scam Moderation for Reddit Crypto Communities**

[![Reddit App](https://img.shields.io/badge/Reddit-Devvit%20App-FF4500?logo=reddit&logoColor=white)](https://developers.reddit.com/apps/rugsentry-ai)
[![Gemini AI](https://img.shields.io/badge/Powered%20by-Gemini%202.5%20Flash-4285F4?logo=google&logoColor=white)](https://ai.google.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

RugSentry AI is a **self-contained Reddit Devvit app** that protects crypto communities from rug pulls, honeypot tokens, coordinated shill campaigns, and scam promotions. It runs entirely on the Devvit platform — no external servers required.

**Reddit App:** [developers.reddit.com/apps/rugsentry-ai](https://developers.reddit.com/apps/rugsentry-ai)

---

## What Makes RugSentry Different?

Reddit's built-in mod tools (AutoMod, spam filter, crowd control) are **text-only and rule-based**. They can't:

- Verify if a contract address is a honeypot
- Detect coordinated shill campaigns across multiple accounts
- Track repeat scam offenders with escalating consequences
- Analyze on-chain token data (liquidity, taxes, holder concentration)
- Use AI to understand the *intent* behind a post

**RugSentry does all of this automatically, in real-time, on every post.**

---

## Features

### 3-Layer Detection Pipeline

| Layer | What It Does | Technologies |
|-------|-------------|-------------|
| **Pattern Matching** | Scam keywords, urgency language, emojis, account age, karma, high-risk domains | Built-in engine |
| **On-Chain Scanning** | Honeypot detection, mint functions, blacklists, taxes, liquidity, holder concentration, deployer rug history | GoPlus, DexScreener, Honeypot.is |
| **AI Classification** | Contextual scam intent analysis with confidence scoring | Google Gemini 2.5 Flash |

### Unique Capabilities (Not on Reddit)

- **Repeat Offender Strike System** — Tracks users across posts. Strike 1: warn. Strike 2: auto-remove. Strike 3+: ban recommendation to mods.
- **Coordinated Shill Detection** — Alerts mods when 3+ accounts promote the same token/contract within 1 hour, listing all involved accounts.
- **Live Community Dashboard** — Custom post widget with real-time stats: posts scanned, scams caught, auto-removals, shill campaigns, repeat offenders, and a community safety score.
- **On-Chain Token Verification** — Automatically extracts contract addresses from posts and verifies them against GoPlus, DexScreener, and Honeypot.is APIs.

### Automated Moderation

- Auto-removal of posts exceeding configured risk threshold
- Modmail alerts with detailed risk reports
- Warning comments on removed posts
- Ban recommendations for serial offenders
- Configurable thresholds per subreddit

### Moderator Menu Actions

| Action | Description |
|--------|-------------|
| **Analyze Post** | Run full analysis on demand |
| **View Risk Report** | See score, flags, AI explanation |
| **Check User Strikes** | View offender history |
| **Remove + Report** | Remove + add warning comment |

---

## Risk Scoring (0–100)

| Score | Level | Automated Action |
|-------|-------|-----------------|
| 0–20 | SAFE | None |
| 21–40 | LOW | Logged |
| 41–60 | MEDIUM | Stored for review |
| 61–80 | HIGH | Modmail alert |
| 81–100 | CRITICAL | Auto-removed + modmail + warning |

---

## Project Structure

```
rugsentry-ai/
├── apps/
│   ├── devvit-app/         # Reddit Devvit app (self-contained)
│   │   ├── src/main.tsx    # All app logic in one file
│   │   ├── devvit.yaml     # App configuration
│   │   └── README.md       # Detailed Devvit app docs
│   └── dashboard/          # React + Vite + TailwindCSS dashboard (future)
├── backend/                # Node.js + Express API (reference implementation)
│   └── src/
│       ├── services/       # TokenAnalysis, ShillDetection, Gemini services
│       ├── analyzers/      # PostAnalyzer orchestrator
│       └── api/            # REST API routes
├── shared/                 # Shared TypeScript types, constants, utils
└── firebase/               # Firestore security rules
```

> **Note:** The Devvit app (`apps/devvit-app/`) is fully self-contained and does not depend on the backend or dashboard. The backend and dashboard are reference implementations for future standalone deployment.

---

## Quick Start

### 1. Install & Deploy the Devvit App

```bash
git clone https://github.com/SKAHLO1/rugsentry-ai
cd rugsentry-ai/apps/devvit-app
npm install
devvit login
devvit upload
```

### 2. Configure API Keys

```bash
# Required: enables AI-powered scam classification
devvit settings set geminiApiKey
# Get a free key at https://aistudio.google.com/apikey

# Optional: higher rate limits for token scanning
devvit settings set goPlusApiKey
```

### 3. Configure Thresholds (per subreddit)

After installing the app on a subreddit, configure via the app settings:
- **Auto-Remove Threshold** (default: 85) — Posts above this score are auto-removed
- **Alert Threshold** (default: 65) — Posts above this trigger modmail alerts

### 4. Test

```bash
devvit playtest r/your_test_subreddit
```

Create a test post with scam-like content to verify detection is working.

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Runtime** | Reddit Devvit SDK (TypeScript) |
| **AI** | Google Gemini 2.5 Flash |
| **On-Chain Intel** | GoPlus Security, DexScreener, Honeypot.is |
| **Storage** | Devvit KV Store |
| **UI** | Devvit Blocks (custom post widgets) |
| **Backend** *(reference)* | Node.js, Express, TypeScript |
| **Dashboard** *(reference)* | React, Vite, TailwindCSS, Recharts |
| **Database** *(reference)* | Firebase Firestore |

---

## External APIs

| API | Purpose | Key Required? |
|-----|---------|--------------|
| [Google Gemini 2.5 Flash](https://ai.google.dev) | AI scam classification | Yes (free tier) |
| [GoPlus Security](https://gopluslabs.io) | Token security analysis | No (optional) |
| [DexScreener](https://dexscreener.com) | Liquidity & market data | No |
| [Honeypot.is](https://honeypot.is) | Honeypot verification | No |

---

## How Detection Works

```
New Post/Comment
     │
     ▼
┌─────────────────────┐
│  Entity Extraction   │  Extract contract addresses, token symbols,
│                      │  DexScreener/Pump.fun/Telegram links
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
┌──────────┐ ┌──────────────┐
│ Pattern  │ │  On-Chain     │  GoPlus: honeypot, mint, blacklist, taxes
│ Matching │ │  Token Scan   │  DexScreener: liquidity, price
│          │ │               │  Honeypot.is: honeypot verification
└────┬─────┘ └──────┬───────┘
     │               │
     └───────┬───────┘
             ▼
     ┌───────────────┐
     │  Gemini AI     │  Contextual scam classification
     │  Classification│  with confidence scoring
     └───────┬───────┘
             ▼
     ┌───────────────┐
     │  Shill Check   │  Cross-reference with recent
     │  + Offender    │  token mentions & user strikes
     │  Tracking      │
     └───────┬───────┘
             ▼
     ┌───────────────┐
     │  Risk Score    │  0-100 score → SAFE/LOW/MEDIUM/HIGH/CRITICAL
     │  + Actions     │  → auto-remove, modmail, warning, ban suggest
     └───────────────┘
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-detection`)
3. Make your changes
4. Test with `devvit playtest`
5. Submit a pull request

---

## License

MIT

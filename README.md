# ♞ Chess Move Advisor

A Chrome/Edge (Manifest V3) extension that reads live games on **chess.com** and **lichess.org** straight from the page DOM and suggests the next move using **Stockfish 18 running locally in WebAssembly** — no accounts, no cloud engine, no network calls for analysis.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue) ![Engine](https://img.shields.io/badge/Engine-Stockfish%2018-green) ![Privacy](https://img.shields.io/badge/Analysis-100%25%20local-brightgreen)

---

## ✨ Features

| Feature | Details |
|---|---|
| 🔍 Live board reading | Site-specific DOM adapters for chess.com and lichess.org, all exposing `getFEN() / getMoveHistory() / getSideToMove() / isMyTurn()` |
| ⚡ Real-time updates | `MutationObserver`-driven detection of new moves — no polling loops |
| 🧠 Local grandmaster | Stockfish 18 (lite, NNUE neural-net eval) bundled as WASM, run in an offscreen-document Web Worker |
| 🏹 On-board arrows | SVG overlay in the board's own coordinate system, up to 3 ranked candidate lines |
| 📊 Eval panel | Move in SAN plus centipawn or mate score, shown only on your turn |
| 🎛️ Popup settings | Per-site toggles, depth slider, 1–3 lines, eval on/off, max think-time cap |
| 🛟 Graceful fallback | If the WASM engine is ever blocked, a built-in local search still returns legal moves |

---

## 🚀 Installation (load unpacked)

1. **Vendor the engine** (one time — downloads ~7 MB into `engine/`):
   ```sh
   sh engine/download-stockfish.sh
   ```
2. Open `chrome://extensions` (or `edge://extensions` / `brave://extensions`).
3. Enable **Developer mode** (top-right corner).
4. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
5. Pin **Chess Move Advisor** to the toolbar.

> The engine files (`engine/stockfish.js`, `engine/stockfish.wasm`) are git-ignored on purpose — every install vendors its own copy with the script above.

---

## 🎮 Usage

1. Open a game on chess.com or lichess.org.
2. Click the extension icon and confirm your site is enabled.
3. When it's **your turn**, a green arrow appears on the board and a small panel shows e.g.:
   ```
   Top moves
   1. Nf3 (+0.35)
   ```
4. Tune to taste (see Settings). For fast time controls, lower depth and think time.

---

## 🎛️ Settings

| Setting | Default | Effect |
|---|---|---|
| Enable on chess.com / lichess.org | on / on | Independent per-site kill switches |
| Depth | 12 | Search-depth ceiling (5–25) |
| Max think | 3 s | Hard time cap per move, sent as UCI `movetime` (1–10 s) |
| Lines | 1 | Candidate moves shown and drawn (1–3) |
| Show evaluation | on | SAN + score vs. move text only |

Recommended presets: **Blitz** — depth 10, think 1–2 s · **Rapid** — depth 12, think 3 s · **Deep analysis** — depth 20+, think 10 s.

---

## 🏗️ How it works

```
chess.com / lichess.org DOM
        │  MutationObserver + site adapter (FEN/SAN/turn)
        ▼
content script ──ANALYZE {fen, depth, multiPV, maxTime}──▶ service worker
        ▲                                                      │ offscreen doc
        │                        Stockfish 18 WASM ◀── UCI ────┘ (Web Worker)
        └── bestmove + scores ── SVG arrow + eval panel (your turn only)
```

Key design decisions:

- **Offscreen document, not background worker** — MV3 service workers cannot spawn `new Worker()`, and page CSPs can block workers created from content scripts. The offscreen document is extension-owned, so Stockfish always starts.
- **Engine warmup on load** — WASM compile plus a throwaway `go depth 10` happens at startup, so the first real move doesn't pay cold-start cost mid-game.
- **Time-bounded search** — `movetime` caps guarantee an answer in seconds; depth acts as a ceiling.
- **No external calls** — after vendoring, analysis is fully offline. Nothing leaves the browser.

---

## 📁 Project structure

```
├── manifest.json                  MV3 manifest (activeTab, scripting, storage, offscreen)
├── background/service-worker.js   Forwards ANALYZE → offscreen engine doc
├── offscreen/                     Extension-owned Stockfish host (UCI, warmup, queue)
├── content-scripts/
│   ├── chesscom-adapter.js        chess.com DOM → FEN/history/turn
│   ├── lichess-adapter.js         lichess.org DOM → FEN/history/turn
│   ├── common.js                  Overlay, panel, settings helpers
│   └── content.js                 Orchestrator + local-search fallback
├── engine/
│   ├── stockfish.js / .wasm       Vendored Stockfish 18 (git-ignored, see script)
│   ├── download-stockfish.sh      One-command vendor script
│   └── engine-worker-client.js    In-page UCI client (legacy/alternate path)
├── popup/                         Settings UI + last-suggestion readout
└── lib/chess.js                   Bundled move-legality / FEN / SAN library
```

---

## 🩺 Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `Extension context invalidated` in console | Reloaded extension with old script in tab → **hard-refresh** the game tab (`Cmd/Ctrl+Shift+R`) |
| `Engine error: worker construction failed` (old versions) | Fixed by the offscreen architecture — reload the extension to pick it up |
| Stuck on `Analyzing…` > ~15 s | Cold WASM start (one-time) or wedged engine → wait for the automatic basic-engine fallback, then check `brave/chrome://extensions` → Inspect views for red lines |
| `(engine still thinking…)` never upgrades | Stockfish blocked in your browser → paste the `[CMA]` console line when reporting |
| No arrow, panel says `Waiting for opponent…` | Working as intended — suggestions render on your turn only |
| Wrong squares highlighted | Site changed its DOM → the adapter selectors need updating (see Contributing) |

---

## 🤝 Contributing

1. Keep adapters isolated: all site-specific selectors live in `*-adapter.js`, behind the shared interface.
2. Run `node --check` on every JS file you touch.
3. Test on both sites (a bot game is the fastest harness).
4. Never add network calls to the analysis path — local-only is a core guarantee.

---

## ⚖️ Fair play & privacy

- **Privacy:** no analytics, no accounts, no data collection. Positions are analyzed in-process and never transmitted anywhere.
- **Fair play:** engine assistance during rated games against humans violates chess.com's and lichess.org's terms and **will get your account banned**. Use this tool against bots, in casual/unrated games, for post-game review, or where assistance is explicitly allowed.

---

## 📄 License

GPL-3.0 — see [LICENSE](LICENSE). Stockfish itself is © the Stockfish team, GPLv3; the `stockfish.js` WASM build is © Nathan Rugg / Chess.com, GPLv3.

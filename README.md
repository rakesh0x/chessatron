<p align="center">
  <img src="assets/logo.svg" width="160" alt="Chessatron logo">
</p>

<h1 align="center">Chessatron</h1>

<p align="center">
  Live move suggestions for chess.com and lichess.org, powered by a locally-run Stockfish 18 engine.
  <br>
  No accounts. No cloud. No data leaves the browser.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Engine-Stockfish%2018-green" alt="Stockfish 18">
  <img src="https://img.shields.io/badge/Analysis-100%25%20local-brightgreen" alt="Local analysis">
  <img src="https://img.shields.io/badge/License-GPL--3.0-lightgrey" alt="GPL-3.0">
</p>

---

## Overview

Chessatron is a Chrome/Edge/Brave extension (Manifest V3) that reads an in-progress game directly from the page DOM and overlays the engine's recommended move on the board in real time. Analysis is performed entirely on-device by Stockfish 18 compiled to WebAssembly.

## Features

- **Live board reading** — dedicated DOM adapters for chess.com and lichess.org behind a common interface (`getFEN`, `getMoveHistory`, `getSideToMove`, `isMyTurn`).
- **Real-time updates** — board changes are detected with `MutationObserver`; suggestions refresh automatically on your turn.
- **Local Stockfish 18** — bundled WASM build with NNUE neural-network evaluation, executed in an offscreen-document Web Worker.
- **On-board move arrows** — SVG overlay in the board's coordinate system with support for 1–3 ranked candidate lines.
- **Evaluation panel** — suggested move in standard algebraic notation with centipawn or mate score.
- **Configurable** — per-site toggles, search depth, candidate count, evaluation display, and a hard per-move think-time cap.
- **Offline fallback** — if the WASM engine is ever unavailable, a built-in local search still returns legal moves.

## Installation

**Prerequisites:** a Chromium-based browser (Chrome, Edge, or Brave) and ~10 MB of disk space for the vendored engine.

1. Clone the repository:
   ```sh
   git clone https://github.com/rakesh0x/chessatron.git
   cd chessatron
   ```
2. Vendor the engine (one-time download into `engine/`):
   ```sh
   sh engine/download-stockfish.sh
   ```
3. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`) and enable **Developer mode**.
4. Click **Load unpacked** and select the repository folder (the one containing `manifest.json`).
5. Pin **Chessatron** to the toolbar.

## Usage

1. Open a game on chess.com or lichess.org.
2. Open the Chessatron popup and confirm the site is enabled.
3. When it is your turn, an arrow appears on the board and a panel displays the recommendation, for example:
   ```
   Top moves
   1. Nf3 (+0.35)
   ```

### Recommended settings

| Time control | Depth | Max think | Notes |
|---|---|---|---|
| Blitz / Bullet | 10 | 1–2 s | Prioritizes speed; still far above human level |
| Rapid (10 min) | 12 | 2–3 s | Balanced default |
| Deep analysis | 20+ | 10 s | Use with unlimited time; slow but strongest |

## Configuration reference

| Setting | Default | Description |
|---|---|---|
| Enable on chess.com | On | Master switch for chess.com pages |
| Enable on lichess.org | On | Master switch for lichess.org pages |
| Depth | 12 | Search-depth ceiling (5–25) |
| Max think | 3 s | Hard per-move time cap, enforced via UCI `movetime` (1–10 s) |
| Lines | 1 | Candidate moves displayed and drawn (1–3) |
| Show evaluation | On | Show score alongside the move, or move text only |

## Architecture

```
chess.com / lichess.org DOM
        |  MutationObserver + site adapter (FEN / history / side to move)
        v
content script --- ANALYZE { fen, depth, multiPV, maxTime } ---> service worker
        ^                                                              |
        |                          Stockfish 18 WASM <--- UCI ---- offscreen document
        +---------------- bestmove + scores: SVG arrow + eval panel (own turn only)
```

Design notes:

- **Offscreen engine host.** MV3 service workers cannot construct `Worker` instances, and strict page content-security policies can block workers created from content scripts. Hosting Stockfish in an extension-owned offscreen document avoids both problems.
- **Startup warmup.** WASM compilation plus a throwaway search run at load, so the first real analysis does not pay cold-start latency mid-game.
- **Time-bounded search.** The think-time cap guarantees a response within seconds; depth serves as a ceiling rather than a target.
- **Local-only analysis path.** Once vendored, the engine requires no network access. No position data is transmitted anywhere.

## Project structure

```
manifest.json                  MV3 manifest and permissions
assets/                        Logo and extension icons
background/service-worker.js   Message relay: content script to engine host
offscreen/                     Extension-owned Stockfish host (UCI protocol, warmup, queue)
content-scripts/
  chesscom-adapter.js          chess.com DOM adapter
  lichess-adapter.js           lichess.org DOM adapter
  common.js                    Overlay, panel, and settings helpers
  content.js                   Orchestrator, watchdog, and local-search fallback
engine/
  stockfish.js / stockfish.wasm  Vendored Stockfish 18 (git-ignored; see script)
  download-stockfish.sh        One-command engine vendor script
  engine-worker-client.js      In-page UCI client (alternate path)
popup/                         Settings UI and last-suggestion readout
lib/chess.js                   Bundled legality, FEN, and SAN library
```

## Troubleshooting

| Symptom | Resolution |
|---|---|
| `Extension context invalidated` in the console | The extension was reloaded while the tab held the old content script. Hard-refresh the game tab (`Cmd/Ctrl+Shift+R`). |
| Panel stuck on `Analyzing...` | Cold WASM start (one-time, ~10 s) or a busy engine. The automatic fallback appears after the think-time window; check `chrome://extensions` → Inspect views for errors if it never resolves. |
| `(engine still thinking...)` never upgrades | Stockfish is blocked in this browser profile. Open an issue with the `[CMA]` console lines. |
| `Waiting for opponent...` permanently | Expected behavior — suggestions render only when it is your turn. |
| Misaligned or missing arrows | The site likely changed its DOM. Adapter selectors in `content-scripts/*-adapter.js` need updating. |

## Contributing

1. Keep all site-specific selectors inside the adapter files, behind the shared interface.
2. Validate with `node --check` on every JavaScript file touched.
3. Test against a bot game on both supported sites before submitting.
4. Do not introduce network calls into the analysis path — local-only operation is a core guarantee.

## Fair play and privacy

- **Privacy.** No analytics, no accounts, no telemetry. Positions are evaluated in-process and never leave the machine.
- **Fair play.** Engine assistance during rated games against human opponents violates the terms of chess.com and lichess.org and will result in account closure. Use Chessatron against bots, in casual or unrated games, for post-game review, or wherever assistance is explicitly permitted.

## License

GPL-3.0 — see [LICENSE](LICENSE). Stockfish is copyright the Stockfish team (GPLv3); the WebAssembly build is copyright Nathan Rugg / Chess.com, LLC (GPLv3).

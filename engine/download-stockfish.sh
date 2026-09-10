#!/bin/sh
# Vendors Stockfish 18 (lite single-threaded WASM, ~7MB, NNUE neural net,
# no special browser headers needed) into engine/ for fully local analysis.
# Run: sh engine/download-stockfish.sh
set -e
cd "$(dirname "$0")"
VER="18.0.8"
BASE="https://unpkg.com/stockfish@${VER}/bin"
curl -L "$BASE/stockfish-18-lite-single.js" -o stockfish.js
curl -L "$BASE/stockfish-18-lite-single.wasm" -o stockfish.wasm
echo "Done. engine/ now contains local Stockfish 18 (lite single)."

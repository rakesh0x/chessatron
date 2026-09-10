// Offscreen document: hosts the Stockfish Worker (allowed here,unlike content scripts
// on pages with strict CSP) and answers OFFSCREEN_ANALYZE messages.
let seq = 0;
const pending = new Map();
let ready = false;
const queue = [];
let current = null;
const worker = new Worker(chrome.runtime.getURL('engine/stockfish.js'));
worker.onmessage = (e) => onLine(String(e.data));
worker.onerror = (e) => failAll(new Error('stockfish worker error'));
worker.postMessage('uci');
setTimeout(() => { ready = true; pump(); }, 4000);

let warmedUp = false;
function onLine(line) {
  if (/^uciok|^readyok/.test(line)) {
    ready = true;
    if (!warmedUp) {
      // One-time warmup: compile WASM + warm hash now so the first real
      // move doesn't pay the cold-start cost mid-game.
      warmedUp = true;
      try {
        worker.postMessage('position startpos moves e2e4 e7e5');
        worker.postMessage('go depth 10');
      } catch (e) {}
    }
    pump(); return;
  }
  const info = line.match(/info depth (\d+).*?multipv (\d+).*?score (cp (-?\d+)|mate (-?\d+)).*? pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
  if (info && current) {
    const cp = info[4] !== undefined ? parseInt(info[4], 10) : null;
    const mate = info[5] !== undefined ? parseInt(info[5], 10) : null;
    current.map.set(+info[2], {
      uci: info[6], san: info[6],
      cp: mate != null ? null : (current.turn === 'w' ? cp : -cp),
      mate
    });
    return;
  }
  const bm = line.match(/^bestmove (\S+)/);
  if (bm && current) {
    const done = current; current = null;
    const out = done.map.size
      ? [...done.map.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
      : [{ uci: bm[1], san: bm[1], cp: 0, mate: null }];
    const p = pending.get(done.id);
    if (p) { pending.delete(done.id); clearTimeout(p.timer); p.res(out); }
    pump();
  }
}
function pump() {
  if (!ready || current || !queue.length) return;
  const { id, fen, depth, multiPV, maxTime } = queue.shift();
  current = { id, turn: (fen.split(' ')[1] || 'w'), map: new Map() };
  worker.postMessage('setoption name MultiPV value ' + Math.min(3, Math.max(1, multiPV)));
  worker.postMessage('position fen ' + fen);
  // Time cap keeps answers fast: whichever limit hits first wins.
  worker.postMessage('go depth ' + Math.min(30, Math.max(1, depth)) + ' movetime ' + (Math.min(30, Math.max(1, maxTime)) * 1000));
}
function failAll(err) {
  for (const [, p] of pending) { clearTimeout(p.timer); p.rej(err); }
  pending.clear();
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'OFFSCREEN_ANALYZE') {
    const id = ++seq;
    new Promise((res, rej) => {
      pending.set(id, { res, rej, timer: setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          queue.splice(0, queue.length, ...queue.filter(q => q.id !== id));
          if (current && current.id === id) { current = null; pump(); }
          rej(new Error('engine timeout'));
        }
      }, Math.max(25000, (msg.depth || 15) * 3000)) });
      queue.push({ id, fen: msg.fen, depth: msg.depth || 12, multiPV: msg.multiPV || 1, maxTime: msg.maxTime || 3 });
      pump();
    }).then(lines => sendResponse({ ok: true, lines }))
      .catch(err => sendResponse({ ok: false, error: String(err && err.message || err) }));
    return true;
  }
  return false;
});

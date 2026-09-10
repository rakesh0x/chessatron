// UCI client (runs in the CONTENT script, not the service worker).
// MV3 service workers cannot construct `new Worker()`, so the engine lives here:
// we spawn the bundled niklasf Stockfish build directly as a Worker and speak UCI.
class EngineClient {
  constructor() {
    this.seq = 0; this.pending = new Map(); this.ready = false;
    this.queue = []; this.current = null;
    const url = chrome.runtime.getURL('engine/stockfish.js');
    this.worker = new Worker(url);
    this.worker.onmessage = (e) => this._onLine(String(e.data));
    this.worker.onerror = (e) => {
      for (const [, p] of this.pending) p.rej(new Error('engine worker error'));
      this.pending.clear();
    };
    this.worker.postMessage('uci');
    // Unblock even if uciok is missed.
    setTimeout(() => { this.ready = true; this._pump(); }, 4000);
  }
  _onLine(line) {
    if (/^uciok|^readyok/.test(line)) { this.ready = true; this._pump(); return; }
    const info = line.match(/info depth (\d+).*?multipv (\d+).*?score (cp (-?\d+)|mate (-?\d+)).*? pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
    if (info && this.current) {
      const cp = info[4] !== undefined ? parseInt(info[4], 10) : null;
      const mate = info[5] !== undefined ? parseInt(info[5], 10) : null;
      this.current.map.set(+info[2], {
        uci: info[6], san: info[6],
        cp: mate != null ? null : (this.current.turn === 'w' ? cp : -cp),
        mate
      });
      return;
    }
    const bm = line.match(/^bestmove (\S+)/);
    if (bm && this.current) {
      const done = this.current; this.current = null;
      const out = done.map.size
        ? [...done.map.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
        : [{ uci: bm[1], san: bm[1], cp: 0, mate: null }];
      const p = this.pending.get(done.id);
      if (p) { this.pending.delete(done.id); p.res(out); }
      this._pump();
    }
  }
  _pump() {
    if (!this.ready || this.current || !this.queue.length) return;
    const { id, fen, depth, multiPV } = this.queue.shift();
    this.current = { id, turn: (fen.split(' ')[1] || 'w'), map: new Map() };
    this.worker.postMessage('setoption name MultiPV value ' + Math.min(3, Math.max(1, multiPV)));
    this.worker.postMessage('position fen ' + fen);
    this.worker.postMessage('go depth ' + Math.min(30, Math.max(1, depth)));
  }
  analyze(fen, depth, multiPV) {
    return new Promise((res, rej) => {
      const id = ++this.seq;
      this.pending.set(id, { res, rej });
      this.queue.push({ id, fen, depth: depth || 15, multiPV: multiPV || 1 });
      this._pump();
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          this.queue = this.queue.filter(q => q.id !== id);
          if (this.current && this.current.id === id) { this.current = null; this._pump(); }
          rej(new Error('engine timeout'));
        }
      }, Math.max(20000, (depth || 15) * 3000));
    });
  }
}

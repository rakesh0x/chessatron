// Shared helpers: settings, overlay, panel.
const CMA = (() => {
  const DEFAULTS = { enabledChessCom: true, enabledLichess: true, depth: 12, multiPV: 1, showEval: true, maxTime: 3 };
  async function getSettings() {
    return new Promise(res => chrome.storage.sync.get(DEFAULTS, res));
  }
  function onSettings(cb) { chrome.storage.onChanged.addListener((c, a) => { if (a === 'sync') cb(c); }); }
  function ensureUI() {
    let ov = document.getElementById('cma-arrow-layer');
    if (!ov) {
      ov = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      ov.id = 'cma-arrow-layer';
      ov.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:visible;');
      ov.setAttribute('viewBox', '0 0 8 8');
    }
    let panel = document.getElementById('cma-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'cma-panel';
      panel.setAttribute('style', 'position:fixed;top:10px;right:10px;z-index:10000;background:#111;color:#fff;font:12px/1.4 system-ui;padding:8px 10px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.4);max-width:230px;');
      document.body.appendChild(panel);
    }
    return { ov, panel };
  }
  function attachOverlay(boardEl) {
    const { ov } = ensureUI();
    if (ov.parentElement !== boardEl) {
      const cs = getComputedStyle(boardEl);
      if (cs.position === 'static') boardEl.style.position = 'relative';
      boardEl.appendChild(ov);
    }
    return ov;
  }
  function squareXY(sqStr, flipped) {
    const f = sqStr.charCodeAt(0) - 97, r = +sqStr[1] - 1;
    const x = flipped ? 7 - f : f, y = flipped ? r : 7 - r;
    return { x: x + 0.5, y: y + 0.5 };
  }
  function drawArrows(ov, moves, flipped) {
    while (ov.firstChild) ov.removeChild(ov.firstChild);
    const colors = ['#22c55e', '#3b82f6', '#f59e0b'];
    moves.forEach((m, i) => {
      const uci = m.uci || m.move; if (!uci || uci.length < 4) return;
      const a = squareXY(uci.slice(0, 2), flipped), b = squareXY(uci.slice(2, 4), flipped);
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const t = { x: b.x - (dx / len) * 0.28, y: b.y - (dy / len) * 0.28 };
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('opacity', String(1 - i * 0.25));
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', t.x); line.setAttribute('y2', t.y);
      line.setAttribute('stroke', colors[i % 3]); line.setAttribute('stroke-width', '0.22');
      line.setAttribute('stroke-linecap', 'round');
      const hl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const ang = Math.atan2(dy, dx);
      const s = 0.26;
      const p1 = `${b.x},${b.y}`;
      const p2 = `${b.x - s * Math.cos(ang - 0.42)},${b.y - s * Math.sin(ang - 0.42)}`;
      const p3 = `${b.x - s * Math.cos(ang + 0.42)},${b.y - s * Math.sin(ang + 0.42)}`;
      hl.setAttribute('points', `${p1} ${p2} ${p3}`);
      hl.setAttribute('fill', colors[i % 3]);
      g.appendChild(line); g.appendChild(hl); ov.appendChild(g);
    });
  }
  function fmtScore(m, showEval) {
    if (m.mate != null) return `#${m.mate}`;
    if (!showEval) return m.san || m.uci;
    const pawns = ((m.cp || 0) / 100).toFixed(2);
    return `${m.san || m.uci} (${(m.cp >= 0 ? '+' : '') + pawns})`;
  }
  return { DEFAULTS, getSettings, onSettings, ensureUI, attachOverlay, drawArrows, fmtScore };
})();

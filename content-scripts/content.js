// Content orchestrator: pick adapter, observe DOM, request analysis, render overlay.
(() => {
  const host = location.hostname;
  const adapter = host.includes('lichess') ? LichessAdapter : ChessComAdapter;
  const siteKey = host.includes('lichess') ? 'enabledLichess' : 'enabledChessCom';
  let settings = { ...CMA.DEFAULTS };
  let lastFEN = '', debounce = null;
  let engine = null;
  function getEngine() { if (!engine) { try { engine = new EngineClient(); } catch (e) { engine = null; } } return engine; }

  async function refreshSettings() { settings = await CMA.getSettings(); }
  chrome.storage.onChanged.addListener(() => refreshSettings().then(maybeAnalyze));

  function boardRoot() { return (adapter.getBoardEl && adapter.getBoardEl()) || adapter.boardEl(); }

  async function maybeAnalyze() {
    await refreshSettings();
    if (!settings[siteKey]) { clearUI('Disabled for this site (see popup).'); return; }
    let fen = null;
    try { fen = adapter.getFEN(); } catch (e) { /* ignore */ }
    if (!fen || fen === lastFEN) return;
    lastFEN = fen;
    const board = boardRoot();
    if (!board) return;
    CMA.attachOverlay(board);
    if (!adapter.isMyTurn()) { showStatus('Waiting for opponent…'); return; }
    showStatus('Analyzing…');
    let settled = false;
    const watchdog = setTimeout(() => {
      if (settled || lastFEN !== fen) return;
      try { render(fallbackSuggest(fen, settings.multiPV), true, ' (engine still thinking…)'); } catch (e) {}
    }, 12000);
    try {
      const res = await chrome.runtime.sendMessage({ type: 'ANALYZE', fen, depth: settings.depth, multiPV: settings.multiPV, maxTime: settings.maxTime });
      settled = true; clearTimeout(watchdog);
      if (lastFEN !== fen) return; // board moved on while we thought
      if (!res || !res.ok) throw new Error((res && res.error) || 'engine error');
      render(res.lines, false);
    } catch (e) {
      // Stockfish unavailable (CSP/worker blocked?) — fall back to local search
      // using bundled chess.js so the user still gets a (weaker) suggestion.
      console.warn('[CMA] stockfish failed, using fallback:', e);
      try {
        render(fallbackSuggest(fen, settings.multiPV), true);
      } catch (e2) { showStatus('Engine error: ' + ((e && e.message) || e)); }
    }
  }
  function schedule() { clearTimeout(debounce); debounce = setTimeout(maybeAnalyze, 600); }

  function render(lines, isFallback, suffix) {
    const board = boardRoot(); if (!board) return;
    const ov = CMA.attachOverlay(board);
    CMA.drawArrows(ov, lines, adapter.flipped());
    const { panel } = CMA.ensureUI();
    panel.innerHTML = (isFallback ? '<b>Top moves (basic engine — stockfish blocked)</b><br>'
      : '<b>Top moves</b><br>') + lines.map((m, i) =>
      `${i + 1}. ${CMA.fmtScore(m, settings.showEval)}`).join('<br>') + (suffix || '');
  }
  // Tiny local negamax (depth 2) over chess.js legal moves. Weak but legal.
  function fallbackSuggest(fen, multiPV) {
    const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
    const root = new Chess(fen);
    const side = root.turnColor();
    function evalBoard(c) {
      let s = 0;
      const place = c.fen().split(' ')[0];
      for (const ch of place) {
        if (ch === '/' || /\d/.test(ch)) continue;
        const v = VAL[ch.toLowerCase()] || 0;
        s += ch === ch.toUpperCase() ? v : -v;
      }
      return side === 'w' ? s : -s;
    }
    function search(c, depth, alpha, beta) {
      const legal = c.moves({ verbose: true });
      if (depth === 0 || !legal.length) {
        if (!legal.length) {
          // checkmate or stalemate: detect check via king capture test is complex;
          // use eval with mate bonus heuristic
          return { score: evalBoard(c), best: null };
        }
        return { score: evalBoard(c), best: null };
      }
      let best = null, bestScore = -Infinity;
      for (const m of legal) {
        const c2 = new Chess(c.fen());
        c2.move({ from: m.from, to: m.to });
        const r = search(c2, depth - 1, -beta, -alpha);
        const s = -r.score;
        if (s > bestScore) { bestScore = s; best = m; }
        if (s > alpha) alpha = s;
        if (alpha >= beta) break;
      }
      return { score: bestScore, best };
    }
    const sans = root.moves();
    const verbose = root.moves({ verbose: true });
    const scored = [];
    for (let i = 0; i < verbose.length; i++) {
      const m = verbose[i];
      const c2 = new Chess(fen);
      c2.move({ from: m.from, to: m.to });
      const r = search(c2, 1, -Infinity, Infinity);
      scored.push({ m, san: sans[i], score: -r.score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, Math.min(3, Math.max(1, multiPV))).map(s => {
      const uci = Chess.sqToAlg(s.m.from) + Chess.sqToAlg(s.m.to) + (s.m.promo || '');
      return { uci, san: s.san, cp: Math.round(s.score), mate: null };
    });
  }
  function showStatus(t) { CMA.ensureUI().panel.textContent = t; }
  function clearUI(t) {
    const ov = document.getElementById('cma-arrow-layer');
    if (ov) while (ov.firstChild) ov.removeChild(ov.firstChild);
    if (t) showStatus(t);
  }

  chrome.runtime.onMessage.addListener((m, s, r) => { if (m && m.type === 'GET_LAST') r({ text: CMA.ensureUI().panel.textContent || '' }); });
  function observe() {
    const root = document.body;    const mo = new MutationObserver(() => schedule());
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
  }
  refreshSettings().then(() => { observe(); schedule(); setInterval(() => { try { const f = adapter.getFEN(); if (f && f !== lastFEN) maybeAnalyze(); } catch (e) {} }, 3000); });
})();

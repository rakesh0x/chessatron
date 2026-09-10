// lichess.org adapter. Board: <cg-board> with <piece class="white pawn" style="transform: translate(...)"> or square coords.
const LichessAdapter = (() => {
  function boardEl() { return document.querySelector('cg-board'); }
  function flipped() { const cg = document.querySelector('cg-container.orientation-black, .orientation-black cg-board'); return !!cg; }
  function coordToSq(transform, sizeFallback) {
    // lichess positions pieces via transform: translate(x px, y px); map to file/rank via board size
    return null; // handled below via square attribute when available
  }
  function readPieces() {
    const b = boardEl(); if (!b) return null;
    const rect = b.getBoundingClientRect(); if (!rect.width) return null;
    const cell = rect.width / 8, flip = flipped();
    const grid = new Array(64).fill(null);
    b.querySelectorAll('piece').forEach(el => {
      const cls = el.className || '';
      const cm = cls.match(/(white|black)/), tm = cls.match(/(pawn|knight|bishop|rook|queen|king)/);
      if (!cm || !tm) return;
      const map = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
      let f, r;
      const sqAttr = el.getAttribute('cgSquare') || el.getAttribute('data-square');
      if (sqAttr && /^[a-h][1-8]$/.test(sqAttr)) { f = sqAttr.charCodeAt(0) - 97; r = +sqAttr[1] - 1; }
      else {
        // parse translate from style or computed transform matrix
        const st = el.style.transform || getComputedStyle(el).transform || '';
        const m = st.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([-\d.]+),\s*([-\d.]+)\)/) || st.match(/translate\(\s*([-\d.]+)px,?\s*([-\d.]+)px/);
        if (!m) return;
        let px = parseFloat(m[1]), py = parseFloat(m[2]);
        let col = Math.round(px / cell), row = Math.round(py / cell);
        f = flip ? 7 - col : col; r = flip ? row : 7 - row;
        if (f < 0 || f > 7 || r < 0 || r > 7) return;
      }
      grid[r * 8 + f] = { t: map[tm[1]], c: cm[1][0] };
    });
    return grid;
  }
  function gridToPlacement(grid) {
    const rows = [];
    for (let r = 7; r >= 0; r--) { let s = '', e = 0;
      for (let f = 0; f < 8; f++) { const p = grid[r * 8 + f];
        if (!p) e++; else { if (e) { s += e; e = 0; } s += p.c === 'w' ? p.t.toUpperCase() : p.t; } }
      if (e) s += e; rows.push(s); }
    return rows.join('/');
  }
  function moveList() {
    const sans = [];
    document.querySelectorAll('moves move, .moves move, move').forEach(m => {
      const t = (m.textContent || '').trim();
      if (t && !/^\d/.test(t)) sans.push(t.split(' ')[0]);
    });
    if (!sans.length) {
      document.querySelectorAll('.moves, moves').forEach(box => {
        (box.textContent || '').replace(/\d+\./g, ' ').split(/\s+/).forEach(tok => {
          if (/^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?$|^O-O(-O)?[+#]?$/.test(tok)) sans.push(tok);
        });
      });
    }
    return sans;
  }
  function buildFEN() {
    const grid = readPieces(); if (!grid) return null;
    const c = new Chess();
    for (const s of moveList()) { try { if (!c.move(s)) break; } catch (e) { break; } }
    const base = c.fen().split(' ');
    return `${gridToPlacement(grid)} ${base[1]} ${base[2]} ${base[3]} ${base[4]} ${base[5]}`;
  }
  function sideToMove() { const f = buildFEN(); return f ? f.split(' ')[1] : 'w'; }
  function myColor() {
    if (document.querySelector('.orientation-black')) return 'b';
    if (document.querySelector('.orientation-white')) return 'w';
    return flipped() ? 'b' : 'w';
  }
  return { site: 'lichess', boardEl, flipped, getFEN: buildFEN, getMoveHistory: moveList, getSideToMove: sideToMove, isMyTurn: () => sideToMove() === myColor(), getBoardEl: boardEl };
})();

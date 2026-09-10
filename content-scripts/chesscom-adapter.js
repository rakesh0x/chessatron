// chess.com adapter. Board pieces are divs with class like "piece wp square-55" inside wc-chess-board / chess-board.
const ChessComAdapter = (() => {
  const PIECE = { p: 'p', n: 'n', b: 'b', r: 'r', q: 'q', k: 'k' };
  function boardEl() { return document.querySelector('wc-chess-board') || document.querySelector('chess-board'); }
  function flipped() {
    const b = boardEl(); if (!b) return false;
    return b.classList.contains('flipped') || !!document.querySelector('.board-flipped');
  }
  function readPieces() {
    const b = boardEl(); if (!b) return null;
    const grid = new Array(64).fill(null);
    // chess.com squares are numbered square-11 (a1) .. square-88 (h8)
    b.querySelectorAll('.piece').forEach(el => {
      let sqNum = null;
      for (const c of el.classList) { const m = c.match(/^square-(\d)(\d)$/); if (m) { sqNum = { f: +m[1] - 1, r: +m[2] - 1 }; break; } }
      if (!sqNum) return;
      let color = null, type = null;
      for (const c of el.classList) { const m = c.match(/^([wb])([pnbrqk])$/); if (m) { color = m[1]; type = m[2]; break; } }
      if (color && type) grid[sqNum.r * 8 + sqNum.f] = { t: type, c: color };
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
    // parse move list from DOM text nodes
    const nodes = [...document.querySelectorAll('.move, [data-ply], .node, chess-move-list .move-text')];
    const sans = [];
    nodes.forEach(n => {
      const t = (n.textContent || '').trim().split(/\s+/);
      t.forEach(tok => { if (/^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?$|^O-O(-O)?[+#]?$/.test(tok)) sans.push(tok); });
    });
    // fallback: vertical move list
    if (!sans.length) {
      document.querySelectorAll('.vertical-move-list, .moves').forEach(box => {
        (box.textContent || '').replace(/\d+\./g, ' ').split(/\s+/).forEach(tok => {
          if (/^[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?$|^O-O(-O)?[+#]?$/.test(tok)) sans.push(tok);
        });
      });
    }
    return sans;
  }
  function buildFEN() {
    const grid = readPieces(); if (!grid) return null;
    const sans = moveList();
    // Reconstruct full state (castling/ep/counters) by replaying SANs on a fresh game,
    // then overwrite piece placement with live DOM grid to stay in sync.
    const c = new Chess();
    for (const s of sans) { try { if (!c.move(s)) break; } catch (e) { break; } }
    const base = c.fen().split(' ');
    return `${gridToPlacement(grid)} ${base[1]} ${base[2]} ${base[3]} ${base[4]} ${base[5]}`;
  }
  function sideToMove() { const fen = buildFEN(); return fen ? fen.split(' ')[1] : 'w'; }
  function myColor() {
    // bottom clock / player row heuristic
    const b = boardEl();
    if (b && b.classList.contains('flipped')) return 'b';
    const tag = document.querySelector('.clock-bottom, .player-bottom, [data-cy="player-bottom"]');
    if (tag && /black/i.test(tag.textContent || '')) return 'b';
    return flipped() ? 'b' : 'w';
  }
  return {
    site: 'chesscom', boardEl, flipped,
    getFEN: buildFEN, getMoveHistory: moveList, getSideToMove: sideToMove,
    isMyTurn: () => sideToMove() === myColor(),
    getBoardEl: boardEl
  };
})();

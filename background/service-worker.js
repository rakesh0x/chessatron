// Background service worker: owns the offscreen Stockfish document,
// forwards ANALYZE from content scripts to it.
async function ensureOffscreen() {
  if (!chrome.offscreen || !chrome.offscreen.hasDocument) return;
  try {
    if (await chrome.offscreen.hasDocument()) return;
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Run the bundled local Stockfish engine for move analysis'
    });
  } catch (e) { console.warn('[CMA] offscreen setup failed:', e); }
}
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'ANALYZE') {
    (async () => {
      await ensureOffscreen();
      try {
        const res = await chrome.runtime.sendMessage({
          type: 'OFFSCREEN_ANALYZE', fen: msg.fen, depth: msg.depth, multiPV: msg.multiPV, maxTime: msg.maxTime
        });
        sendResponse(res || { ok: false, error: 'no engine response' });
      } catch (e) { sendResponse({ ok: false, error: String((e && e.message) || e) }); }
    })();
    return true;
  }
  return false;
});

const $ = id => document.getElementById(id);
const DEF = { enabledChessCom: true, enabledLichess: true, depth: 12, multiPV: 1, showEval: true, maxTime: 3 };
chrome.storage.sync.get(DEF, s => {
  $('enCC').checked = s.enabledChessCom; $('enLi').checked = s.enabledLichess;
  $('depth').value = s.depth; $('dval').textContent = s.depth;
  $('mpv').value = s.multiPV; $('mval').textContent = s.multiPV;
  $('mtime').value = s.maxTime; $('tval').textContent = s.maxTime + 's';
  $('showEval').checked = s.showEval;
});
function save() {
  chrome.storage.sync.set({
    enabledChessCom: $('enCC').checked, enabledLichess: $('enLi').checked,
    depth: +$('depth').value, multiPV: +$('mpv').value, showEval: $('showEval').checked,
    maxTime: +$('mtime').value
  });
  $('dval').textContent = $('depth').value; $('mval').textContent = $('mpv').value;
  $('tval').textContent = $('mtime').value + 's';
}
document.querySelectorAll('input').forEach(i => i.addEventListener('change', save));
// show last suggestion for active tab
chrome.tabs.query({ active: true, currentWindow: true }, ([t]) => {
  if (!t) return;
  chrome.tabs.sendMessage(t.id, { type: 'GET_LAST' }, res => {
    if (chrome.runtime.lastError || !res) return;
    $('last').textContent = res.text || '';
  });
});

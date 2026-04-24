const regexInput = document.getElementById('regex-input');
const searchBtn = document.getElementById('search-btn');
const clearBtn = document.getElementById('clear-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const counter = document.getElementById('counter');
const statusEl = document.getElementById('status');
const flagI = document.getElementById('flag-i');
const flagM = document.getElementById('flag-m');
const flagS = document.getElementById('flag-s');

function t(key, ...args) {
  const msg = chrome.i18n.getMessage(key, args.length ? args.map(String) : undefined);
  return msg || key;
}

function applyI18n() {
  document.documentElement.lang = (chrome.i18n.getUILanguage() || 'en').split('-')[0];
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    const msg = chrome.i18n.getMessage(key);
    if (!msg) return;
    if (attr) el.setAttribute(attr, msg);
    else el.textContent = msg;
  });
}
applyI18n();

chrome.storage.local.get(
  ['pattern', 'flagI', 'flagM', 'flagS', 'autoActive'],
  (data) => {
    if (data.pattern) regexInput.value = data.pattern;
    if (typeof data.flagI === 'boolean') flagI.checked = data.flagI;
    if (typeof data.flagM === 'boolean') flagM.checked = data.flagM;
    if (typeof data.flagS === 'boolean') flagS.checked = data.flagS;
    regexInput.select();
    updateAutoBadge(!!data.autoActive);
    if (data.autoActive && data.pattern) {
      sendToContent({ action: 'status' }).then((res) => {
        if (res && typeof res.total === 'number') {
          updateCounter(res.total, res.current);
        }
      });
    }
  }
);

function updateAutoBadge(active) {
  const badge = document.getElementById('auto-badge');
  if (!badge) return;
  badge.textContent = active ? t('autoSearchActive') : '';
  badge.className = active ? 'active' : '';
}

function buildFlags() {
  let flags = 'g';
  if (flagI.checked) flags += 'i';
  if (flagM.checked) flags += 'm';
  if (flagS.checked) flags += 's';
  return flags;
}

function setStatus(msg, kind = 'error') {
  statusEl.textContent = msg;
  statusEl.className = kind === 'error' ? '' : kind;
}

function updateCounter(total, current) {
  counter.textContent = total > 0 ? `${current + 1} / ${total}` : '0 / 0';
  prevBtn.disabled = total === 0;
  nextBtn.disabled = total === 0;
}

async function sendToContent(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus(t('cannotAccessTab'));
    return null;
  }
  if (/^(chrome|edge|about|chrome-extension):/i.test(tab.url || '')) {
    setStatus(t('pageNotSupported'));
    return null;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    return await chrome.tabs.sendMessage(tab.id, message);
  } catch (err) {
    setStatus(t('genericError', err.message));
    return null;
  }
}

async function doSearch() {
  const pattern = regexInput.value;
  if (!pattern) {
    setStatus(t('enterPatternError'));
    return;
  }

  const flags = buildFlags();
  try {
    new RegExp(pattern, flags);
  } catch (err) {
    regexInput.classList.add('error');
    setStatus(t('invalidRegexError', err.message));
    return;
  }
  regexInput.classList.remove('error');

  chrome.storage.local.set({
    pattern,
    flagI: flagI.checked,
    flagM: flagM.checked,
    flagS: flagS.checked,
    autoActive: true
  });
  updateAutoBadge(true);

  setStatus(t('searchingStatus'), 'info');
  const result = await sendToContent({ action: 'search', pattern, flags });
  if (!result) return;

  updateCounter(result.total, result.current);
  if (result.total === 0) {
    setStatus(t('noMatches'));
  } else {
    const key = result.total === 1 ? 'matchCountOne' : 'matchCountMany';
    setStatus(t(key, result.total), 'success');
  }
}

async function doClear() {
  chrome.storage.local.set({ autoActive: false });
  updateAutoBadge(false);
  await sendToContent({ action: 'clear' });
  updateCounter(0, 0);
  setStatus('');
}

async function doNav(direction) {
  const result = await sendToContent({ action: 'navigate', direction });
  if (result) updateCounter(result.total, result.current);
}

searchBtn.addEventListener('click', doSearch);
clearBtn.addEventListener('click', doClear);
prevBtn.addEventListener('click', () => doNav('prev'));
nextBtn.addEventListener('click', () => doNav('next'));
regexInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) doNav('prev');
    else doSearch();
  }
});
regexInput.addEventListener('input', () => regexInput.classList.remove('error'));

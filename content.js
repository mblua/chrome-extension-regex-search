(() => {
  if (window.__regexSearchInjected) return;
  window.__regexSearchInjected = true;

  const HIGHLIGHT_CLASS = '__regex_search_hl__';
  const CURRENT_CLASS = '__regex_search_current__';
  const STYLE_ID = '__regex_search_style__';
  const MAX_MATCHES = 10000;

  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA',
    'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'SVG'
  ]);

  // Each entry is an array of <mark> nodes: a single regex match can span
  // several text nodes, so we group the marks that belong to the same match.
  let matches = [];
  let currentIndex = 0;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      mark.${HIGHLIGHT_CLASS} {
        background: #ffeb3b !important;
        color: #000 !important;
        padding: 0 !important;
        border-radius: 2px !important;
      }
      mark.${HIGHLIGHT_CLASS}.${CURRENT_CLASS} {
        background: #ff7043 !important;
        color: #fff !important;
        box-shadow: 0 0 0 2px #d84315 !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function isElementVisible(el) {
    let cur = el;
    while (cur && cur.nodeType === Node.ELEMENT_NODE) {
      const cs = window.getComputedStyle(cur);
      if (cs.display === 'none') return false;
      if (cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
      if (parseFloat(cs.opacity) === 0) return false;
      cur = cur.parentElement;
    }
    return true;
  }

  function collectTextNodes(root) {
    const nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest(`.${HIGHLIGHT_CLASS}`)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
        if (!isElementVisible(parent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
  }

  function clearHighlights() {
    const marks = document.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`);
    const parents = new Set();
    marks.forEach(mark => {
      const parent = mark.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parents.add(parent);
    });
    parents.forEach(p => p.normalize && p.normalize());
    matches = [];
    currentIndex = 0;
  }

  function search(pattern, flags, opts = {}) {
    const scroll = opts.scroll !== false;
    const preservePosition = !!opts.preservePosition;
    const prevIndex = currentIndex;

    clearHighlights();
    injectStyles();

    let regex;
    try {
      regex = new RegExp(pattern, flags);
    } catch (err) {
      return { total: 0, current: 0, error: err.message };
    }

    const textNodes = collectTextNodes(document.body);
    if (textNodes.length === 0) return { total: 0, current: 0 };

    // Build a single concatenated string and record each node's offset range.
    // This lets a match span multiple sibling text nodes (e.g. "1" + "min"
    // when the page renders "<span>1</span><span>min</span>").
    let bigText = '';
    const nodeRanges = [];
    for (const node of textNodes) {
      const start = bigText.length;
      bigText += node.nodeValue;
      nodeRanges.push({ node, start, end: bigText.length });
    }

    const rawMatches = [];
    regex.lastIndex = 0;
    let m;
    while ((m = regex.exec(bigText)) !== null) {
      if (m[0].length === 0) { regex.lastIndex++; continue; }
      rawMatches.push({ start: m.index, end: m.index + m[0].length });
      if (rawMatches.length >= MAX_MATCHES) break;
    }
    if (rawMatches.length === 0) return { total: 0, current: 0 };

    // Slice each match across the text nodes it overlaps.
    const segsByNodeIdx = new Map();
    let scanFrom = 0;
    for (let mi = 0; mi < rawMatches.length; mi++) {
      const { start, end } = rawMatches[mi];
      while (scanFrom < nodeRanges.length && nodeRanges[scanFrom].end <= start) scanFrom++;
      let j = scanFrom;
      while (j < nodeRanges.length && nodeRanges[j].start < end) {
        const nr = nodeRanges[j];
        const localStart = Math.max(start - nr.start, 0);
        const localEnd = Math.min(end - nr.start, nr.end - nr.start);
        if (localEnd > localStart) {
          if (!segsByNodeIdx.has(j)) segsByNodeIdx.set(j, []);
          segsByNodeIdx.get(j).push({ localStart, localEnd, matchIdx: mi });
        }
        j++;
      }
    }

    const matchMarks = rawMatches.map(() => []);

    for (const [idx, segments] of segsByNodeIdx) {
      const node = nodeRanges[idx].node;
      if (!node.parentNode) continue;
      segments.sort((a, b) => a.localStart - b.localStart);
      const text = node.nodeValue;
      const frag = document.createDocumentFragment();
      let cursor = 0;
      for (const seg of segments) {
        if (seg.localStart > cursor) {
          frag.appendChild(document.createTextNode(text.slice(cursor, seg.localStart)));
        }
        const mark = document.createElement('mark');
        mark.className = HIGHLIGHT_CLASS;
        mark.textContent = text.slice(seg.localStart, seg.localEnd);
        frag.appendChild(mark);
        matchMarks[seg.matchIdx].push(mark);
        cursor = seg.localEnd;
      }
      if (cursor < text.length) {
        frag.appendChild(document.createTextNode(text.slice(cursor)));
      }
      node.parentNode.replaceChild(frag, node);
    }

    matches = matchMarks.filter(g => g.length > 0);
    if (matches.length > 0) {
      currentIndex = preservePosition
        ? Math.min(Math.max(prevIndex, 0), matches.length - 1)
        : 0;
      focusCurrent(scroll);
    }
    return { total: matches.length, current: currentIndex };
  }

  function focusCurrent(scroll = true) {
    document.querySelectorAll(`mark.${CURRENT_CLASS}`).forEach(m => m.classList.remove(CURRENT_CLASS));
    if (matches.length === 0) return;
    const group = matches[currentIndex];
    if (!group || group.length === 0) return;
    group.forEach(m => m.classList.add(CURRENT_CLASS));
    if (scroll) {
      group[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }
  }

  function navigate(direction) {
    if (matches.length === 0) return { total: 0, current: 0 };
    if (direction === 'next') currentIndex = (currentIndex + 1) % matches.length;
    else currentIndex = (currentIndex - 1 + matches.length) % matches.length;
    focusCurrent();
    return { total: matches.length, current: currentIndex };
  }

  let domObserver = null;
  let scheduleTimer = null;
  let activePattern = null;
  let activeFlags = null;

  function runSearchPaused() {
    if (!activePattern) return;
    // Pause the observer so our own <mark> insertions don't trigger it.
    if (domObserver) domObserver.disconnect();
    try {
      // Silent re-highlight: keep the user's scroll position and match index.
      search(activePattern, activeFlags, { scroll: false, preservePosition: true });
    } catch (_) { /* ignore */ }
    if (domObserver) {
      domObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    }
  }

  function scheduleAutoSearch(delay) {
    if (scheduleTimer) clearTimeout(scheduleTimer);
    scheduleTimer = setTimeout(() => {
      scheduleTimer = null;
      runSearchPaused();
    }, delay);
  }

  function ensureObserver() {
    if (domObserver) return;
    domObserver = new MutationObserver(() => scheduleAutoSearch(500));
    domObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  function stopObserver() {
    if (domObserver) { domObserver.disconnect(); domObserver = null; }
    if (scheduleTimer) { clearTimeout(scheduleTimer); scheduleTimer = null; }
    activePattern = null;
    activeFlags = null;
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg.action === 'search') {
        activePattern = msg.pattern;
        activeFlags = msg.flags;
        const result = search(msg.pattern, msg.flags);
        ensureObserver();
        sendResponse(result);
      } else if (msg.action === 'clear') {
        stopObserver();
        clearHighlights();
        sendResponse({ total: 0, current: 0 });
      } else if (msg.action === 'navigate') {
        sendResponse(navigate(msg.direction));
      } else if (msg.action === 'status') {
        sendResponse({ total: matches.length, current: currentIndex });
      } else {
        sendResponse({ error: 'unknown action' });
      }
    } catch (err) {
      sendResponse({ total: 0, current: 0, error: err.message });
    }
    return false;
  });

  // Auto-apply the last search after the page (re)loads and keep re-applying
  // if the page renders more content later (SPAs, lazy-load, infinite scroll).
  function autoApplyIfActive() {
    try {
      chrome.storage.local.get(
        ['pattern', 'flagI', 'flagM', 'flagS', 'autoActive'],
        (data) => {
          if (!data || !data.autoActive || !data.pattern) return;
          let flags = 'g';
          if (data.flagI) flags += 'i';
          if (data.flagM) flags += 'm';
          if (data.flagS) flags += 's';
          activePattern = data.pattern;
          activeFlags = flags;
          scheduleAutoSearch(400);
          ensureObserver();
        }
      );
    } catch (_) { /* storage unavailable, ignore */ }
  }

  if (document.readyState === 'complete') {
    autoApplyIfActive();
  } else {
    window.addEventListener('load', autoApplyIfActive, { once: true });
  }
})();

(() => {
  if (globalThis.__shunduLoaded) return;
  globalThis.__shunduLoaded = true;
  const E = globalThis.Shundu;
  const SKIP = 'script,style,noscript,textarea,input,select,option,button,pre,code,kbd,samp,svg,math,canvas,iframe,video,audio,nav,[role="navigation"],[role="button"],[role="textbox"],[role="menu"],[contenteditable]:not([contenteditable="false"]),[data-shundu-run],[data-shundu-ignore],[aria-hidden="true"],[hidden]';
  const RUN = "[data-shundu-run]";
  let settings = E.DEFAULTS;
  let style;
  let observer;
  let revision = 0;
  let timer;
  const pending = new Set();
  const hostname = location.hostname;

  function eligible(node) {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP) || !/[\p{Script=Han}\p{Script=Latin}]/u.test(node.data)) return false;
    if (parent.isContentEditable) return false;
    // Keep labels, tiny icon glyphs and control text out of the reading pass.
    return Boolean(parent.closest("p,li,blockquote,dd,dt,td,th,figcaption,h1,h2,h3,h4,h5,h6,article,main,[role=main]")) || node.data.trim().length >= 24;
  }
  function restore() {
    for (const wrapper of document.querySelectorAll(RUN)) {
      wrapper.replaceWith(document.createTextNode(wrapper.textContent));
    }
    style?.remove();
    style = undefined;
  }
  function paintNode(node) {
    if (!node.isConnected || !eligible(node)) return;
    const wrapper = document.createElement("span");
    wrapper.setAttribute("data-shundu-run", "");
    if (node.parentElement.closest("h1,h2,h3,h4,h5,h6")) wrapper.setAttribute("data-shundu-heading", "");
    const allowEmphasis = !node.parentElement.closest("strong,b,h1,h2,h3,h4,h5,h6");
    wrapper.append(E.fragment(document, node.data, settings, allowEmphasis));
    node.replaceWith(wrapper);
  }
  function collect(root) {
    if (root.nodeType === Node.TEXT_NODE) return eligible(root) ? [root] : [];
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(SKIP)) return [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: node => eligible(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
  }
  function observe() {
    if (settings.enabled && document.body) observer.observe(document.body, { subtree: true, childList: true, characterData: true });
  }
  function processRoots(roots, version) {
    const nodes = roots.filter(root => root.isConnected).flatMap(collect);
    let index = 0;
    function batch() {
      if (version !== revision || !settings.enabled) return;
      observer.disconnect();
      const until = Math.min(index + 160, nodes.length);
      for (; index < until; index++) paintNode(nodes[index]);
      observe();
      if (index < nodes.length) setTimeout(batch, 0);
    }
    batch();
  }
  function flush() {
    timer = undefined;
    const roots = [...pending].filter(root => ![...pending].some(other => other !== root && other.contains(root)));
    pending.clear();
    processRoots(roots, revision);
  }
  observer = new MutationObserver(mutations => {
    for (const change of mutations) {
      const target = change.target.nodeType === Node.ELEMENT_NODE ? change.target : change.target.parentElement;
      const existing = target?.closest(RUN);
      if (existing) {
        // A site edited a previously decorated node: preserve its new text and reprocess it.
        observer.disconnect();
        const text = document.createTextNode(existing.textContent);
        existing.replaceWith(text);
        pending.add(text);
        observe();
      } else if (change.type === "characterData") pending.add(change.target);
      else for (const added of change.addedNodes) pending.add(added);
    }
    if (!timer && pending.size) timer = setTimeout(flush, 100);
  });
  function apply(input) {
    revision++;
    clearTimeout(timer);
    timer = undefined;
    pending.clear();
    observer.disconnect();
    restore();
    settings = E.normalize(input);
    if (!settings.enabled || !document.body) return;
    style = document.createElement("style");
    style.id = "shundu-reader-style";
    style.textContent = E.fontCSS(path => chrome.runtime.getURL(path)) + E.readingCSS(settings);
    (document.head || document.documentElement).append(style);
    processRoots([document.body], revision);
  }
  async function reload() {
    try {
      const store = await chrome.storage.local.get(["globalSettings", "sites"]);
      apply(E.resolve(store, hostname));
    } catch (error) {
      // Reloading the extension invalidates old content scripts. A page refresh reconnects them.
      console.debug("顺读：刷新页面可重新连接扩展。", error.message);
    }
  }
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === "shundu:ping") respond({ ready: true });
    if (message.type === "shundu:apply") { apply(message.settings); respond({ ready: true }); }
  });
  chrome.storage.onChanged.addListener((_changes, area) => { if (area === "local") reload(); });
  reload();
})();

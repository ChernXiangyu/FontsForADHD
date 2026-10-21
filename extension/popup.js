/* Runs in the extension popup and in the offline demo. */
(() => {
  const E = globalThis.Shundu;
  const $ = id => document.getElementById(id);
  const isExtension = Boolean(globalThis.chrome?.storage?.local && chrome.runtime?.id);
  const isDemo = document.body.hasAttribute("data-demo");
  const fields = ["enabled", "chineseFont", "englishFont", "chineseMode", "englishMode", "fontSize", "lineHeight", "letterSpacing"];
  let store = {};
  let hostname = "";
  let tabId;
  let comparing = false;
  let writeQueue = Promise.resolve();
  let customText = "";
  const zhText = "阅读可以有自己的节奏。让文字留一点空间，也给视线一些落点。";
  const enText = "A little space. A gentle rhythm. Read at your own pace.";
  async function readStore() {
    if (isExtension) return chrome.storage.local.get(["globalSettings", "sites"]);
    try { return JSON.parse(localStorage.getItem("shundu-demo") || "{}"); } catch { return {}; }
  }
  function current() {
    return $("scope").value === "global" ? E.normalize(store.globalSettings) : E.resolve(store, hostname);
  }
  function readForm() {
    const value = {};
    for (const key of fields) value[key] = key === "enabled" ? $(key).checked : $(key).type === "range" ? Number($(key).value) : $(key).value;
    value.intensity = document.querySelector('[name="intensity"]:checked')?.value;
    return E.normalize(value);
  }
  function fill(value) {
    for (const key of fields) {
      if (key === "enabled") $(key).checked = value[key];
      else $(key).value = value[key];
    }
    document.querySelector(`[name="intensity"][value="${value.intensity}"]`).checked = true;
    render();
  }
  function renderText(element, text, settings) {
    element.replaceChildren();
    if (comparing || !settings.enabled) element.textContent = text;
    else element.append(E.fragment(document, text, settings));
  }
  function render() {
    const settings = readForm();
    document.body.dataset.disabled = !settings.enabled;
    $("fontSizeValue").textContent = `${settings.fontSize} px`;
    $("lineHeightValue").textContent = settings.lineHeight.toFixed(2);
    $("letterSpacingValue").textContent = `${settings.letterSpacing.toFixed(2)} em`;
    $("scopeBadge").textContent = $("scope").value === "global" ? "全局默认" : "本站设置";
    $("compare").textContent = comparing ? "返回效果" : "对照原文";
    $("compare").setAttribute("aria-pressed", String(comparing));
    let previewStyle = $("previewStyle");
    if (!previewStyle) { previewStyle = document.createElement("style"); previewStyle.id = "previewStyle"; document.head.append(previewStyle); }
    previewStyle.textContent = comparing || !settings.enabled ? "" : E.readingCSS(settings, ".reading-sample");
    $("preview").className = "reading-sample";
    renderText($("previewZh"), zhText, settings);
    renderText($("previewEn"), enText, settings);
    if (isDemo) {
      for (const p of document.querySelectorAll("#article p[data-source]")) {
        p.classList.add("reading-sample");
        renderText(p, p.dataset.source, settings);
      }
      $("customPreview").className = "reading-sample";
      renderText($("customPreview"), customText, settings);
    }
  }
  async function connect() {
    if (!isExtension || isDemo || !tabId) return;
    try { await chrome.tabs.sendMessage(tabId, { type: "shundu:ping" }); }
    catch {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["engine.js", "content.js"] });
    }
    await chrome.tabs.sendMessage(tabId, { type: "shundu:apply", settings: E.resolve(store, hostname) });
  }
  function save() {
    const settings = readForm();
    const scope = $("scope").value;
    // Update the in-memory choice immediately; serialize storage writes to keep rapid changes ordered.
    if (scope === "global") store.globalSettings = settings;
    else store.sites = { ...(store.sites || {}), [hostname]: settings };
    const snapshot = structuredClone(store);
    $("status").textContent = "正在保存…";
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      if (isExtension) await chrome.storage.local.set(snapshot);
      else localStorage.setItem("shundu-demo", JSON.stringify(snapshot));
      try {
        await connect();
        $("status").textContent = isDemo ? "试读设置已保存 · 不会修改其他网页" : scope === "global" && store.sites?.[hostname] ? "全局默认已保存 · 当前网站仍使用本站设置" : "已保存并应用 · 所有处理均在本地";
      } catch {
        $("status").textContent = "设置已保存。此页面不支持处理，请在普通网页试用。";
      }
    }).catch(error => { $("status").textContent = `保存失败：${error.message}`; });
    return writeQueue;
  }
  async function init() {
    store = await readStore();
    if (isExtension && !isDemo) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabId = tab?.id;
      try { hostname = new URL(tab.url).hostname; } catch { hostname = ""; }
      $("siteName").textContent = hostname || "此页面不支持处理";
      if (!/^https?:/.test(tab?.url || "")) $("status").textContent = "请在普通网页使用。Chrome 内置页、商店和 PDF 不支持。";
    } else {
      hostname = "demo.local";
      $("siteName").textContent = "本地试读 · 可粘贴自己的文字";
      $("scope").value = "global";
      $("scope").disabled = true;
      $("inherit").hidden = true;
    }
    fill(current());
    for (const id of fields) $(id).addEventListener("input", () => {
      render();
      if ($(id).type !== "range") save();
    });
    // Range commit uses change, so closing the popup does not drop a pending debounced save.
    for (const id of ["fontSize", "lineHeight", "letterSpacing"]) $(id).addEventListener("change", save);
    for (const radio of document.querySelectorAll('[name="intensity"]')) radio.addEventListener("change", () => { render(); save(); });
    $("scope").addEventListener("change", () => fill(current()));
    $("compare").addEventListener("click", () => { comparing = !comparing; render(); });
    $("reset").addEventListener("click", () => { fill(E.DEFAULTS); save(); });
    $("inherit").addEventListener("click", () => {
      delete store.sites?.[hostname];
      const snapshot = structuredClone(store);
      writeQueue = writeQueue.catch(() => {}).then(async () => {
        await chrome.storage.local.set(snapshot);
        $("scope").value = "site";
        fill(current());
        try { await connect(); $("status").textContent = "本站已跟随全局默认"; }
        catch { $("status").textContent = "已保存；请在普通网页试用"; }
      }).catch(error => { $("status").textContent = `保存失败：${error.message}`; });
    });
    if (isDemo) $("previewCustom").addEventListener("click", () => { customText = $("customText").value; render(); });
    if (!isDemo) {
      try { await connect(); } catch { /* The explanatory status is shown on a settings change. */ }
    }
    document.body.dataset.ready = "true";
  }
  init().catch(error => { $("status").textContent = `连接失败：${error.message}`; });
})();

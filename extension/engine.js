/* Shared, dependency-free text rules. All processing stays in the browser. */
(() => {
  if (globalThis.Shundu) return;
  const DEFAULTS = Object.freeze({
    enabled: true, chineseFont: "serif", englishFont: "follow",
    chineseMode: "word", englishMode: "prefix", intensity: "light",
    fontSize: 18, lineHeight: 1.85, letterSpacing: 0.02
  });
  const choices = {
    chineseFont: ["original", "serif", "sans"], englishFont: ["follow", "original", "lexend"],
    chineseMode: ["off", "prefix", "word"], englishMode: ["off", "prefix"],
    intensity: ["light", "medium", "strong"]
  };
  function normalize(value = {}) {
    const result = { ...DEFAULTS };
    for (const [key, allowed] of Object.entries(choices)) {
      if (allowed.includes(value[key])) result[key] = value[key];
    }
    if (typeof value.enabled === "boolean") result.enabled = value.enabled;
    for (const [key, min, max, step] of [["fontSize", 14, 28, 1], ["lineHeight", 1.3, 2.4, 0.05], ["letterSpacing", 0, 0.12, 0.01]]) {
      if (typeof value[key] === "number" && Number.isFinite(value[key])) {
        result[key] = Math.round(Math.min(max, Math.max(min, value[key])) / step) * step;
      }
    }
    return result;
  }
  function resolve(store = {}, hostname = "") {
    return normalize({ ...normalize(store.globalSettings), ...(store.sites?.[hostname] || {}) });
  }
  const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });
  const han = /\p{Script=Han}/u;
  const latin = /\p{Script=Latin}/u;
  const stopwords = new Set(["一个", "一些", "这个", "那个", "这些", "那些", "我们", "你们", "他们", "它们", "自己", "可以", "已经", "就是", "还是", "没有", "因为", "所以", "但是", "如果", "以及", "而且", "时候", "什么", "如何", "这样", "那样", "进行"]);
  const cadence = { light: 4, medium: 2, strong: 1 };
  function tokenize(text, input) {
    const settings = normalize(input);
    const tokens = [];
    let eligible = 0;
    for (const item of segmenter.segment(text)) {
      const word = item.segment;
      const language = han.test(word) ? "zh" : latin.test(word) ? "en" : "neutral";
      const chars = Array.from(word);
      let bold = 0;
      if (settings.enabled && item.isWordLike) {
        if (language === "zh" && settings.chineseMode !== "off" && chars.length > 1 && !stopwords.has(word)) {
          if (eligible++ % cadence[settings.intensity] === 0) {
            bold = settings.chineseMode === "word" ? chars.length : 1;
          }
        } else if (language === "en" && settings.englishMode === "prefix" && chars.length > 2) {
          const ratio = { light: 0.35, medium: 0.5, strong: 0.65 }[settings.intensity];
          bold = Math.min(chars.length - 1, Math.max(1, Math.ceil(chars.length * ratio)));
        }
      }
      tokens.push({ text: word, language, bold });
    }
    return tokens;
  }
  function fragment(doc, text, settings, allowEmphasis = true) {
    const result = doc.createDocumentFragment();
    for (const token of tokenize(text, settings)) {
      const span = doc.createElement("span");
      span.className = `shundu-${token.language}`;
      if (token.bold && allowEmphasis) {
        const chars = Array.from(token.text);
        const emphasis = doc.createElement("span");
        emphasis.className = "shundu-emphasis";
        emphasis.textContent = chars.slice(0, token.bold).join("");
        span.append(emphasis, doc.createTextNode(chars.slice(token.bold).join("")));
      } else span.textContent = token.text;
      result.append(span);
    }
    return result;
  }
  function fontCSS(url) {
    return `@font-face{font-family:ShunduSerif;src:url("${url("fonts/SourceHanSerifCN-VF.woff2")}") format("woff2");font-weight:200 900;font-display:swap}
      @font-face{font-family:ShunduSans;src:url("${url("fonts/SourceHanSansCN-VF.woff2")}") format("woff2");font-weight:100 900;font-display:swap}
      @font-face{font-family:ShunduLexend;src:url("${url("fonts/Lexend.ttf")}") format("truetype");font-weight:100 900;font-display:swap}`;
  }
  function readingCSS(input, root = "[data-shundu-run]") {
    const s = normalize(input);
    const zh = s.chineseFont === "serif" ? "ShunduSerif, 'Source Han Serif SC', 'Noto Serif CJK SC', serif" : "ShunduSans, 'Source Han Sans SC', 'Noto Sans CJK SC', sans-serif";
    return `${root}{letter-spacing:${s.letterSpacing}em!important;line-height:${s.lineHeight}!important;}
      ${root}:not([data-shundu-heading]){font-size:${s.fontSize}px!important;}
      ${s.chineseFont !== "original" ? `${root} .shundu-zh{font-family:${zh}!important;}` : ""}
      ${s.englishFont === "follow" && s.chineseFont !== "original" ? `${root},${root} .shundu-en,${root} .shundu-neutral{font-family:${zh}!important;}` : ""}
      ${s.englishFont === "lexend" ? `${root} .shundu-en{font-family:ShunduLexend,sans-serif!important;}` : ""}
      ${root} .shundu-emphasis{font-weight:700!important;}
      ${root} span{line-height:inherit;}`;
  }
  globalThis.Shundu = { DEFAULTS, normalize, resolve, tokenize, fragment, fontCSS, readingCSS };
  if (typeof module !== "undefined") module.exports = globalThis.Shundu;
})();

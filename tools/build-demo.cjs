const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'extension/popup.html'), 'utf8');
html = html.replace('<title>顺读 · 阅读设置</title>', '<title>顺读 · 中英文字体试读</title>');
html = html.replace('<body>', '<body class="demo-layout" data-demo><div class="demo-settings">');
html = html.replace('</body>', `</div>
<div class="demo-article">
  <p class="eyebrow">SHUNDU / A SMALL READING EXPERIMENT</p>
  <h2>找到你读着舒服的样子。</h2>
  <p class="intro">左侧调整，右侧试读。字体和强调可以自由组合。<br>点「对照原文」查看处理前后；也可以粘贴一段你正在读的文字。</p>
  <article id="article">
    <h3>从一段中文开始</h3>
    <p data-source="清晨的城市还没有完全醒来。窗外的树影轻轻晃动，你打开一篇昨天没读完的文章。这一次，不必急着读到结尾，只需要找到一个舒服的位置，从眼前这一句开始。"></p>
    <p data-source="阅读体验可以自己调整。字体的形状、文字的间距，以及一段话里的视觉落点，都可以慢慢尝试。你可以选择思源宋体的笔画变化，也可以切换到思源黑体，看看哪一种更合心意。"></p>
    <h3>A gentle place to begin</h3>
    <p data-source="There is no hurry to reach the end of the page. Take a breath, find your place, and let the next sentence come into focus. Sometimes a different typeface or a little more space is all you want to try."></p>
    <h3>中英混排，也按你的习惯</h3>
    <p data-source="今天让中英文使用同一套字体，看看 reading experience 有什么不同。Coffee 放在桌边，Chrome 里的文章慢慢展开。不是每一行都需要同样的节奏，也不必一次找到所有答案。"></p>
  </article>
  <label for="customText">换成你自己的文字</label>
  <textarea id="customText" placeholder="粘贴中文、英文或中英混排的段落…"></textarea>
  <button id="previewCustom" type="button">试读这段文字 →</button>
  <p id="customPreview" style="white-space:pre-wrap"></p>
  <p class="footnote">中文整词强调使用本地分词与间隔规则，不做语义关键词判断。<br>本页仅供试读；安装扩展后，点击工具栏中的「顺读」调整真实网页。</p>
</div></body>`);
fs.writeFileSync(path.join(root, 'extension/demo.html'), html);

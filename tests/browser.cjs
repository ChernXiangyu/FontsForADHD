const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const ext = path.join(root, 'extension');
const out = path.join(root, 'artifacts');
fs.mkdirSync(out, { recursive: true });
const fixture = `<!doctype html><html><head><meta charset="utf-8"><title>Reader integration</title></head><body>
<main><h1 id="heading" style="font-size:40px">阅读体验 Reading experience</h1>
<p id="mixed">阅读可以有自己的节奏。让文字留一点空间，也给视线一些落点。 Reading comfortably at your own pace. 123 🙂</p>
<p id="strong">保留原有<strong>重要内容 Important words</strong>和<a id="link" href="#test">链接文字 reading link</a>。</p>
<p id="safe">&lt;img src=x onerror=alert(1)&gt; 原文只是文字。</p>
<pre id="code">const reading = '阅读体验';</pre><div contenteditable="true" id="editor">编辑内容 Reading remains editable.</div>
<textarea id="textarea">输入内容</textarea><button id="button">按钮 Reading control</button>
<nav id="nav"><p>导航 navigation content stays unchanged.</p></nav>
<p id="live">等待动态更新的文章阅读体验和文本内容。</p><div id="dynamic"></div>
</main></body></html>`;
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/fixture')) { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(fixture); return; }
  const filepath = path.resolve(ext, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!filepath.startsWith(ext + path.sep) || !fs.existsSync(filepath) || !fs.statSync(filepath).isFile()) { res.statusCode = 404; res.end(); return; }
  const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'application/javascript', '.woff2':'font/woff2', '.ttf':'font/ttf' };
  res.setHeader('Content-Type', mime[path.extname(filepath)] || 'text/plain');
  fs.createReadStream(filepath).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  let context;
  try {
    context = await chromium.launchPersistentContext(path.join(root, '.cache/test-profile-' + Date.now()), {
      headless: true, channel: 'chromium',
      args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
      viewport: { width: 1280, height: 1000 }
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).hostname;
    console.log('PASS: unpacked extension loaded:', id);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/fixture');
    await page.waitForSelector('#mixed [data-shundu-run]');
    const original = '阅读可以有自己的节奏。让文字留一点空间，也给视线一些落点。 Reading comfortably at your own pace. 123 🙂';
    assert.equal(await page.locator('#mixed').textContent(), original);
    assert.ok(await page.locator('#mixed .shundu-emphasis').count() > 1);
    for (const selector of ['#code','#editor','#textarea','#button','#nav']) assert.equal(await page.locator(selector + ' [data-shundu-run]').count(), 0, selector);
    assert.equal(await page.locator('#safe img').count(), 0);
    assert.equal(await page.locator('#heading').evaluate(el => getComputedStyle(el).fontSize), '40px');
    await page.locator('#link').evaluate(el => { el.addEventListener('click', () => { window.linkWorked = true; }); });
    await page.locator('#link').click();
    assert.equal(await page.evaluate(() => window.linkWorked), true);
    console.log('PASS: text integrity, safe rendering, headings, links and skipped controls');

    const fonts = await page.evaluate(async () => {
      await document.fonts.load('18px ShunduSerif', '阅读');
      await document.fonts.load('18px ShunduSans', '阅读');
      await document.fonts.load('18px ShunduLexend', 'Reading');
      return ['ShunduSerif','ShunduSans','ShunduLexend'].map(name => [...document.fonts].some(f => f.family === name && f.status === 'loaded'));
    });
    assert.deepEqual(fonts, [true,true,true]);
    console.log('PASS: all three bundled fonts load in the real website');
    const matchingFamily = () => page.evaluate(() => {
      const zh = document.querySelector('#mixed .shundu-zh');
      const en = document.querySelector('#mixed .shundu-en');
      return getComputedStyle(zh).fontFamily === getComputedStyle(en).fontFamily;
    });
    assert.equal(await matchingFamily(), true);
    console.log('PASS: default Chinese and English use the same serif family');

    await page.evaluate(() => {
      const p = document.createElement('p'); p.textContent = '动态加载的阅读内容 Reading dynamically added content.'; document.getElementById('dynamic').append(p);
    });
    await page.waitForSelector('#dynamic [data-shundu-run]');
    await page.locator('#live').evaluate(el => { el.querySelector('.shundu-zh').firstChild.textContent = '新的'; });
    await page.waitForFunction(() => document.querySelector('#live').textContent.startsWith('新的'));
    await page.waitForSelector('#live [data-shundu-run]');
    const liveText = await page.locator('#live').textContent();
    console.log('PASS: dynamic insertion and edits to previously processed text');

    await worker.evaluate(async () => chrome.storage.local.set({globalSettings:{ enabled:false }}));
    await page.waitForFunction(() => !document.querySelector('[data-shundu-run]'));
    assert.equal(await page.locator('#mixed').textContent(), original);
    assert.equal(await page.locator('#live').textContent(), liveText);
    await page.locator('#link').click();
    console.log('PASS: disable restores text and preserves later site edits');

    await worker.evaluate(async () => chrome.storage.local.set({globalSettings:{ enabled:true, chineseFont:'sans', chineseMode:'prefix' }}));
    await page.waitForSelector('#mixed [data-shundu-run]');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#mixed .shundu-zh')).fontFamily.includes('ShunduSans'));
    assert.equal(await matchingFamily(), true);
    await worker.evaluate(async () => chrome.storage.local.set({globalSettings:{ enabled:true, chineseFont:'sans', englishFont:'lexend' }}));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#mixed .shundu-en')).fontFamily.includes('ShunduLexend'));
    await worker.evaluate(async () => chrome.storage.local.set({globalSettings:{ enabled:true, chineseFont:'sans', englishFont:'follow' }}));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#mixed .shundu-en')).fontFamily.includes('ShunduSans'));
    console.log('PASS: English follows sans choice; Lexend remains independently selectable');
    await page.reload();
    await page.waitForSelector('#mixed [data-shundu-run]');
    assert.match(await page.locator('#mixed .shundu-zh').first().evaluate(el => getComputedStyle(el).fontFamily), /ShunduSans/);
    console.log('PASS: settings changes and persistence across navigation');

    // Navigate a background extension tab while the fixture remains the active website.
    const popup = await context.newPage();
    await page.bringToFront();
    await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.waitForSelector('body[data-ready=true]');
    assert.equal(await popup.locator('#siteName').textContent(), '127.0.0.1');
    await popup.locator('#chineseFont').selectOption('serif');
    await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('已保存'));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#mixed .shundu-zh')).fontFamily.includes('ShunduSerif'));
    await popup.locator('#chineseMode').selectOption('word');
    await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('已保存'));
    await popup.locator('#enabled').uncheck();
    await page.waitForFunction(() => !document.querySelector('[data-shundu-run]'));
    await popup.locator('#enabled').check();
    await page.waitForSelector('#mixed [data-shundu-run]');
    await popup.locator('#compare').click();
    assert.equal(await popup.locator('#preview .shundu-emphasis').count(), 0);
    await popup.locator('#compare').click();
    assert.ok(await popup.locator('#preview .shundu-emphasis').count());
    await popup.locator('#reset').click();
    await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('已保存'));
    assert.equal(await popup.locator('#chineseFont').inputValue(), 'serif');
    console.log('PASS: real popup saves site settings, toggles, resets and compares');

    await popup.locator('#scope').selectOption('global');
    await popup.locator('#chineseFont').selectOption('sans');
    await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('当前网站仍使用本站设置'));
    assert.match(await page.locator('#mixed .shundu-zh').first().evaluate(el => getComputedStyle(el).fontFamily), /ShunduSerif/);
    await popup.locator('#inherit').click();
    await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('本站已跟随全局'));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#mixed .shundu-zh')).fontFamily.includes('ShunduSans'));
    await popup.locator('#scope').selectOption('global');
    await popup.locator('#reset').click();
    await popup.waitForFunction(() => document.querySelector('#status').textContent.includes('已保存'));
    console.log('PASS: site overrides stay independent; inherit restores the global choice');

    await popup.evaluate(() => document.fonts.ready);
    await popup.locator('main').evaluate(el => { el.scrollTop = 0; });
    const bounds = await popup.locator('body').boundingBox();
    await popup.screenshot({path:path.join(out,'popup.png'),clip:{x:0,y:0,width:392,height:Math.ceil(bounds.height)}});
    const demo = await context.newPage();
    await demo.goto(`chrome-extension://${id}/demo.html`);
    await demo.waitForSelector('body[data-ready=true]');
    await demo.evaluate(() => document.fonts.ready);
    await demo.locator('#customText').fill('<img onerror=alert(1)> 中文阅读体验 Reading safely.');
    await demo.locator('#previewCustom').click();
    assert.equal(await demo.locator('#customPreview').textContent(), '<img onerror=alert(1)> 中文阅读体验 Reading safely.');
    assert.equal(await demo.locator('#customPreview img').count(), 0);
    await demo.locator('#customText').fill('给阅读留一点空间。Find a rhythm that feels comfortable.');
    await demo.locator('#previewCustom').click();
    await demo.screenshot({path:path.join(out,'demo.png'),fullPage:true});
    console.log('PASS: offline demo and custom mixed text; screenshots saved');
    assert.deepEqual(errors, []);
    await worker.evaluate(async () => chrome.storage.local.clear());
    console.log('All browser checks passed.');
  } finally { if(context) await context.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });

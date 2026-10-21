const { test } = require('node:test');
const assert = require('node:assert/strict');
const E = require('../extension/engine.js');
test('defaults match the selected reading experience', () => {
  assert.equal(E.DEFAULTS.chineseFont, 'serif');
  assert.equal(E.DEFAULTS.chineseMode, 'word');
  assert.equal(E.DEFAULTS.englishFont, 'follow');
  assert.equal(E.DEFAULTS.intensity, 'light');
});
test('mixed text, punctuation, emoji and numbers survive exactly', () => {
  for (const text of ['阅读体验 Reading at 9:30，慢慢来。🙂', '繁體中文與简体中文：𠮷野家。', '<img onerror="alert(1)"> 不执行 HTML', "Don't change café or naïve words!\n\nNew paragraph."]) {
    assert.equal(E.tokenize(text).map(t => t.text).join(''), text);
  }
});
test('modes disable independently and stronger Chinese emphasis is denser', () => {
  const text = '阅读体验与文字形状，以及视觉节奏和空间设计。Reading comfortably.';
  const off = E.tokenize(text, { chineseMode: 'off' });
  assert.ok(off.some(t => t.language === 'en' && t.bold > 0));
  assert.ok(off.filter(t => t.language === 'zh').every(t => !t.bold));
  const count = intensity => E.tokenize(text, { intensity }).filter(t => t.language === 'zh' && t.bold).length;
  assert.ok(count('strong') > count('light'));
  assert.ok(E.tokenize(text, { enabled: false }).every(t => !t.bold));
  assert.ok(E.tokenize(text, { chineseMode: 'prefix', intensity: 'strong' }).filter(t => t.language === 'zh').every(t => t.bold <= 1));
});
test('site override and untrusted storage are normalized', () => {
  assert.equal(E.resolve({ globalSettings: { chineseFont: 'sans' }, sites: { 'a.test': { chineseFont: 'serif' } } }, 'a.test').chineseFont, 'serif');
  assert.equal(E.resolve({ globalSettings: { chineseFont: 'sans' } }, 'b.test').chineseFont, 'sans');
  assert.equal(E.normalize({ fontSize: 999, chineseFont: 'url(evil)', lineHeight: NaN }).fontSize, 28);
  assert.equal(E.normalize({ fontSize: 999, chineseFont: 'url(evil)', lineHeight: NaN }).chineseFont, 'serif');
});

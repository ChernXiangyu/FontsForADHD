# 顺读 · 中英阅读助手

一个可直接加载的 Chrome Manifest V3 扩展。默认中英文统一使用 **思源宋体**，中文轻度整词强调，英文轻度词首加粗。英文字体默认跟随中文：中文切换为思源黑体时，英文同步切换；Lexend 保留为独立选项。

## 安装试用

1. 在 Chrome 地址栏输入 `chrome://extensions`。
2. 打开右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择本项目的 **extension 文件夹**（里面有 manifest.json）。
4. 打开或刷新一个普通网页，在工具栏的扩展菜单中找到「顺读」，建议固定到工具栏。
5. 点击图标调整设置。顶部开关关闭后恢复页面文字；可以按网站保存，或修改全局默认。

无需构建或安装依赖。字体已经打包，可离线使用。也可以先直接用 Chrome 打开 `extension/demo.html` 试读；本地试读的设置独立于真实网页。

## 设置

- 中文：思源宋体、思源黑体、网页原字体；强调可选整词、词首、关闭。
- 英文：跟随中文字体（默认）、Lexend、网页原字体；强调可选词首加粗、关闭。跟随中文时，英文、数字和标点一起使用所选中文字体内置的字形；中文为原字体时保留网页字体。
- 强调强度：轻／中／重。中文改变强调密度，英文改变加粗字母比例。
- 字号 14–28 px，行距 1.30–2.40，字距 0–0.12 em。标题保留原来的字号。
- 选择「仅此网站」会为当前域名单独保存；「全局默认」影响没有本站设置的网站。点击「本站跟随全局」删除该站覆盖。
- 「对照原文」只切换弹窗和试读页的样例；顶部开关控制真实网页是否处理。

扩展加载到新网页时默认开启。通过顶部开关并选择「全局默认」可改为全局关闭，再为单独网站开启。

## 实现与范围

全部文字处理在本地完成，不发起 API 请求。使用 `Intl.Segmenter` 做中文分词，跳过部分常见虚词，并按间隔加粗多字词。这里的「整词强调」是视觉节奏规则，**不是语义关键词提取**。英文按单词长度加粗前部。

正文、列表、表格及普通长文本会被处理。输入框、可编辑区域、按钮、导航、代码、SVG 等保持原状。动态新增文本会继续处理。关闭时移除装饰和样式，保留原文字内容；不会改写原文或向正文插入空格。

首版只处理页面主文档，不处理 iframe、Shadow DOM、canvas 文字、Chrome 内置页、Chrome 商店、内置 PDF 阅读器或 Google Docs 这类画布编辑器。对 DOM 管理严格的网站仍可能发生冲突，可为该网站关闭。部分网站的字体安全策略可能拦截自定义字体；强调规则仍可工作。思源字体包采用中国大陆字形子集，涵盖简繁常用字，未覆盖的字由网页／系统字体回退。

## 权限

- `storage`：保存全局和本站设置。
- `activeTab`、`scripting`：从弹窗连接已打开网页。
- HTTP／HTTPS 内容脚本：在普通网页上自动应用设置；只暴露随包字体文件。
- HTTP／HTTPS 网站权限：自动应用设置，并允许弹窗连接已经打开的网页。

不收集网页文字或阅读记录，不使用遥测、远程脚本或云服务。仅保存设置以及使用本站设置的域名。

## 开发和验证

```powershell
npm run build
npm test
```

`build` 从弹窗生成离线试读页。`tests/browser.cjs` 使用 Playwright 验证真实 DOM、恢复、动态内容、弹窗和字体；需要本地可用的 Playwright／Chromium。

## 字体来源与许可

字体原文件按 SIL Open Font License 随扩展分发，完整许可见 `extension/licenses/`。

- [思源宋体官方仓库](https://github.com/adobe-fonts/source-han-serif)，release 分支，`Variable/WOFF2/TTF/Subset/SourceHanSerifCN-VF.ttf.woff2`。
- [思源黑体官方仓库](https://github.com/adobe-fonts/source-han-sans)，release 分支，`Variable/WOFF2/TTF/Subset/SourceHanSansCN-VF.ttf.woff2`。
- [Lexend / Google Fonts](https://github.com/google/fonts/tree/main/ofl/lexend)，`Lexend[wght].ttf`。

本项目提供类似词首强调的独立视觉实验，不是 Bionic Reading 官方产品。

# Lunar Start Page

Lunar Start Page 是一个可自定义的浏览器新标签页插件。它把默认的新标签页替换成一个更个人化的起始页，支持搜索、快捷书签、主题外观、壁纸、时钟和布局调整，适合用来做自己的浏览器主页。

开发者：Lunarfox 月狐  
GitHub：https://github.com/ShadowsLunarfox

## 功能特点

- 自定义新标签页主页
- 多搜索引擎切换，支持 Google、Bing、DuckDuckGo、Baidu、Sogou、360 Search 等
- 搜索建议开关与多引擎建议设置
- 快捷网站 / 书签卡片管理
- 支持导入、导出书签和设置
- 可拖拽的时钟、搜索栏和快捷方式面板
- 多种时钟样式，包括数字时钟和模拟时钟
- 深色 / 浅色模式
- 多种视觉风格：默认、卡通、Win98、WinXP、终端风格
- 支持自定义强调色、文字颜色、圆角、透明度、模糊和字号
- 支持图片、GIF 和 MP4 视频壁纸
- 内置多语言：English、简体中文、한국어、日本語、ไทย、Bahasa Melayu
- 右键菜单可将当前页面保存到 Lunar Start Page
- 内置调试工具，方便检查浏览器兼容性和本地数据

## 支持的浏览器

本插件使用 Manifest V3，主要面向 Chromium 系浏览器：

- Google Chrome
- Microsoft Edge
- Brave
- 其他支持 Manifest V3 的 Chromium 浏览器

Firefox 对 Manifest V3 的支持和 Chromium 不完全一致，部分功能可能需要额外适配。

## 安装使用

### 开发者模式安装

1. 下载或克隆本项目到本地。
2. 打开浏览器扩展管理页面：
   - Chrome：`chrome://extensions/`
   - Edge：`edge://extensions/`
3. 打开右上角的「开发者模式」。
4. 点击「加载已解压的扩展程序」。
5. 选择本项目文件夹。
6. 打开新标签页，即可看到 Lunar Start Page。

### 使用 CRX 文件安装

如果你已经有 `.crx` 文件，可以在扩展管理页面中开启「开发者模式」，然后将 `.crx` 文件拖入浏览器窗口安装。

注意：部分浏览器可能会限制非商店来源的 `.crx` 安装。如果无法安装，建议使用「加载已解压的扩展程序」方式。

## 基本使用说明

### 搜索

在主页中间的搜索框输入关键词后回车即可搜索。可以在设定菜单中切换默认搜索引擎，也可以开启或关闭搜索建议。

### 快捷网站

点击添加按钮可以新增快捷网站。每个快捷方式可以设置名称和网址，适合作为常用网站入口。

### 右键保存页面

安装插件后，在网页中右键可以看到「Save This Page to Lunar Start」。点击后，当前页面会被加入 Lunar Start Page 的待保存链接中。

### 外观设定

点击主页右上角的 Settings / 设定 按钮，可以调整：

- 语言
- 深色 / 浅色模式
- UI 风格
- 按钮颜色和字体颜色
- 字号、圆角、透明度和模糊
- 时钟显示和时钟样式
- 搜索栏、快捷方式区域是否显示
- 快捷方式网格列数、行数、间距和卡片高度

### 壁纸

设定菜单中可以选择内置壁纸，也可以上传自己的图片、GIF 或 MP4 视频作为背景。

建议使用较小体积的图片或视频。过大的文件可能因为浏览器本地存储限制而无法保存。

### 备份与恢复

在设定菜单的 Backup / 备份 区域，可以导出当前配置，也可以导入之前保存的备份文件。

## 打包说明

### 打包为商店上传用 ZIP

上传 Chrome Web Store 或 Edge Add-ons 时，需要使用 `.zip` 文件。压缩包第一层必须直接包含 `manifest.json`，不要把整个外层文件夹套进去。

需要包含的主要内容：

```text
manifest.json
home.html
unsupported.html
background.js
styles.css
script/
data/
resource/
themes/
```

PowerShell 示例：

```powershell
Compress-Archive -LiteralPath @('manifest.json','home.html','unsupported.html','background.js','styles.css','script','data','resource','themes') -DestinationPath 'Lunar-Start-Page.zip' -Force
```

### 打包为本地安装用 CRX

在 Chrome / Edge 扩展管理页面中点击「打包扩展程序」，选择项目根目录即可生成 `.crx` 文件和 `.pem` 私钥文件。

`.crx` 是扩展安装包，`.pem` 是更新同一个扩展时需要用到的私钥。请妥善保存 `.pem`，不要公开发布。

## 项目结构

```text
.
├── manifest.json
├── home.html
├── background.js
├── styles.css
├── script/
├── data/language/
├── resource/
└── themes/
```

## 开发说明

本项目主要使用原生 HTML、CSS 和 JavaScript 编写，不依赖构建工具。修改文件后，在浏览器扩展管理页面点击刷新扩展，再打开新标签页查看效果。

## 许可证

如果你计划公开发布项目，建议在仓库中补充明确的开源许可证文件，例如 MIT License。

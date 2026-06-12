(function () {
  var params = parseQuery();
  var browserId = params.browser || "unknown";
  var chromeVersion = params.chrome || "";
  var reasons = params.reasons ? params.reasons.split(",") : [];
  var chineseBrowser = params.chinese === "1" || isChineseBrowserId(browserId);
  var useChinese = chineseBrowser || /^zh/i.test(navigator.language || "");
  var text = useChinese ? getChineseText() : getEnglishText();
  var browserName = useChinese ? getChineseBrowserName(browserId) : getEnglishBrowserName(browserId);

  document.documentElement.lang = useChinese ? "zh-CN" : "en";
  document.title = text.title;
  setText("badge", text.badge);
  setText("title", text.title);
  setText("description", interpolate(text.description, { browser: browserName }));
  setText("features-title", text.featuresTitle);
  setText("retry-link", useChinese ? "重新检测" : "Retry detection");
  setText("meta", text.meta);

  renderList("feature-list", getFeatureItems(reasons, text, chromeVersion));

  function parseQuery() {
    var result = {};
    var query = window.location.search ? window.location.search.substring(1) : "";
    if (!query) return result;
    var pairs = query.split("&");
    for (var index = 0; index < pairs.length; index += 1) {
      var pair = pairs[index].split("=");
      var name = decodeValue(pair[0] || "");
      var value = decodeValue(pair.slice(1).join("=") || "");
      if (name) result[name] = value;
    }
    return result;
  }

  function decodeValue(value) {
    try {
      return decodeURIComponent(String(value).replace(/\+/g, " "));
    } catch (error) {
      return value;
    }
  }

  function setText(id, value) {
    var node = document.getElementById(id);
    if (node) node.innerHTML = "";
    if (node) node.appendChild(document.createTextNode(value));
  }

  function renderList(id, items) {
    var list = document.getElementById(id);
    if (!list) return;
    list.innerHTML = "";
    for (var index = 0; index < items.length; index += 1) {
      var item = document.createElement("li");
      item.appendChild(document.createTextNode(items[index]));
      list.appendChild(item);
    }
  }

  function getFeatureItems(reasonList, textMap, version) {
    var items = [];
    var reasonMap = {};
    for (var index = 0; index < reasonList.length; index += 1) {
      reasonMap[reasonList[index]] = true;
    }

    if (reasonMap["ie-mode"]) items.push(textMap.features.ieMode);
    if (reasonMap["modern-js"]) items.push(textMap.features.modernJs);
    if (reasonMap["old-chromium"]) items.push(interpolate(textMap.features.oldChromium, { version: version || "-" }));
    if (reasonMap["structured-clone"]) items.push(textMap.features.structuredClone);
    if (reasonMap["random-uuid"]) items.push(textMap.features.randomUuid);
    if (reasonMap.dialog) items.push(textMap.features.dialog);
    if (reasonMap.indexeddb) items.push(textMap.features.indexedDb);

    items.push(textMap.features.search);
    items.push(textMap.features.wallpaper);
    items.push(textMap.features.visuals);

    return dedupe(items);
  }

  function dedupe(items) {
    var result = [];
    var seen = {};
    for (var index = 0; index < items.length; index += 1) {
      if (seen[items[index]]) continue;
      seen[items[index]] = true;
      result.push(items[index]);
    }
    return result;
  }

  function interpolate(template, vars) {
    var message = template;
    for (var name in vars) {
      if (Object.prototype.hasOwnProperty.call(vars, name)) {
        message = message.replace(new RegExp("\\{" + name + "\\}", "g"), String(vars[name]));
      }
    }
    return message;
  }

  function isChineseBrowserId(id) {
    return /^(360|2345|sogou|qq|liebao|maxthon|baidu|uc|theworld|chinese-browser)$/.test(id || "");
  }

  function getChineseBrowserName(id) {
    var names = {
      "360": "360浏览器",
      "2345": "2345浏览器",
      "sogou": "搜狗浏览器",
      "qq": "QQ浏览器",
      "liebao": "猎豹浏览器",
      "maxthon": "傲游浏览器",
      "baidu": "百度浏览器",
      "uc": "UC浏览器",
      "theworld": "世界之窗浏览器",
      "chinese-browser": "国产双核浏览器",
      "firefox": "Firefox",
      "chromium": "Chromium",
      "unknown": "当前浏览器"
    };
    return names[id] || names.unknown;
  }

  function getEnglishBrowserName(id) {
    var names = {
      "360": "360 Browser",
      "2345": "2345 Browser",
      "sogou": "Sogou Browser",
      "qq": "QQ Browser",
      "liebao": "Liebao Browser",
      "maxthon": "Maxthon",
      "baidu": "Baidu Browser",
      "uc": "UC Browser",
      "theworld": "TheWorld Browser",
      "chinese-browser": "Chinese dual-core browser",
      "firefox": "Firefox",
      "chromium": "Chromium",
      "unknown": "this browser"
    };
    return names[id] || names.unknown;
  }

  function getChineseText() {
    return {
      badge: "已阻止加载主页面",
      title: "浏览器或内核版本过旧",
      description: "{browser} 无法正常运行该插件。请更新到最新浏览器或内核版本，否则无法正常使用。",
      featuresTitle: "无法使用的功能",
      meta: "为了避免错误，主页面脚本没有加载。",
      features: {
        ieMode: "当前可能是兼容模式/IE 内核，主页脚本、设置和搜索功能无法可靠运行。",
        modernJs: "浏览器不支持现代 JavaScript 语法，主页面可能无法启动。",
        oldChromium: "Chromium 内核版本过旧（{version}），设置、壁纸和弹窗功能可能异常。",
        structuredClone: "缺少 structuredClone，保存的设置和默认数据可能无法读取。",
        randomUuid: "缺少 crypto.randomUUID，新建快捷方式和保存页面可能无法生成可靠 ID。",
        dialog: "缺少原生弹窗支持，设置、添加站点、图片搜索上传窗口可能无法打开。",
        indexedDb: "IndexedDB 不可用，自定义壁纸和视频壁纸可能无法保存。",
        search: "搜索建议和多搜索引擎联想可能无法正常请求或显示。",
        wallpaper: "自定义壁纸、GIF、MP4 视频壁纸可能无法保存或播放。",
        visuals: "主题颜色、毛玻璃、动态视觉效果可能与预期不同。"
      }
    };
  }

  function getEnglishText() {
    return {
      badge: "Main page blocked",
      title: "Browser or engine is too old",
      description: "{browser} cannot run this extension normally. Update to the latest browser or engine version before using it.",
      featuresTitle: "Unavailable features",
      meta: "The main page scripts were not loaded to avoid errors.",
      features: {
        ieMode: "The page appears to be using Compatibility/IE mode, so app scripts, settings, and search cannot run reliably.",
        modernJs: "The browser does not support modern JavaScript syntax, so the main page may not start.",
        oldChromium: "The Chromium engine is too old ({version}), so settings, wallpapers, and dialogs may fail.",
        structuredClone: "structuredClone is missing, so saved settings and default data may fail to load.",
        randomUuid: "crypto.randomUUID is missing, so new shortcuts and saved pages may not get reliable IDs.",
        dialog: "Native dialog support is missing, so settings, add-site, and image upload dialogs may not open.",
        indexedDb: "IndexedDB is unavailable, so custom wallpapers and video wallpapers may not be saved.",
        search: "Search suggestions and multi-engine suggestions may not request or display correctly.",
        wallpaper: "Custom wallpapers, GIFs, and MP4 live wallpapers may not save or play.",
        visuals: "Theme colors, backdrop blur, and dynamic visual effects may render differently."
      }
    };
  }
}());

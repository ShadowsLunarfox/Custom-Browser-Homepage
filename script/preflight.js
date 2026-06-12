(function () {
  var CACHE_KEY = "lunarBrowserPreflightCache:v2";
  var CACHE_SCHEMA = "lunar-preflight-v2";
  var ua = navigator.userAgent || "";
  var isIeMode = /MSIE|Trident/i.test(ua);
  var chromeMatch = ua.match(/(?:Chrome|Chromium|CriOS)\/(\d+)/i);
  var chromeMajor = chromeMatch ? parseInt(chromeMatch[1], 10) : 0;
  var knownChineseBrowser = /(360SE|360EE|QihooBrowser|QHBrowser|360Browser|2345Explorer|2345Chrome|MetaSr|Sogou|SogouExplorer|SOGO|SOGOU|QQBrowser|MQQBrowser|LBBROWSER|LieBao|Maxthon|BIDUBrowser|BaiduBrowser|UBrowser|UCBrowser|TheWorld)/i.test(ua);
  var browserId = detectBrowserId(ua, knownChineseBrowser);
  var signature = createBrowserSignature(ua, browserId, chromeMajor, isIeMode, knownChineseBrowser);
  var cachedResult = readPreflightCache(signature);

  if (cachedResult) {
    applyPreflightResult(cachedResult);
    return;
  }

  var reasons = [];

  if (isIeMode) {
    reasons.push("ie-mode");
  }
  if (chromeMajor > 0 && chromeMajor < 98) {
    reasons.push("old-chromium");
  }
  if (chromeMajor > 0 && chromeMajor < 80) {
    reasons.push("modern-js");
  }
  if (typeof window.structuredClone !== "function") {
    reasons.push("structured-clone");
  }
  if (!(window.crypto && window.crypto.randomUUID)) {
    reasons.push("random-uuid");
  }
  if (!(window.HTMLDialogElement && window.HTMLDialogElement.prototype && typeof window.HTMLDialogElement.prototype.showModal === "function")) {
    reasons.push("dialog");
  }
  if (typeof window.indexedDB === "undefined") {
    reasons.push("indexeddb");
  }

  var result = {
    schema: CACHE_SCHEMA,
    signature: signature,
    chromeMajor: chromeMajor,
    isIeMode: isIeMode,
    knownChineseBrowser: knownChineseBrowser,
    needsLegacyNotice: reasons.length > 0,
    severeReasons: reasons.slice(0),
    browserId: browserId,
    checkedAt: Date.now()
  };

  writePreflightCache(result);
  applyPreflightResult(result);

  function applyPreflightResult(result) {
    window.__lunarBrowserPreflight = {
      chromeMajor: result.chromeMajor,
      isIeMode: result.isIeMode,
      knownChineseBrowser: result.knownChineseBrowser,
      needsLegacyNotice: result.needsLegacyNotice,
      severeReasons: result.severeReasons || [],
      browserId: result.browserId
    };

    if (!result.needsLegacyNotice) return;

    window.__lunarBlockMainPage = true;
    addUnsupportedRedirectClass();
    window.location.replace(
      "unsupported.html"
      + "?browser=" + encodeURIComponent(result.browserId || "unknown")
      + "&chrome=" + encodeURIComponent(String(result.chromeMajor || ""))
      + "&chinese=" + (result.knownChineseBrowser ? "1" : "0")
      + "&reasons=" + encodeURIComponent((result.severeReasons || []).join(","))
    );
  }

  function readPreflightCache(signature) {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var cached = JSON.parse(raw);
      if (!cached || cached.schema !== CACHE_SCHEMA) return null;
      if (cached.signature !== signature) return null;
      if (!Array.isArray(cached.severeReasons)) return null;
      return cached;
    } catch (error) {
      return null;
    }
  }

  function writePreflightCache(result) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(result));
    } catch (error) {
      // If storage is blocked, run the preflight normally each time.
    }
  }

  function createBrowserSignature(userAgent, id, major, ieMode, chineseBrowser) {
    return [
      CACHE_SCHEMA,
      id || "unknown",
      String(major || 0),
      ieMode ? "ie" : "modern",
      chineseBrowser ? "cn" : "global",
      userAgent
    ].join("|");
  }

  function addUnsupportedRedirectClass() {
    if (document.documentElement.className.indexOf("app-unsupported-redirect") !== -1) return;
    document.documentElement.className += " app-unsupported-redirect";
  }

  function detectBrowserId(userAgent, isKnownChineseBrowser) {
    var matchers = [
      ["firefox", /\b(Firefox|FxiOS)\b/i],
      ["360", /\b(360SE|360EE|QihooBrowser|QHBrowser|360Browser)\b|Qihoo|QIHU/i],
      ["2345", /\b(2345Explorer|2345Chrome)\b/i],
      ["sogou", /\b(MetaSr|SogouMobileBrowser|Sogou|SogouExplorer|SOGO|SOGOU)\b|SE 2\.X/i],
      ["qq", /\b(QQBrowser|MQQBrowser|TencentTraveler)\b/i],
      ["liebao", /\b(LBBROWSER|LieBaoFast|LieBao)\b/i],
      ["maxthon", /\b(Maxthon|MxBrowser|MxNitro)\b/i],
      ["baidu", /\b(BIDUBrowser|BaiduBrowser|BaiduHD)\b/i],
      ["uc", /\b(UBrowser|UCBrowser)\b/i],
      ["theworld", /\bTheWorld\b/i]
    ];

    for (var index = 0; index < matchers.length; index += 1) {
      if (matchers[index][1].test(userAgent)) {
        return matchers[index][0];
      }
    }

    if (isKnownChineseBrowser) return "chinese-browser";
    if (chromeMajor) return "chromium";
    return "unknown";
  }
}());

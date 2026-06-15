(function () {
  if (window.__lunarBlockMainPage) return;

  var STORAGE_KEY = "customHomeState";
  var CHROME_BACKGROUND_VALUE = "__chrome_storage_background__";
  var THEME_STYLE_FILES = {
    default: "",
    cartoon: "themes/theme-cartoon.css",
    win98: "themes/theme-win98.css",
    winxp: "themes/theme-winxp.css",
    terminal: "themes/theme-terminal.css"
  };
  var PRESET_WALLPAPERS = {
    wallpaper_1: { path: "themes/wallpaper/wallpaperflare.com_wallpaper (1).jpg", mediaType: "image" },
    wallpaper_2: { path: "themes/wallpaper/wallpaperflare.com_wallpaper (2).jpg", mediaType: "image" },
    wallpaper_3: { path: "themes/wallpaper/wallpaperflare.com_wallpaper.jpg", mediaType: "image" },
    komainu_desktop: { path: "themes/wallpaper/Mp4/Komainu_Desktop.mp4", mediaType: "video" }
  };
  var DEFAULTS = {
    theme: "dark",
    themeStyle: "default",
    accentColor: "#7dc4ff",
    textColorDark: "#f3f6ff",
    textColorLight: "#182338",
    fontScale: 100,
    radius: 20,
    panelBlur: 22,
    cardGap: 16,
    cardHeight: 208,
    panelOpacity: 82
  };

  var state = readState();
  var settings = state.settings || {};
  var body = document.body;
  var root = document.documentElement;

  applyTheme(settings, body, root);
  applyThemeStyle(settings);
  applyWallpaper(state.background, body, root);

  function readState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) || {} : {};
    } catch (error) {
      return {};
    }
  }

  function applyTheme(settings, body, root) {
    var theme = settings.theme === "light" ? "light" : "dark";
    var accent = normalizeHexColor(settings.accentColor, DEFAULTS.accentColor);
    var textFallback = theme === "light" ? DEFAULTS.textColorLight : DEFAULTS.textColorDark;
    var textColor = resolveThemeTextColor(settings.textColor, theme, textFallback);
    var softText = mixHex(textColor, theme === "dark" ? "#8f99ae" : "#5e6a81", 0.44);
    var panelOpacity = clampNumber(settings.panelOpacity, 45, 100, DEFAULTS.panelOpacity) / 100;
    var panelStrongOpacity = Math.min(1, panelOpacity + 0.08);
    var panelSoftOpacity = Math.min(1, Math.max(0.44, panelOpacity - 0.08));

    body.dataset.theme = theme;
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--accent-strong", mixHex(accent, theme === "dark" ? "#ffffff" : "#000000", theme === "dark" ? 0.12 : 0.16));
    root.style.setProperty("--accent-muted", mixHex(accent, theme === "dark" ? "#0f1421" : "#ffffff", theme === "dark" ? 0.66 : 0.38));
    root.style.setProperty("--accent-ink", pickReadableTextColor(accent));
    root.style.setProperty("--text-main", textColor);
    root.style.setProperty("--text-soft", softText);
    root.style.setProperty("--font-scale", String(clampNumber(settings.fontScale, 90, 120, DEFAULTS.fontScale) / 100));
    root.style.setProperty("--ui-radius-xl", clampNumber(settings.radius, 8, 32, DEFAULTS.radius) + "px");
    root.style.setProperty("--ui-radius-lg", Math.max(6, clampNumber(settings.radius, 8, 32, DEFAULTS.radius) - 4) + "px");
    root.style.setProperty("--ui-radius-md", Math.max(4, clampNumber(settings.radius, 8, 32, DEFAULTS.radius) - 8) + "px");
    root.style.setProperty("--panel-blur", clampNumber(settings.panelBlur, 0, 30, DEFAULTS.panelBlur) + "px");
    root.style.setProperty("--card-gap", clampNumber(settings.cardGap, 8, 28, DEFAULTS.cardGap) + "px");
    root.style.setProperty("--card-height", clampNumber(settings.cardHeight, 160, 280, DEFAULTS.cardHeight) + "px");
    root.style.setProperty("--clock-display", settings.clockVisible === false ? "none" : "grid");

    if (theme === "light") {
      root.style.setProperty("--panel", "rgba(255, 255, 255, " + panelOpacity + ")");
      root.style.setProperty("--panel-strong", "rgba(255, 255, 255, " + panelStrongOpacity + ")");
      root.style.setProperty("--panel-soft", "rgba(238, 243, 255, " + Math.max(0.68, panelStrongOpacity) + ")");
    } else {
      root.style.setProperty("--panel", "rgba(28, 36, 56, " + panelOpacity + ")");
      root.style.setProperty("--panel-strong", "rgba(38, 47, 72, " + panelStrongOpacity + ")");
      root.style.setProperty("--panel-soft", "rgba(50, 61, 92, " + panelSoftOpacity + ")");
    }

    body.classList.toggle("search-ui-hidden", settings.searchUiVisible === false);
    body.classList.toggle("shortcuts-ui-hidden", settings.shortcutsVisible === false);
  }

  function applyThemeStyle(settings) {
    var styleKey = settings.themeStyle in THEME_STYLE_FILES ? settings.themeStyle : DEFAULTS.themeStyle;
    var href = THEME_STYLE_FILES[styleKey];
    var link = document.getElementById("theme-style-link");
    document.body.dataset.themeStyle = styleKey;
    if (link && href) {
      link.href = href;
    }
  }

  function applyWallpaper(background, body, root) {
    var value = background && background.value;
    var type = background && background.type;
    var mediaType = background && background.mediaType;

    if (type === "image" && value && value !== CHROME_BACKGROUND_VALUE) {
      if (mediaType === "video") {
        setInitialVideoWallpaper(value, body, "custom");
      } else {
        setInitialWallpaper(value, body, root, "custom");
      }
      return;
    }

    if (type === "preset" && PRESET_WALLPAPERS[value]) {
      if (value === "wallpaper_1" && background.selectedByUser !== true) return;
      var preset = PRESET_WALLPAPERS[value];
      if (preset.mediaType === "image") {
        setInitialWallpaper(preset.path, body, root, value);
      } else if (preset.mediaType === "video") {
        setInitialVideoWallpaper(preset.path, body, value);
      }
      return;
    }
  }

  function setInitialWallpaper(path, body, root, key) {
    body.classList.add(key === "custom" ? "has-custom-background" : "has-preset-wallpaper");
    if (key !== "custom") {
      body.dataset.wallpaperPreset = key;
    }
    root.style.setProperty("--initial-wallpaper-image", 'url("' + escapeCssUrl(path) + '")');
    preloadImage(path);
  }

  function setInitialVideoWallpaper(path, body, key) {
    body.classList.add("has-custom-background-video");
    body.classList.add(key === "custom" ? "has-custom-background" : "has-preset-wallpaper");
    if (key !== "custom") {
      body.dataset.wallpaperPreset = key;
    }
  }

  function preloadImage(path) {
    if (!path || /^data:/i.test(path)) return;
    var link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = path;
    link.fetchPriority = "high";
    link.setAttribute("fetchpriority", "high");
    document.head.appendChild(link);
  }

  function normalizeHexColor(value, fallback) {
    if (typeof value !== "string") return fallback;
    var hex = value.trim();
    return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : fallback;
  }

  function resolveThemeTextColor(value, theme, fallback) {
    var normalized = normalizeHexColor(value, fallback);
    if (theme === "light" && normalized === DEFAULTS.textColorDark) return DEFAULTS.textColorLight;
    if (theme === "dark" && normalized === DEFAULTS.textColorLight) return DEFAULTS.textColorDark;
    return normalized;
  }

  function clampNumber(value, min, max, fallback) {
    var number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function hexToRgb(hex) {
    var safeHex = normalizeHexColor(hex, "#000000").slice(1);
    return {
      r: parseInt(safeHex.slice(0, 2), 16),
      g: parseInt(safeHex.slice(2, 4), 16),
      b: parseInt(safeHex.slice(4, 6), 16)
    };
  }

  function rgbToHex(rgb) {
    var channels = [rgb.r, rgb.g, rgb.b].map(function (channel) {
      return Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0");
    });
    return "#" + channels.join("");
  }

  function mixHex(colorA, colorB, ratio) {
    var a = hexToRgb(colorA);
    var b = hexToRgb(colorB);
    var blend = Math.max(0, Math.min(1, Number(ratio) || 0));
    return rgbToHex({
      r: a.r + ((b.r - a.r) * blend),
      g: a.g + ((b.g - a.g) * blend),
      b: a.b + ((b.b - a.b) * blend)
    });
  }

  function pickReadableTextColor(hex) {
    var rgb = hexToRgb(hex);
    var luminance = (0.299 * rgb.r) + (0.587 * rgb.g) + (0.114 * rgb.b);
    return luminance > 165 ? "#111827" : "#f9fbff";
  }

  function escapeCssUrl(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
}());

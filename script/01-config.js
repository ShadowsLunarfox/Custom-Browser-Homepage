// App storage and theme registries.
const STORAGE_KEY = "customHomeState";
const BROWSER_PREFLIGHT_CACHE_KEY = "lunarBrowserPreflightCache:v2";
const FIREFOX_COMPAT_NOTICE_ACK_KEY = "firefoxCompatibilityNoticeAcknowledged:v1";
const BROWSER_COMPAT_NOTICE_ACK_PREFIX = "browserCompatibilityNoticeAcknowledged:v1:";
const DATA_VERSION = 3;
const PENDING_LINKS_KEY = "pendingSavedLinks";
const PENDING_LINK_IDS_KEY = "pendingSavedLinkIds";
const PENDING_LINK_KEY_PREFIX = "pendingSavedLink:";
const BACKGROUND_IMAGE_KEY = "customBackgroundImageDataUrl";
const CHROME_BACKGROUND_VALUE = "__chrome_storage_background__";
const BACKGROUND_DB_NAME = "lunarStartBackgrounds";
const BACKGROUND_DB_VERSION = 1;
const BACKGROUND_DB_STORE = "assets";
const BACKGROUND_DB_RECORD_KEY = "active";
const LANGUAGE_BASE_PATH = "data/language";
const DEFAULT_LANGUAGE = "en";
const SUPPORTED_LANGUAGES = ["en", "zh-CN", "ko", "ja", "th", "ms"];
const MAX_BACKGROUND_DIMENSION = 2560;
const MAX_BACKGROUND_DATA_URL_LENGTH = 3_500_000;
const MAX_BACKGROUND_VIDEO_DATA_URL_LENGTH = 24_000_000;
const MAX_SEARCH_HISTORY = 12;
const SEARCH_SUGGESTION_DEBOUNCE_MS = 180;
const GOOGLE_IMAGE_SEARCH_UPLOAD_URL = "https://www.google.com/searchbyimage/upload";
const DEFAULT_SEARCH_SUGGESTIONS = [
  "youtube music",
  "gmail inbox",
  "github trending",
  "weather today",
  "google translate",
  "chatgpt",
  "news today",
  "calendar",
  "maps",
  "amazon",
  "netflix",
  "spotify",
  "reddit",
  "stackoverflow",
  "bing image creator",
  "vrchat",
  "vrc world",
  "vrc avatar",
  "vrc group"
];

const SEARCH_ENGINES = {
  google: { url: "https://www.google.com/search?q=%s", label: "Google", color: "#4285f4", icon: "resource/icons/logo/google.ico", category: "mainstream" },
  duckduckgo: { url: "https://duckduckgo.com/?q=%s", label: "DuckDuckGo", color: "#de5833", icon: "resource/icons/logo/duckduckgo.ico", category: "mainstream" },
  bing: { url: "https://www.bing.com/search?q=%s", label: "Bing", color: "#008373", icon: "resource/icons/logo/bing.ico", category: "mainstream" },
  brave: { url: "https://search.brave.com/search?q=%s", label: "Brave", color: "#fb542b", icon: "resource/icons/logo/brave.ico", category: "niche" },
  yahoo: { url: "https://search.yahoo.com/search?p=%s", label: "Yahoo", color: "#6001d2", icon: "resource/icons/logo/yahoo.ico", category: "mainstream" },
  yandex: { url: "https://yandex.com/search/?text=%s", label: "Yandex", color: "#fc3f1d", icon: "resource/icons/logo/yandex.ico", category: "niche" },
  naver: { url: "https://search.naver.com/search.naver?query=%s", label: "Naver", color: "#03c75a", icon: "resource/icons/logo/naver.ico", category: "niche" },
  ecosia: { url: "https://www.ecosia.org/search?q=%s", label: "Ecosia", color: "#2d7d46", icon: "resource/icons/logo/ecosia.ico", category: "niche" },
  startpage: { url: "https://www.startpage.com/do/search?query=%s", label: "Startpage", color: "#6573ff", icon: "resource/icons/logo/startpage.ico", category: "niche" },
  qwant: { url: "https://www.qwant.com/?q=%s", label: "Qwant", color: "#5c97ff", icon: "resource/icons/logo/qwant.ico", category: "niche" },
  mojeek: { url: "https://www.mojeek.com/search?q=%s", label: "Mojeek", color: "#7ab51d", icon: "resource/icons/logo/mojeek.png", category: "niche" },
  yep: { url: "https://yep.com/web?q=%s", label: "Yep", color: "#ff5c35", icon: "resource/icons/logo/yep.png", category: "niche" },
  swisscows: { url: "https://swisscows.com/en/web?query=%s", label: "Swisscows", color: "#b63591", icon: "resource/icons/logo/swisscows.png", category: "niche" },
  daum: { url: "https://search.daum.net/search?q=%s", label: "Daum", color: "#4b65f6", icon: "resource/icons/logo/daum.png", category: "niche" },
  seznam: { url: "https://search.seznam.cz/?q=%s", label: "Seznam", color: "#cc0000", icon: "resource/icons/logo/seznam.png", category: "niche" },
  wolframalpha: { url: "https://www.wolframalpha.com/input?i=%s", label: "WolframAlpha", color: "#dd1100", icon: "resource/icons/logo/wolframalpha.png", category: "niche" },
  perplexity: { url: "https://www.perplexity.ai/search?q=%s", label: "Perplexity", color: "#20a39e", icon: "resource/icons/logo/perplexity.ico", category: "caution" },
  you: { url: "https://you.com/search?q=%s", label: "You.com", color: "#7c3aed", icon: "resource/icons/logo/you.ico", category: "caution" },
  presearch: { url: "https://presearch.com/search?q=%s", label: "Presearch", color: "#2f80ed", icon: "resource/icons/logo/presearch.png", category: "caution" },
  searxng: { url: "https://search.privacyredirect.com/search?q=%s", label: "SearXNG", color: "#3050ff", icon: "resource/icons/logo/searxng.svg", category: "caution" },
  bing_cn: { url: "https://cn.bing.com/search?q=%s", label: "Bing China", color: "#008373", icon: "resource/icons/logo/bing-cn.ico", category: "niche" },
  baidu: { url: "https://www.baidu.com/s?wd=%s", label: "Baidu", color: "#2932e1", icon: "resource/icons/logo/baidu.ico", category: "mainstream" },
  sogou: { url: "https://www.sogou.com/web?query=%s", label: "Sogou", color: "#ff6a00", icon: "resource/icons/logo/sogou.ico", category: "mainstream" },
  so360: { url: "https://www.so.com/s?q=%s", label: "360 Search", color: "#19b955", icon: "resource/icons/logo/so360.ico", category: "mainstream" },
  shenma: { url: "https://m.sm.cn/s?q=%s", label: "Shenma", color: "#ff7a1a", icon: "resource/icons/logo/shenma.ico", category: "caution" },
  toutiao: { url: "https://so.toutiao.com/search?keyword=%s", label: "Toutiao", color: "#f04142", icon: "resource/icons/logo/toutiao.ico", category: "caution" },
  quark: { url: "https://quark.sm.cn/s?q=%s", label: "Quark", color: "#1f6bff", icon: "resource/icons/logo/quark.ico", category: "caution" }
};

const SEARCH_ENGINE_CATEGORY_ORDER = ["mainstream", "niche", "caution"];

const PRESETS = {
  wallpaper_1: {
    path: "themes/wallpaper/wallpaperflare.com_wallpaper (1).jpg",
    label: "Wallpaper 1",
    mediaType: "image"
  },
  wallpaper_2: {
    path: "themes/wallpaper/wallpaperflare.com_wallpaper (2).jpg",
    label: "Wallpaper 2",
    mediaType: "image"
  },
  wallpaper_3: {
    path: "themes/wallpaper/wallpaperflare.com_wallpaper.jpg",
    label: "Wallpaper 3",
    mediaType: "image"
  },
  komainu_desktop: {
    path: "themes/wallpaper/Mp4/Komainu_Desktop.mp4",
    label: "Komainu Desktop",
    mediaType: "video"
  }
};

const PRESET_LABELS = {
  wallpaper_1: "Wallpaper 1",
  wallpaper_2: "Wallpaper 2",
  wallpaper_3: "Wallpaper 3",
  komainu_desktop: "Komainu Desktop"
};

const THEME_STYLE_FILES = {
  default: "",
  cartoon: "themes/theme-cartoon.css",
  win98: "themes/theme-win98.css",
  winxp: "themes/theme-winxp.css",
  terminal: "themes/theme-terminal.css"
};

const THEME_FONT_FILES = {
  cartoon: "https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;600;700;800&family=Nunito:wght@500;700;800&family=Noto+Sans+SC:wght@400;500;700&display=swap"
};

const THEME_TEXT_DEFAULTS = {
  dark: "#f3f6ff",
  light: "#182338"
};

const PANEL_COLOR_DEFAULTS = {
  dark: "#1c2438",
  light: "#ffffff"
};

const DROPDOWN_COLOR_DEFAULTS = {
  dark: "#26304a",
  light: "#ffffff"
};

const SLIDER_TRACK_COLOR_DEFAULTS = {
  dark: "#33405e",
  light: "#d8e3f5"
};

const CLOCK_STYLES = [
  "classic",
  "compact",
  "stacked",
  "pill",
  "panel",
  "calendar",
  "neon",
  "analog",
  "analog-minimal",
  "analog-bold"
];

const DEFAULT_SETTINGS = {
  theme: "dark",
  themeStyle: "default",
  accentColor: "#7dc4ff",
  textColor: THEME_TEXT_DEFAULTS.dark,
  panelColor: "#1c2438",
  dropdownColor: "#26304a",
  sliderTrackColor: "#33405e",
  sliderFillColor: "#7dc4ff",
  fontScale: 100,
  radius: 20,
  panelBlur: 22,
  searchSuggestionsEnabled: true,
  searchSuggestionsAllEnginesEnabled: false,
  searchSuggestionEngineKeys: ["google", "bing", "baidu"],
  searchUiVisible: true,
  shortcutsVisible: true,
  clockVisible: true,
  clockStyle: "classic",
  columns: 6,
  rows: 2,
  cardGap: 16,
  cardHeight: 208,
  panelOpacity: 82,
  panelPositions: {
    clock: { x: 0, y: 0 },
    search: { x: 0, y: 0 },
    collection: { x: 0, y: 0 }
  },
  panelDesiredPositions: {
    clock: { x: 0, y: 0 },
    search: { x: 0, y: 0 },
    collection: { x: 0, y: 0 }
  },
  panelScales: {
    clock: 1,
    search: 1,
    collection: 1
  }
};

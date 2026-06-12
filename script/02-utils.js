// Small utility helpers.
function openDialog(id) {
  document.getElementById(id).showModal();
}

function closeDialog(id) {
  document.getElementById(id).close();
}

function bindOptionalEvent(element, eventName, handler) {
  if (!element || typeof element.addEventListener !== "function" || typeof handler !== "function") return;
  element.addEventListener(eventName, handler);
}

function bindOptionalClick(element, handler) {
  bindOptionalEvent(element, "click", handler);
}

function bindDialogBackdropClose(dialog) {
  if (!dialog || dialog.dataset.backdropCloseBound === "true") return;
  if (dialog.dataset.backdropClose === "false") return;

  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    const clickedInsideDialog = (
      event.clientX >= rect.left
      && event.clientX <= rect.right
      && event.clientY >= rect.top
      && event.clientY <= rect.bottom
    );

    if (!clickedInsideDialog) {
      dialog.close();
    }
  });

  dialog.dataset.backdropCloseBound = "true";
}

function normalizeUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function stripProtocol(url) {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function faviconForUrl(url) {
  try {
    const target = new URL(normalizeUrl(url));
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(target.hostname)}&sz=64`;
  } catch {
    return "";
  }
}

function findLinkById(id) {
  return state.links.find((link) => link.id === id) || null;
}

function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") return fallback;
  const hex = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toLowerCase();
  return fallback;
}

function resolveThemeTextColor(value, theme) {
  const normalized = normalizeHexColor(value, THEME_TEXT_DEFAULTS[theme]);
  if (theme === "light" && normalized === THEME_TEXT_DEFAULTS.dark) {
    return THEME_TEXT_DEFAULTS.light;
  }
  if (theme === "dark" && normalized === THEME_TEXT_DEFAULTS.light) {
    return THEME_TEXT_DEFAULTS.dark;
  }
  return normalized;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function clampValue(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function hexToRgb(hex) {
  const safeHex = normalizeHexColor(hex, "#000000").slice(1);
  return {
    r: parseInt(safeHex.slice(0, 2), 16),
    g: parseInt(safeHex.slice(2, 4), 16),
    b: parseInt(safeHex.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  const safe = [r, g, b].map((channel) => Math.max(0, Math.min(255, Math.round(channel))));
  return `#${safe.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function mixHex(colorA, colorB, ratio) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const blend = Math.max(0, Math.min(1, Number(ratio) || 0));
  return rgbToHex({
    r: a.r + ((b.r - a.r) * blend),
    g: a.g + ((b.g - a.g) * blend),
    b: a.b + ((b.b - a.b) * blend)
  });
}

function pickReadableTextColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
  return luminance > 165 ? "#111827" : "#f9fbff";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

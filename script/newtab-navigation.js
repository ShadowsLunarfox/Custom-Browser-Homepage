// Searches must leave the New Tab host, rather than loading a provider in its frame.
function getHomepageNavigationTarget() {
  try {
    const parent = window.parent;
    if (parent !== window
      && parent.location.origin === window.location.origin
      && /\/newtab\.html$/.test(parent.location.pathname)
      && parent.document.getElementById("lunar-start-frame")?.contentWindow === window) return parent;
  } catch { /* Direct pages and unrelated frames navigate themselves. */ }
  return window;
}

// Version selection only: each interface keeps its own application and appearance state.
(function () {
  var version = document.documentElement.dataset.interfaceVersion;
  var stateKeys = { modern: "customHomeState", legacy: "customHomeStateLegacy" };
  if (!stateKeys[version]) return;

  document.addEventListener("DOMContentLoaded", function () {
    var select = document.getElementById("interface-version");
    var status = document.getElementById("interface-version-note");
    if (!select) return;
    select.value = version;
    select.addEventListener("change", function () {
      var next = select.value;
      if (!stateKeys[next] || next === version) return;
      try {
        if (typeof window.flushPendingSettingChanges === "function") window.flushPendingSettingChanges();
        var target = readState(stateKeys[next]);
        // Seed a new legacy profile once. Existing profiles are never rewritten on a switch.
        if (next === "legacy" && localStorage.getItem(stateKeys.legacy) === null) {
          var source = readState(stateKeys.modern);
          ["links", "language", "searchEngine", "searchHistory", "background"].forEach(function (key) {
            if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
          });
          localStorage.setItem(stateKeys.legacy, JSON.stringify(target));
        }
        localStorage.setItem("lunarInterfaceVersion", next);
      } catch (error) {
        select.value = version;
        if (typeof window.syncCustomSelects === "function") window.syncCustomSelects();
        if (status) {
          status.textContent = typeof window.t === "function" ? window.t("interface_version.storage_error") : "Could not save the interface version. Please try again.";
          status.setAttribute("role", "alert");
        }
        return;
      }
      var destination = next === "legacy" ? "legacy/home.html" : "home.html";
      if (version === "legacy") destination = "../" + destination;
      window.location.replace(destination);
    });
  }, { once: true });

  function readState(key) {
    var raw = localStorage.getItem(key);
    if (!raw) return {};
    var value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid saved state");
    return value;
  }
}());

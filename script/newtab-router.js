// Resolve the saved version before requesting either interface's HTML, styles, or app code.
(function () {
  var version = "modern";
  try {
    if (localStorage.getItem("lunarInterfaceVersion") === "legacy") version = "legacy";
  } catch (error) {
    // Fresh profiles and blocked storage use the current interface.
  }
  window.location.replace(version === "legacy" ? "legacy/home.html" : "home.html");
}());

(function () {
  if (window.__lunarBlockMainPage) return;

  var scripts = [
    "script/01-config.js",
    "script/02-utils.js",
    "script/03-search.js",
    "script/04-collection.js",
    "script/05-ui.js",
    "script/06-i18n.js",
    "script/07-storage.js",
    "script/08-app.js"
  ];

  function loadScripts() {
    scripts.forEach(function (src) {
      var script = document.createElement("script");
      script.async = false;
      script.src = src;
      script.onload = function () {
        script.remove();
      };
      script.onerror = function () {
        script.remove();
      };
      document.body.appendChild(script);
    });
  }

  loadScripts();
}());

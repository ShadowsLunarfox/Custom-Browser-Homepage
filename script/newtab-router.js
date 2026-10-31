// Keep the browser's actual New Tab entry; load only the chosen interface inside it.
(function () {
  var version = "modern";
  try {
    if (localStorage.getItem("lunarInterfaceVersion") === "legacy") version = "legacy";
  } catch (error) {
    // Fresh profiles and blocked storage use the current interface.
  }
  var frame = document.createElement("iframe");
  frame.id = "lunar-start-frame";
  frame.title = "Lunar Start Page";
  frame.setAttribute("allow", "microphone; fullscreen");
  frame.src = version === "legacy" ? "legacy/home.html" : "home.html";
  document.body.appendChild(frame);
}());

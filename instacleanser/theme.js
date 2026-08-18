/* Theme toggle: system -> light -> dark.
   Only the *pre-paint* read has to be inline (it is, in each page's <head>).
   The wiring can load deferred, so it lives here instead of being copied into
   every page. Keep the storage key in sync with the inline snippet. */
(function () {
  var KEY = "instacleanser_theme";
  var CYCLE = ["system", "light", "dark"];
  var btn = document.getElementById("theme-toggle");
  if (!btn) return;

  function read() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" ? v : "system";
    } catch (e) {
      return "system";
    }
  }

  function apply(choice) {
    if (choice === "system") {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = choice;
    }

    btn.dataset.choice = choice;
    btn.title = "Theme: " + choice;
    btn.setAttribute("aria-label", "Theme: " + choice);

    try {
      if (choice === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch (e) {
      /* ignore */
    }
  }

  apply(read());

  btn.addEventListener("click", function () {
    apply(CYCLE[(CYCLE.indexOf(read()) + 1) % CYCLE.length]);
  });
})();

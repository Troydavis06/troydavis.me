/* ==========================================================================
   troydavis.me — theme, scroll-spy, clipboard, help dialog, key navigation

   Classic deferred script, not a module: type="module" is fetched with CORS
   and will not run from file://, and there is no build step here.

   The keyboard layer is an ENHANCEMENT. Everything it reaches is also
   reachable by mouse, touch, Tab, and a screen reader.
   ========================================================================== */
'use strict';

(function () {

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var srStatus = document.getElementById('sr-status');

  function announce(msg) {
    if (!srStatus) return;
    srStatus.textContent = '';
    // A tick of empty text makes repeat announcements of the same string fire.
    window.setTimeout(function () { srStatus.textContent = msg; }, 30);
  }

  function scrollBehavior() {
    return reduceMotion.matches ? 'auto' : 'smooth';
  }

  /* ------------------------------------------------------------------------
     THEME
     The inline <head> script has already resolved and applied a concrete
     data-theme. This only handles changes from here on.
     ------------------------------------------------------------------------ */
  var themeBtn  = document.getElementById('theme-btn');
  var themeIcon = document.getElementById('theme-icon');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var PAPER = { light: '#f4f1ea', dark: '#1c1a16' };

  function currentTheme() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme, persist) {
    root.setAttribute('data-theme', theme);
    if (themeMeta) themeMeta.setAttribute('content', PAPER[theme]);

    var next = theme === 'dark' ? 'light' : 'dark';
    if (themeIcon) themeIcon.textContent = next;
    if (themeBtn) {
      var label = themeBtn.querySelector('.visually-hidden');
      if (label) label.textContent = 'Switch to ' + next + ' theme';
    }
    if (persist) {
      try { localStorage.setItem('theme', theme); } catch (e) { /* private mode */ }
    }
  }

  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next, true);
    announce(next + ' theme');
  }

  applyTheme(currentTheme(), false);
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Follow the OS only while the visitor has expressed no preference of their own.
  var mqDark = window.matchMedia('(prefers-color-scheme: dark)');
  var onSystemTheme = function (e) {
    var stored = null;
    try { stored = localStorage.getItem('theme'); } catch (err) { /* ignore */ }
    if (stored !== 'light' && stored !== 'dark') {
      applyTheme(e.matches ? 'dark' : 'light', false);
    }
  };
  if (mqDark.addEventListener) mqDark.addEventListener('change', onSystemTheme);
  else if (mqDark.addListener) mqDark.addListener(onSystemTheme);

  /* ------------------------------------------------------------------------
     SCROLL-SPY — IntersectionObserver, never a scroll listener
     ------------------------------------------------------------------------ */
  var pathEl   = document.getElementById('path');
  var statusEl = document.getElementById('status-path');
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.topbar__nav a'));

  var SECTIONS = ['top', 'about', 'work', 'log', 'contact'];
  var PATHS = { top: '~/', about: '~/about', work: '~/work', log: '~/log', contact: '~/contact' };

  var sectionEls = SECTIONS
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

  var visible = Object.create(null);

  function paintPath() {
    // LAST section in document order currently inside the band wins — that is
    // the one whose top most recently crossed it. Taking the first instead
    // means a section you have just scrolled past keeps the label, because
    // its bottom edge still clips the band by a pixel or two.
    var id = null;
    for (var i = SECTIONS.length - 1; i >= 0; i--) {
      if (visible[SECTIONS[i]]) { id = SECTIONS[i]; break; }
    }
    if (!id) return;

    var label = PATHS[id] || '~/';
    if (pathEl) pathEl.textContent = label;
    if (statusEl) statusEl.textContent = label;

    for (var j = 0; j < navLinks.length; j++) {
      var match = navLinks[j].getAttribute('href') === '#' + id;
      if (match) navLinks[j].setAttribute('aria-current', 'true');
      else navLinks[j].removeAttribute('aria-current');
    }
  }

  if ('IntersectionObserver' in window && sectionEls.length) {
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        visible[entries[i].target.id] = entries[i].isIntersecting;
      }
      paintPath();
    }, {
      // A band just under the top bar, down to 35% of the viewport.
      rootMargin: '-40px 0px -65% 0px',
      threshold: 0
    });
    sectionEls.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------------
     CLIPBOARD
     ------------------------------------------------------------------------ */
  var copyBtn = document.getElementById('copy-email');

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:absolute;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function flashCopied(btn, ok) {
    if (!btn) return;
    var original = btn.textContent;
    btn.textContent = ok ? '[copied]' : '[press ctrl+c]';
    if (ok) btn.setAttribute('data-copied', '');
    window.setTimeout(function () {
      btn.textContent = original;
      btn.removeAttribute('data-copied');
    }, 2000);
  }

  function copyEmail() {
    if (!copyBtn) return;
    var text = copyBtn.getAttribute('data-copy') || '';
    if (!text) return;

    var done = function (ok) {
      flashCopied(copyBtn, ok);
      announce(ok ? 'Email address copied to clipboard' : 'Copy failed');
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { done(true); },
        function () { done(legacyCopy(text)); }
      );
    } else {
      done(legacyCopy(text));
    }
  }

  if (copyBtn) copyBtn.addEventListener('click', copyEmail);

  /* ------------------------------------------------------------------------
     HELP DIALOG
     ------------------------------------------------------------------------ */
  var help = document.getElementById('help');
  var helpClose = document.getElementById('help-close');
  var helpOpener = null;
  var canDialog = help && typeof help.showModal === 'function';

  function openHelp() {
    if (!canDialog || help.open) return;
    helpOpener = document.activeElement;
    help.showModal();          // native focus trap + Esc handling
  }

  function closeHelp() {
    if (!canDialog || !help.open) return;
    help.close();
  }

  if (canDialog) {
    if (helpClose) helpClose.addEventListener('click', closeHelp);
    help.addEventListener('close', function () {
      if (helpOpener && document.contains(helpOpener)) helpOpener.focus();
      helpOpener = null;
    });
    // Click on the backdrop (i.e. outside the dialog box) dismisses.
    help.addEventListener('click', function (e) {
      if (e.target === help) closeHelp();
    });
  }

  /* ------------------------------------------------------------------------
     ROVING SELECTION

     The selection IS focus. Screen readers then announce each move for free,
     Enter is mostly native, and mouse / Tab / j / k converge on one state —
     they cannot disagree, because a single focusin listener owns it.

     Deliberately NOT aria-activedescendant: that needs a listbox/grid role
     over what is a page of prose and links, and would stop the work section
     behaving like links for screen reader users.

     Deliberately NOT roving tabindex: this is a document, so every real link
     keeps its natural Tab position.
     ------------------------------------------------------------------------ */
  var SELECTABLE = '[data-nav]';
  var items = [];
  var current = -1;

  function refresh() {
    items = Array.prototype.slice.call(document.querySelectorAll(SELECTABLE));
  }
  refresh();

  function mark(el) {
    for (var i = 0; i < items.length; i++) items[i].removeAttribute('data-selected');
    if (el) {
      el.setAttribute('data-selected', '');
      current = items.indexOf(el);
    } else {
      current = -1;
    }
  }

  function move(delta) {
    if (!items.length) return;
    var next = current < 0
      ? (delta > 0 ? 0 : items.length - 1)
      : Math.min(items.length - 1, Math.max(0, current + delta));
    var el = items[next];
    el.focus({ preventScroll: true });   // focusin below calls mark()
    el.scrollIntoView({ block: 'nearest', behavior: scrollBehavior() });
  }

  // One source of truth: whatever receives focus, by any means, is selected.
  document.addEventListener('focusin', function (e) {
    var el = e.target && e.target.closest ? e.target.closest(SELECTABLE) : null;
    mark(el || null);
  });

  function jumpTo(el) {
    if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
    // Move focus too, so the jump is announced and Tab resumes from here.
    var hadTabindex = el.hasAttribute('tabindex');
    if (!hadTabindex) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
    if (!hadTabindex) {
      el.addEventListener('blur', function handler() {
        el.removeAttribute('tabindex');
        el.removeEventListener('blur', handler);
      });
    }
  }

  /* ------------------------------------------------------------------------
     KEY HANDLER

     Every guard here is load-bearing; see the comments.
     ------------------------------------------------------------------------ */
  function isTyping(t) {
    if (!t) return false;
    if (t.isContentEditable) return true;
    var tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }

  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented) return;

    // Never shadow browser shortcuts: Cmd+K, Ctrl+F, Ctrl+J, Alt+Left...
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // NOTE: deliberately no shiftKey bail. 'G' is Shift+g and '?' is Shift+/,
    // so an early return here would silently kill two of the bindings.

    if (isTyping(e.target)) return;
    if (e.isComposing || e.keyCode === 229) return;   // IME composition
    if (help && help.open) return;                    // the dialog owns its keys

    // Case-SENSITIVE on purpose: it is what distinguishes g from G.
    var k = e.key;

    switch (k) {
      case 'j': move(1);  e.preventDefault(); break;
      case 'k': move(-1); e.preventDefault(); break;

      // Arrows only take over once a selection is live — otherwise the visitor
      // is simply trying to scroll and we must not fight them.
      case 'ArrowDown': if (current >= 0) { move(1);  e.preventDefault(); } break;
      case 'ArrowUp':   if (current >= 0) { move(-1); e.preventDefault(); } break;

      case 'Enter': {
        if (current < 0) break;
        var el = items[current];
        if (el.tagName === 'A') break;                // let native activation run
        var href = el.getAttribute('data-nav-href');
        if (href) { e.preventDefault(); window.location.href = href; }
        break;
      }

      // e.repeat guards below: holding 't' would strobe the theme, which is a
      // real photosensitivity hazard. j/k deliberately allow repeat.
      case 'g': if (!e.repeat) { jumpTo(document.getElementById('top')); e.preventDefault(); } break;
      case 'G': if (!e.repeat) { jumpTo(document.getElementById('end')); e.preventDefault(); } break;

      case '1': case '2': case '3': case '4': {
        if (e.repeat) break;
        var target = document.getElementById(SECTIONS[Number(k)]);
        if (target) { jumpTo(target); e.preventDefault(); }
        break;
      }

      case 't': if (!e.repeat) { toggleTheme(); e.preventDefault(); } break;
      case 'c': if (!e.repeat) { copyEmail();   e.preventDefault(); } break;

      // preventDefault matters: without it the ':' lands in the input we just
      // focused, and every command starts with a stray colon.
      case ':':
        // offsetParent is null when the prompt is display:none (touch layout).
        if (!e.repeat && cmdInput && cmdInput.offsetParent !== null) {
          cmdInput.focus();
          e.preventDefault();
        }
        break;

      // Matched as the produced character, not as '/' + shift: on AZERTY and
      // Nordic layouts '?' is not Shift+/.
      case '?': if (!e.repeat) { openHelp(); e.preventDefault(); } break;

      case 'Escape':
        if (current >= 0) {
          if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
          }
          mark(null);
          e.preventDefault();
        }
        break;
    }

    // '/' is intentionally unbound — it is Firefox's quick-find.
  });

  /* ------------------------------------------------------------------------
     COMMAND PROMPT

     A real one. It parses, tab-completes, keeps history, and reports errors
     for input it does not understand. Nothing here is decorative, and nothing
     it does is unreachable by other means.
     ------------------------------------------------------------------------ */
  var promptForm = document.getElementById('prompt-form');
  var cmdInput   = document.getElementById('cmd');
  var cmdMsg     = document.getElementById('cmd-msg');

  var DESTS = {
    '~': 'top', '/': 'top', '..': 'top', 'top': 'top', 'home': 'top',
    'about': 'about', 'work': 'work', 'log': 'log', 'contact': 'contact'
  };
  var DEST_NAMES = ['about', 'work', 'log', 'contact', '~'];

  var PROJECTS = {
    waypoint: 'https://github.com/Troydavis06',
    clara: 'https://claragot.us/',
    instacleanser: 'https://troydavis.me/instacleanser/'
  };

  var VERBS = ['cd', 'ls', 'open', 'theme', 'help', 'clear'];
  var history = [];
  var histIdx = -1;

  function say(text, isError) {
    if (!cmdMsg) return;
    cmdMsg.textContent = text;
    if (isError) cmdMsg.setAttribute('data-err', '');
    else cmdMsg.removeAttribute('data-err');
    if (text) announce(text);
  }

  function runCommand(raw) {
    var line = String(raw || '').trim();
    if (!line) return;

    history.unshift(line);
    histIdx = -1;

    var parts = line.split(/\s+/);
    var verb = parts[0].toLowerCase();
    var arg = (parts[1] || '').toLowerCase();

    switch (verb) {
      case 'cd': {
        var id = DESTS[arg || '~'];
        if (!id) { say('cd: no such section: ' + parts[1], true); return; }
        jumpTo(document.getElementById(id));
        say('');
        return;
      }

      case 'open': {
        if (!arg) { say('open: name it — ' + Object.keys(PROJECTS).join(', '), true); return; }
        var url = PROJECTS[arg];
        if (!url) { say('open: no such project: ' + parts[1], true); return; }
        // User-initiated, so this is not a blocked popup.
        window.open(url, '_blank', 'noopener');
        say('opening ' + arg);
        return;
      }

      case 'ls':
        say(DEST_NAMES.join('   '));
        return;

      case 'theme':
        if (arg === 'light' || arg === 'dark') { applyTheme(arg, true); say(arg + ' theme'); }
        else if (!arg) { toggleTheme(); say(''); }
        else say('theme: light or dark', true);
        return;

      case 'help':
      case '?':
        openHelp();
        say('');
        return;

      case 'clear':
        say('');
        return;

      default:
        say(verb + ': command not found — try ls', true);
    }
  }

  /* One source of truth for "what can go here", shared by Tab and the menu. */
  var HINTS = {
    cd: 'go to a section', open: 'open a project', ls: 'list sections',
    theme: 'light or dark', help: 'key reference', clear: 'clear this line'
  };
  var TAKES_ARG = { cd: 1, open: 1, theme: 1 };

  function context(line) {
    var parts = String(line).split(/\s+/);
    var atVerb = parts.length < 2;
    var word = (parts[atVerb ? 0 : 1] || '').toLowerCase();
    var pool = null;
    if (atVerb) {
      pool = VERBS;
    } else {
      var v = parts[0].toLowerCase();
      if (v === 'cd') pool = DEST_NAMES;
      else if (v === 'open') pool = Object.keys(PROJECTS);
      else if (v === 'theme') pool = ['light', 'dark'];
    }
    return { parts: parts, atVerb: atVerb, word: word, pool: pool };
  }

  function candidates(line) {
    var c = context(line);
    if (!c.pool) return { ctx: c, hits: [] };
    return {
      ctx: c,
      hits: c.pool.filter(function (x) { return x.indexOf(c.word) === 0; })
    };
  }

  /* ---- the menu ---- */
  var cmdMenu = document.getElementById('cmd-menu');
  var menuItems = [];
  var menuIdx = -1;

  function menuOpen() { return !!(cmdMenu && cmdMenu.hasAttribute('data-open')); }

  function closeMenu() {
    if (!cmdMenu) return;
    cmdMenu.removeAttribute('data-open');
    cmdMenu.innerHTML = '';
    menuItems = [];
    menuIdx = -1;
    if (cmdInput) {
      cmdInput.setAttribute('aria-expanded', 'false');
      cmdInput.removeAttribute('aria-activedescendant');
    }
  }

  function markMenu(i) {
    for (var n = 0; n < menuItems.length; n++) {
      menuItems[n].removeAttribute('data-active');
      menuItems[n].setAttribute('aria-selected', 'false');
    }
    menuIdx = i;
    if (i < 0 || !menuItems[i]) {
      if (cmdInput) cmdInput.removeAttribute('aria-activedescendant');
      return;
    }
    menuItems[i].setAttribute('data-active', '');
    menuItems[i].setAttribute('aria-selected', 'true');
    if (cmdInput) cmdInput.setAttribute('aria-activedescendant', menuItems[i].id);
    if (menuItems[i].scrollIntoView) menuItems[i].scrollIntoView({ block: 'nearest' });
  }

  function renderMenu() {
    if (!cmdMenu || !cmdInput) return;
    var line = cmdInput.value;
    var r = candidates(line);

    // Nothing typed yet, or nothing to offer: stay out of the way.
    if (!line.trim() || !r.hits.length) { closeMenu(); return; }

    cmdMenu.innerHTML = '';
    menuItems = [];
    r.hits.forEach(function (name, i) {
      var li = document.createElement('li');
      li.id = 'cmd-opt-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');

      // Grid column 1 is the caret gutter, drawn by ::before — no element here.
      var label = document.createElement('span');
      label.textContent = name;
      li.appendChild(label);

      if (r.ctx.atVerb && HINTS[name]) {
        var hint = document.createElement('span');
        hint.className = 'menu__hint';
        hint.textContent = HINTS[name];
        li.appendChild(hint);
      }

      // mousedown, not click: click fires after blur would already have closed us
      li.addEventListener('mousedown', function (e) { e.preventDefault(); accept(name); });
      cmdMenu.appendChild(li);
      menuItems.push(li);
    });

    cmdMenu.setAttribute('data-open', '');
    cmdInput.setAttribute('aria-expanded', 'true');
    markMenu(-1);
  }

  function accept(name) {
    var c = context(cmdInput.value);
    if (c.atVerb) {
      cmdInput.value = name + (TAKES_ARG[name] ? ' ' : '');
      cmdInput.focus();
      renderMenu();                       // now offer that verb's arguments
      if (!TAKES_ARG[name]) { runCommand(cmdInput.value); cmdInput.value = ''; closeMenu(); }
    } else {
      cmdInput.value = c.parts[0] + ' ' + name;
      runCommand(cmdInput.value);
      cmdInput.value = '';
      closeMenu();
      cmdInput.focus();
    }
  }

  // Tab: complete as far as every candidate agrees, and show the rest.
  function complete() {
    if (!cmdInput) return;
    var r = candidates(cmdInput.value);
    if (!r.hits.length) return;

    var common = r.hits[0];
    for (var i = 1; i < r.hits.length; i++) {
      var j = 0;
      while (j < common.length && j < r.hits[i].length && common[j] === r.hits[i][j]) j++;
      common = common.slice(0, j);
    }
    cmdInput.value = r.ctx.atVerb ? common : r.ctx.parts[0] + ' ' + common;

    if (r.hits.length > 1) { renderMenu(); return; }

    // Exactly one hit: the word is now complete. Leaving a one-item menu open
    // would be noise, and worse, it would keep owning the arrow keys.
    say('');
    if (r.ctx.atVerb && TAKES_ARG[common]) {
      cmdInput.value += ' ';
      renderMenu();               // ...but do offer that verb's arguments
    } else {
      closeMenu();
    }
  }

  if (promptForm && cmdInput) {
    promptForm.addEventListener('submit', function (e) {
      e.preventDefault();
      closeMenu();
      runCommand(cmdInput.value);
      cmdInput.value = '';
    });

    cmdInput.addEventListener('input', renderMenu);
    cmdInput.addEventListener('blur', function () {
      // Let a mousedown on an option win the race.
      window.setTimeout(closeMenu, 120);
    });

    cmdInput.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); complete(); return; }

      if (e.key === 'Enter' && menuOpen() && menuIdx >= 0) {
        e.preventDefault();
        accept(menuItems[menuIdx].firstChild.textContent);
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        // First Escape dismisses the menu, second clears and leaves the prompt.
        if (menuOpen()) { closeMenu(); return; }
        cmdInput.value = '';
        say('');
        cmdInput.blur();
        return;
      }

      // While the menu is up it owns the arrows; otherwise they walk history.
      if (e.key === 'ArrowDown') {
        if (menuOpen()) { e.preventDefault(); markMenu((menuIdx + 1) % menuItems.length); return; }
        if (histIdx > -1) {
          e.preventDefault();
          histIdx -= 1;
          cmdInput.value = histIdx < 0 ? '' : history[histIdx];
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        if (menuOpen()) {
          e.preventDefault();
          markMenu(menuIdx <= 0 ? menuItems.length - 1 : menuIdx - 1);
          return;
        }
        if (history.length) {
          e.preventDefault();
          histIdx = Math.min(histIdx + 1, history.length - 1);
          cmdInput.value = history[histIdx];
        }
      }
    });
  }

  /* ------------------------------------------------------------------------
     TOUCH ACTION BAR
     ------------------------------------------------------------------------ */
  var mTheme = document.getElementById('m-theme');
  var mEmail = document.getElementById('m-email');
  var mTop   = document.getElementById('m-top');

  if (mTheme) mTheme.addEventListener('click', toggleTheme);
  if (mEmail) mEmail.addEventListener('click', copyEmail);
  if (mTop)   mTop.addEventListener('click', function () {
    jumpTo(document.getElementById('top'));
  });

}());

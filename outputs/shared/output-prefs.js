/* Shared Dark/Light Theme & EN/VI Language Controller for Standalone AI-Usage Outputs */
(function () {
  var THEME_KEY = 'ai-usage:theme';
  var ARCHIFY_THEME_KEY = 'archify-theme';
  var LANG_KEY = 'ai-usage:lang';
  var isApplyingDom = false;
  var observer = null;

  function resolveInitialTheme() {
    try {
      var stored = window.localStorage
        ? window.localStorage.getItem(THEME_KEY)
        : null;
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      var q = new URLSearchParams(window.location.search).get('theme');
      if (q === 'light' || q === 'dark') {
        return q;
      }
      var archifyStored = window.localStorage
        ? window.localStorage.getItem(ARCHIFY_THEME_KEY)
        : null;
      if (archifyStored === 'light' || archifyStored === 'dark') {
        return archifyStored;
      }
      if (
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      ) {
        return 'dark';
      }
    } catch (_) {}
    return 'light';
  }

  function resolveInitialLang() {
    try {
      var q = new URLSearchParams(window.location.search).get('lang');
      if (q === 'en' || q === 'vi') {
        if (window.localStorage) window.localStorage.setItem(LANG_KEY, q);
        return q;
      }
      var stored = window.localStorage
        ? window.localStorage.getItem(LANG_KEY)
        : null;
      if (stored === 'en' || stored === 'vi') {
        return stored;
      }
    } catch (_) {}
    return 'en';
  }

  function applyThemeToRoot(theme) {
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.dataset.theme = theme;

    var archifyThemeLabel = document.getElementById('theme-label');
    var archifyThemeBtn = document.getElementById('btn-theme');
    if (archifyThemeLabel) {
      var activeLang = root.dataset.lang || 'en';
      archifyThemeLabel.textContent =
        theme === 'dark'
          ? activeLang === 'vi'
            ? 'Sáng'
            : 'Light'
          : activeLang === 'vi'
            ? 'Tối'
            : 'Dark';
    }
    if (archifyThemeBtn) {
      archifyThemeBtn.setAttribute(
        'aria-pressed',
        theme === 'dark' ? 'true' : 'false'
      );
    }

    var themeBtn = document.getElementById('aiu-theme-toggle');
    if (themeBtn) {
      var lang = root.dataset.lang || 'en';
      var icon = theme === 'dark' ? '☀️' : '🌙';
      var text =
        theme === 'dark'
          ? lang === 'vi'
            ? 'Sáng'
            : 'Light'
          : lang === 'vi'
            ? 'Tối'
            : 'Dark';
      themeBtn.innerHTML =
        '<span aria-hidden="true">' + icon + '</span><span>' + text + '</span>';
      themeBtn.setAttribute(
        'aria-pressed',
        theme === 'dark' ? 'true' : 'false'
      );
    }

    var iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i++) {
      var frame = iframes[i];
      try {
        if (
          frame.contentDocument &&
          frame.contentDocument.documentElement
        ) {
          frame.contentDocument.documentElement.setAttribute(
            'data-theme',
            theme
          );
        }
      } catch (_) {}
      var src = frame.getAttribute('src');
      if (src && src.indexOf('theme=') !== -1) {
        var updatedSrc = src.replace(/theme=(light|dark)/, 'theme=' + theme);
        if (updatedSrc !== src) {
          frame.setAttribute('src', updatedSrc);
        }
      }
    }
  }

  function setTheme(theme, persist) {
    if (theme !== 'light' && theme !== 'dark') return;
    if (persist !== false) {
      try {
        window.localStorage.setItem(THEME_KEY, theme);
        window.localStorage.setItem(ARCHIFY_THEME_KEY, theme);
      } catch (_) {}
    }
    applyThemeToRoot(theme);
  }

  function lookupExactOrPattern(trimmed) {
    var dict = window.AI_USAGE_OUTPUT_I18N;
    if (!dict || !trimmed) return null;
    if (Object.prototype.hasOwnProperty.call(dict.exact, trimmed)) {
      return dict.exact[trimmed];
    }
    if (Array.isArray(dict.patterns)) {
      for (var i = 0; i < dict.patterns.length; i++) {
        var pat = dict.patterns[i];
        if (pat.re.test(trimmed)) {
          return trimmed.replace(pat.re, pat.vi);
        }
      }
    }
    return null;
  }

  function translateTextValue(rawText) {
    if (!rawText) return null;
    var collapsed = rawText.replace(/\s+/g, ' ').trim();
    if (!collapsed) return null;

    var direct = lookupExactOrPattern(collapsed);
    if (direct) return direct;

    // Strip leading/trailing punctuation wrappers around inline tags (e.g. ", and", ". Through...", "—containing...")
    var m = collapsed.match(
      /^([,.;:—–\-"'“”‘’(\[\s•·→←↔]+)?([\s\S]+?)([,.;:—–\-"'“”‘’)\]\s•·→←↔]+)?$/
    );
    if (m && m[2]) {
      var inner = m[2].trim();
      if (inner && inner !== collapsed) {
        var innerTranslated = lookupExactOrPattern(inner);
        if (innerTranslated) {
          return (m[1] || '') + innerTranslated + (m[3] || '');
        }
      }
    }
    return null;
  }

  function translateTextNode(tn, lang) {
    var parent = tn.parentElement;
    if (!parent) return;
    if (
      parent.closest('#aiu-pref-bar, script, style, pre, code') ||
      parent.classList.contains('i18n')
    ) {
      return;
    }

    var currentVal = tn.nodeValue || '';
    if (!currentVal.trim()) return;

    // Detect if dynamic JS overwrote this text node with a new English value
    if (
      tn.__aiuOrig !== undefined &&
      currentVal !== tn.__aiuOrig &&
      currentVal !== tn.__aiuVi
    ) {
      tn.__aiuOrig = undefined;
      tn.__aiuVi = undefined;
    }

    if (tn.__aiuOrig === undefined) {
      tn.__aiuOrig = currentVal;
      var leadMatch = currentVal.match(/^\s*/);
      var trailMatch = currentVal.match(/\s*$/);
      var lead = leadMatch ? leadMatch[0] : '';
      var trail = trailMatch ? trailMatch[0] : '';
      var translated = translateTextValue(currentVal);
      tn.__aiuVi = translated ? lead + translated + trail : null;
    }

    if (lang === 'vi' && tn.__aiuVi) {
      if (tn.nodeValue !== tn.__aiuVi) {
        tn.nodeValue = tn.__aiuVi;
      }
    } else if (lang === 'en' && tn.__aiuOrig !== undefined) {
      if (tn.nodeValue !== tn.__aiuOrig) {
        tn.nodeValue = tn.__aiuOrig;
      }
    }
  }

  function translateSubtree(rootEl, lang) {
    if (!rootEl) return;
    var walker = document.createTreeWalker(
      rootEl,
      NodeFilter.SHOW_TEXT,
      null
    );
    var textNodes = [];
    var current = walker.nextNode();
    while (current) {
      textNodes.push(current);
      current = walker.nextNode();
    }
    for (var i = 0; i < textNodes.length; i++) {
      translateTextNode(textNodes[i], lang);
    }

    // Translate placeholder and title attributes
    if (rootEl.querySelectorAll) {
      var attrEls = rootEl.querySelectorAll('[placeholder], [title]');
      for (var j = 0; j < attrEls.length; j++) {
        var el = attrEls[j];
        if (el.closest('#aiu-pref-bar')) continue;
        if (el.hasAttribute('placeholder')) {
          if (el.dataset.aiuOrigPh === undefined) {
            var ph = el.getAttribute('placeholder') || '';
            var phVi = translateTextValue(ph);
            el.dataset.aiuOrigPh = ph;
            if (phVi) el.dataset.aiuViPh = phVi;
          }
          if (el.dataset.aiuViPh) {
            el.setAttribute(
              'placeholder',
              lang === 'vi' ? el.dataset.aiuViPh : el.dataset.aiuOrigPh
            );
          }
        }
        if (el.hasAttribute('title')) {
          if (el.dataset.aiuOrigTi === undefined) {
            var ti = el.getAttribute('title') || '';
            var tiVi = translateTextValue(ti);
            el.dataset.aiuOrigTi = ti;
            if (tiVi) el.dataset.aiuViTi = tiVi;
          }
          if (el.dataset.aiuViTi) {
            el.setAttribute(
              'title',
              lang === 'vi' ? el.dataset.aiuViTi : el.dataset.aiuOrigTi
            );
          }
        }
      }
    }
  }

  function applyLanguageToDom(lang) {
    isApplyingDom = true;
    try {
      var root = document.documentElement;
      root.setAttribute('data-lang', lang);
      root.dataset.lang = lang;
      root.lang = lang;

      var langBtns = document.querySelectorAll('[data-aiu-lang]');
      for (var i = 0; i < langBtns.length; i++) {
        var b = langBtns[i];
        var isCurrent = b.getAttribute('data-aiu-lang') === lang;
        b.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
      }

      applyThemeToRoot(root.dataset.theme || 'light');

      if (!root.dataset.aiuOrigTitle) {
        root.dataset.aiuOrigTitle = document.title;
      }
      if (lang === 'vi') {
        var viTitle = translateTextValue(root.dataset.aiuOrigTitle);
        if (viTitle) document.title = viTitle;
      } else {
        document.title = root.dataset.aiuOrigTitle;
      }

      if (document.body) {
        translateSubtree(document.body, lang);
      }

      // Propagate language change live into any embedded child iframes (e.g. Archify diagrams)
      var iframes = document.querySelectorAll('iframe');
      for (var k = 0; k < iframes.length; k++) {
        var frame = iframes[k];
        try {
          if (frame.contentWindow && typeof frame.contentWindow.__aiuApplyLang === 'function') {
            frame.contentWindow.__aiuApplyLang(lang);
          } else if (frame.contentDocument && frame.contentDocument.documentElement) {
            frame.contentDocument.documentElement.setAttribute('data-lang', lang);
            frame.contentDocument.documentElement.lang = lang;
          }
        } catch (_) {}
      }
    } finally {
      isApplyingDom = false;
    }
  }

  window.__aiuApplyLang = applyLanguageToDom;
  window.__aiuApplyTheme = applyThemeToRoot;

  function setLang(lang, persist) {
    if (lang !== 'en' && lang !== 'vi') return;
    if (persist !== false) {
      try {
        window.localStorage.setItem(LANG_KEY, lang);
      } catch (_) {}
    }
    applyLanguageToDom(lang);
  }

  function startMutationObserver() {
    if (observer || typeof MutationObserver === 'undefined' || !document.body) {
      return;
    }
    var pending = false;
    observer = new MutationObserver(function () {
      if (isApplyingDom || pending) return;
      var activeLang = document.documentElement.dataset.lang || 'en';
      if (activeLang !== 'vi') return;
      pending = true;
      window.requestAnimationFrame(function () {
        pending = false;
        if (isApplyingDom) return;
        isApplyingDom = true;
        try {
          translateSubtree(document.body, activeLang);
        } finally {
          isApplyingDom = false;
        }
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function mountPreferenceBar() {
    if (document.getElementById('aiu-pref-bar')) return;

    var archifyToolbarGroup = document.querySelector('.toolbar .toolbar-group');
    var archifyThemeBtn = document.getElementById('btn-theme');

    var bar = document.createElement('div');
    bar.id = 'aiu-pref-bar';

    if (archifyToolbarGroup && archifyThemeBtn) {
      bar.className = 'aiu-lang-group';
      bar.setAttribute('role', 'group');
      bar.setAttribute('aria-label', 'Language');
      bar.style.marginRight = '6px';
      bar.innerHTML =
        '<button type="button" class="aiu-lang-btn" data-aiu-lang="en">EN</button>' +
        '<button type="button" class="aiu-lang-btn" data-aiu-lang="vi">VI</button>';
      archifyToolbarGroup.insertBefore(bar, archifyThemeBtn);

      archifyThemeBtn.addEventListener('click', function () {
        window.setTimeout(function () {
          var updated =
            document.documentElement.getAttribute('data-theme') || 'light';
          setTheme(updated, true);
        }, 25);
      });
    } else {
      bar.className = 'aiu-pref-bar aiu-pref-floating';
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', 'Language and theme preferences');
      bar.innerHTML =
        '<div class="aiu-lang-group" role="group" aria-label="Language">' +
        '<button type="button" class="aiu-lang-btn" data-aiu-lang="en">EN</button>' +
        '<button type="button" class="aiu-lang-btn" data-aiu-lang="vi">VI</button>' +
        '</div>' +
        '<button type="button" class="aiu-theme-btn" id="aiu-theme-toggle" aria-label="Toggle theme"></button>';
      document.body.appendChild(bar);
    }

    bar.addEventListener('click', function (e) {
      var target = e.target;
      if (!target || !target.closest) return;
      var langBtn = target.closest('[data-aiu-lang]');
      if (langBtn) {
        var nextLang = langBtn.getAttribute('data-aiu-lang');
        setLang(nextLang, true);
        return;
      }
      var themeBtn = target.closest('#aiu-theme-toggle');
      if (themeBtn) {
        var cur = document.documentElement.dataset.theme || 'light';
        setTheme(cur === 'dark' ? 'light' : 'dark', true);
      }
    });
  }

  var initialTheme = resolveInitialTheme();
  var initialLang = resolveInitialLang();
  document.documentElement.setAttribute('data-theme', initialTheme);
  document.documentElement.dataset.theme = initialTheme;
  document.documentElement.setAttribute('data-lang', initialLang);
  document.documentElement.dataset.lang = initialLang;
  document.documentElement.lang = initialLang;

  function bindChildIframes() {
    var iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i++) {
      (function (frame) {
        if (frame.dataset.aiuBound === 'true') return;
        frame.dataset.aiuBound = 'true';
        frame.addEventListener('load', function () {
          var curTheme = document.documentElement.dataset.theme || resolveInitialTheme();
          var curLang = document.documentElement.dataset.lang || resolveInitialLang();
          try {
            if (frame.contentWindow) {
              if (typeof frame.contentWindow.__aiuApplyTheme === 'function') {
                frame.contentWindow.__aiuApplyTheme(curTheme);
              }
              if (typeof frame.contentWindow.__aiuApplyLang === 'function') {
                frame.contentWindow.__aiuApplyLang(curLang);
              }
            }
          } catch (_) {}
        });
      })(iframes[i]);
    }
  }

  function onReady() {
    mountPreferenceBar();
    bindChildIframes();
    applyThemeToRoot(resolveInitialTheme());
    applyLanguageToDom(resolveInitialLang());
    startMutationObserver();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }

  window.addEventListener('storage', function (e) {
    if (
      (e.key === THEME_KEY || e.key === ARCHIFY_THEME_KEY) &&
      (e.newValue === 'light' || e.newValue === 'dark')
    ) {
      applyThemeToRoot(e.newValue);
    }
    if (e.key === LANG_KEY && (e.newValue === 'en' || e.newValue === 'vi')) {
      applyLanguageToDom(e.newValue);
    }
  });
})();

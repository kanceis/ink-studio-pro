/* Ink Compatível · language layer.
 *
 * The site is written in Portuguese. Under /en/… this file translates what app.js renders, using the
 * dictionary in i18n/en.js (window.INK_EN): every visible text node and the attributes people or screen
 * readers see (aria-label, alt, placeholder, title). Keys with {1}, {2}… match texts built from a template,
 * and what fills each slot is translated again, so "Carolina responde" inside a longer sentence also works.
 * Content written in the app (artist bios, product descriptions) stays as written there.
 *
 * Addresses: Portuguese pages keep /artistas, /loja…; English pages live at /en/artists, /en/shop…
 * app.js routes on the Portuguese path (toPt) and builds links with L().
 */
(() => {
  'use strict';

  // Portuguese slug → English slug (first path segment).
  const SLUGS = {
    artistas: 'artists', portfolio: 'portfolio', loja: 'shop', estudio: 'studio', marcar: 'book',
    teste: 'quiz', obrigado: 'thank-you', privacidade: 'privacy', envios: 'shipping',
  };
  const BACK = Object.fromEntries(Object.entries(SLUGS).map(([pt, en]) => [en, pt]));
  const EN_PREFIX = /^\/en(?=\/|$)/;

  const isEnPath = (p) => EN_PREFIX.test(p);
  const lang = isEnPath(location.pathname) ? 'en' : 'pt';
  const en = lang === 'en';

  const splitUrl = (u) => {
    const m = String(u).match(/^([^?#]*)(.*)$/);
    return [m[1] || '/', m[2] || ''];
  };
  const mapFirst = (path, table) => path.replace(/^\/([^/]+)/, (all, seg) => (table[seg] ? `/${table[seg]}` : all));

  // /en/artists/arants → /artistas/arants ; /artistas → /artistas
  const toPt = (path) => {
    if (!isEnPath(path)) return path || '/';
    return mapFirst(path.replace(EN_PREFIX, '') || '/', BACK);
  };
  // /artistas/arants?x#y → /en/artists/arants?x#y
  const toEn = (url) => {
    const [path, rest] = splitUrl(url);
    if (isEnPath(path)) return url;
    const p = mapFirst(path, SLUGS);
    return `/en${p === '/' ? '/' : p}${rest}`;
  };
  // A same-site Portuguese path, in the language of the page being viewed.
  const L = (url) => (en && /^\/(?!\/)/.test(url) && !/\.\w{2,5}([?#]|$)/.test(splitUrl(url)[0]) ? toEn(url) : url);

  // ------------------------------------------------------------------ dictionary
  const SRC = (en && window.INK_EN) || {};
  const exact = new Map();
  const patterns = [];
  const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const add = (pt, out) => {
    const key = norm(pt);
    if (!key || out == null) return;
    if (/\{\d\}/.test(key)) {
      const order = [];
      const re = new RegExp(`^${key.split(/(\{\d\})/).map((part) => {
        const m = part.match(/^\{(\d)\}$/);
        if (!m) return escapeRe(part);
        order.push(Number(m[1]));
        return '(.*?)';
      }).join('')}$`, 's');
      patterns.push({ re, order, out: norm(out) });
    } else {
      exact.set(key, norm(out));
    }
  };
  for (const [pt, out] of Object.entries(SRC)) {
    add(pt, out);
    // Headlines written with \n break into lines (<br>); each line is its own text node.
    if (pt.includes('\n') && typeof out === 'string') {
      const a = pt.split('\n');
      const b = out.split('\n');
      // A line that is only a slot ("{1}.") would match almost anything, so it is left out.
      const onlySlot = (line) => !line.replace(/\{\d\}/g, '').replace(/[\s.,!?:;·–-]/g, '');
      if (a.length === b.length) a.forEach((line, i) => { if (!onlySlot(line)) add(line, b[i]); });
    }
  }
  // Longest templates first, so the most specific one wins.
  patterns.sort((x, y) => y.re.source.length - x.re.source.length);

  const DAYS = {
    segunda: 'Monday', 'terça': 'Tuesday', terca: 'Tuesday', quarta: 'Wednesday', quinta: 'Thursday',
    sexta: 'Friday', 'sábado': 'Saturday', sabado: 'Saturday', domingo: 'Sunday',
  };
  // Opening hours typed in the app, e.g. "Terça a sábado, 10h–19h" → "Tuesday to Saturday, 10am–7pm".
  const clock = (s) => s.replace(/(\d{1,2})\s*h\s*(\d{2})?/g, (_, h, m) => {
    const n = Number(h) % 24;
    return `${n % 12 || 12}${m && m !== '00' ? `:${m}` : ''}${n < 12 ? 'am' : 'pm'}`;
  });
  const range = (s) => s.replace(/(\dh(?:\d{2})?)\s*(?:-|–|às|a)\s*(?=\d)/gi, '$1–').replace(/(\d)\s+h/g, '$1h');
  const TIMES = /^\d{1,2}\s*h(\s*\d{2})?\s*(?:-|–|às|a)\s*\d{1,2}\s*h(\s*\d{2})?$/i;
  const hours = (s) => {
    if (TIMES.test(s)) return clock(range(s));
    const day = '(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(?:-feira)?';
    const re = new RegExp(`^${day}\\s*(?:a|-|–)\\s*${day}`, 'i');
    if (!re.test(s)) return null;
    return clock(range(s).replace(re, (_, a, b) => `${DAYS[a.toLowerCase()]} to ${DAYS[b.toLowerCase()]}`))
      .replace(/,? com marcação/i, ', by appointment');
  };

  const SHORT = { Seg: 'Mon', Ter: 'Tue', Qua: 'Wed', Qui: 'Thu', Sex: 'Fri', 'Sáb': 'Sat', Dom: 'Sun' };
  const shortDays = (s) => (/^(Seg|Ter|Qua|Qui|Sex|Sáb|Dom)(–(Seg|Ter|Qua|Qui|Sex|Sáb|Dom))?$/.test(s) ? s.replace(/[A-Z][a-zá]{2}/g, (d) => SHORT[d] || d) : null);

  const t = (input, depth = 0) => {
    if (!en || input == null) return input;
    const key = norm(input);
    if (!key) return input;
    if (exact.has(key)) return exact.get(key);
    if (depth < 3) {
      for (const p of patterns) {
        const m = key.match(p.re);
        if (!m) continue;
        return p.out.replace(/\{(\d)\}/g, (_, n) => {
          const v = m[p.order.indexOf(Number(n)) + 1];
          if (v === undefined) return '';
          return /^\d+,\d+$/.test(v) ? v.replace(',', '.') : t(v, depth + 1);
        });
      }
    }
    return hours(key) || shortDays(key) || input;
  };

  // ------------------------------------------------------------------ DOM
  const ATTRS = ['aria-label', 'alt', 'placeholder', 'title', 'data-w'];
  const SKIP = 'script,style,textarea,code,[data-i18n-skip],[translate="no"]';
  const done = new WeakMap(); // text node → the English text we wrote, so our own writes are left alone

  const textNode = (node) => {
    if (done.get(node) === node.data) return;
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP)) return;
    const raw = node.data;
    if (!/[A-Za-zÀ-ú]/.test(raw)) return;
    const out = t(raw);
    if (out !== raw && out !== norm(raw)) {
      const lead = raw.match(/^\s*/)[0];
      const trail = raw.match(/\s*$/)[0];
      node.data = lead + out + trail;
    }
    done.set(node, node.data);
  };
  const attr = (elm, name) => {
    const v = elm.getAttribute(name);
    if (!v) return;
    const out = t(v);
    if (out !== v) elm.setAttribute(name, out);
  };
  const link = (a) => {
    const href = a.getAttribute('href');
    if (href && !a.hasAttribute('data-lang-switch')) {
      const out = L(href);
      if (out !== href) a.setAttribute('href', out);
    }
  };
  const element = (elm) => {
    if (elm.closest(SKIP)) return;
    for (const name of ATTRS) if (elm.hasAttribute(name)) attr(elm, name);
    if (elm.tagName === 'A') link(elm);
  };

  const apply = (root) => {
    if (!en || !root) return;
    if (root.nodeType === Node.TEXT_NODE) return textNode(root);
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    element(root);
    root.querySelectorAll(`[${ATTRS.join('],[')}],a[href]`).forEach(element);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) textNode(n);
  };

  // ------------------------------------------------------------------ page language
  document.documentElement.lang = en ? 'en' : 'pt-PT';

  // The EN/PT switch in the header points at the same page in the other language.
  const SWITCH = en
    ? { text: 'PT', hreflang: 'pt-PT', label: 'Ver o site em português' }
    : { text: 'EN', hreflang: 'en', label: 'Ver o site em inglês' };
  const updateSwitch = () => {
    const a = document.querySelector('[data-lang-switch]');
    if (!a) return;
    const here = location.pathname + location.search + location.hash;
    a.href = en ? toPt(location.pathname) + location.search + location.hash : toEn(here);
    a.textContent = SWITCH.text;
    // The label is in Portuguese on both versions, so on the English page it is marked as Portuguese.
    if (en) a.lang = 'pt-PT'; else a.removeAttribute('lang');
    a.hreflang = SWITCH.hreflang;
    a.setAttribute('aria-label', SWITCH.label);
  };
  updateSwitch();
  document.addEventListener('ink:route', updateSwitch);

  if (en) {
    apply(document.body);
    // Anything app.js draws later (form steps, the cart, the quiz) is translated as it appears. This runs
    // before motion.js's observer (created later), so motion splits the English words.
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'childList') r.addedNodes.forEach(apply);
        else if (r.type === 'characterData') textNode(r.target);
        else if (r.type === 'attributes' && !r.target.closest(SKIP)) attr(r.target, r.attributeName);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  window.INK_I18N = { lang, en, locale: en ? 'en-IE' : 'pt-PT', t, L, toPt, toEn, apply, isEnPath };
})();

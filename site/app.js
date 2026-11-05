/* Ink Compatível site. Reads published content from the INK Studio Pro backoffice
   (Firestore REST, no SDK), sends booking requests to it and pays the cart with Stripe
   through the app's /api/checkout. Plain JS, no build step. */
(() => {
  'use strict';

  const cfg = window.INK_CONFIG || {};
  const DB_PATH = `projects/${cfg.projectId}/databases/${encodeURIComponent(cfg.databaseId || '(default)')}/documents`;
  const STUDIO = `${DB_PATH}/studios/${cfg.studioId || 'main'}`;
  const FS_API = `${(cfg.firestoreHost || 'https://firestore.googleapis.com').replace(/\/$/, '')}/v1`;
  const APP_API = (cfg.apiBase || '').replace(/\/$/, '');
  const withKey = (url) => (cfg.apiKey ? `${url}${url.includes('?') ? '&' : '?'}key=${cfg.apiKey}` : url);

  // ------------------------------------------------------------------ DOM helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const el = (tag, props = {}, children = []) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'style') node.style.cssText = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const c of [].concat(children)) if (c !== null && c !== undefined && c !== false) node.append(c);
    return node;
  };
  const mono = (text, cls = '') => el('span', { class: `mono ${cls}`.trim(), text });
  const safeUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);
  const eur = (n) =>
    new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n || 0);
  const digits = (s) => String(s || '').replace(/\D/g, '');

  // ------------------------------------------------------------------ Firestore REST
  const decode = (v) => {
    if (!v || typeof v !== 'object') return undefined;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('nullValue' in v) return null;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
    if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
    return undefined;
  };
  const decodeFields = (fields) => Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, decode(v)]));
  const encode = (v) => {
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    return { stringValue: String(v) };
  };

  const getPublished = async (collectionId) => {
    const res = await fetch(withKey(`${FS_API}/${STUDIO}:runQuery`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: { fieldFilter: { field: { fieldPath: 'published' }, op: 'EQUAL', value: { booleanValue: true } } },
        },
      }),
    });
    if (!res.ok) throw new Error(`${collectionId}: ${res.status}`);
    const rows = await res.json();
    return rows
      .filter((r) => r.document)
      .map((r) => ({ id: r.document.name.split('/').pop(), ...decodeFields(r.document.fields) }))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(b.createdAt).localeCompare(String(a.createdAt)));
  };

  const getProfile = async () => {
    const res = await fetch(withKey(`${FS_API}/${STUDIO}/meta/public`));
    if (!res.ok) return {};
    return decodeFields((await res.json()).fields);
  };

  const sendBooking = async (data) => {
    const fields = {};
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string' && !v.trim()) continue;
      if (v === undefined || v === null) continue;
      fields[k] = encode(typeof v === 'string' ? v.trim() : v);
    }
    const res = await fetch(withKey(`${FS_API}/${STUDIO}/bookingRequests`), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) throw new Error(`booking: ${res.status}`);
    return (await res.json()).name.split('/').pop();
  };

  // ------------------------------------------------------------------ data
  const data = { profile: {}, artists: [], portfolio: [], shop: [], ready: false, failed: false };

  const load = async () => {
    const [profile, portfolio, shop] = await Promise.allSettled([getProfile(), getPublished('portfolio'), getPublished('shop')]);
    data.profile = profile.status === 'fulfilled' ? profile.value || {} : {};
    data.portfolio = portfolio.status === 'fulfilled' ? portfolio.value : [];
    data.shop = shop.status === 'fulfilled' ? shop.value : [];
    data.failed = [profile, portfolio, shop].every((r) => r.status === 'rejected');
    data.artists = (data.profile.artists || []).filter((a) => a && a.visible !== false && a.displayName);
    data.ready = true;
  };

  const artistById = (id) => data.artists.find((a) => a.id === id);
  const artistName = (id) => artistById(id)?.displayName || '';
  const isFlash = (p) => p.category === 'flash';
  const work = () => data.portfolio.filter((p) => !isFlash(p));
  const flash = () => data.portfolio.filter((p) => isFlash(p) && p.available !== false);
  const sellable = (item) =>
    (item.kind === 'original' && item.status === 'available') || (item.kind === 'edition' && (item.stock || 0) > 0);
  const whatsappUrl = (text = '') => {
    const n = digits(data.profile.whatsapp || data.profile.phone);
    if (!n) return null;
    const full = n.length === 9 ? `351${n}` : n;
    return `https://wa.me/${full}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
  };
  const instagramUrl = (handle) => {
    const h = String(handle || '').trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
    return h && /^[\w.]+$/.test(h) ? { url: `https://instagram.com/${h}`, label: `@${h}` } : null;
  };

  // ------------------------------------------------------------------ shared pieces
  const photo = (image, alt, ratio = 'r45', label) => {
    const url = safeUrl(image?.url);
    return el('div', { class: `ph ${ratio}`, role: url ? null : 'img', 'aria-label': url ? null : alt }, [
      url ? el('img', { src: url, alt, loading: 'lazy', decoding: 'async' }) : mono(label || alt),
    ]);
  };

  const zoomable = (item, ratio = 'r11', caption = '') =>
    el('button', { type: 'button', class: 'photo-btn', 'aria-label': `Ver maior: ${item.title || 'fotografia'}`, onclick: () => openViewer(item, caption) }, [
      photo(item.image, item.title || 'Tatuagem', ratio),
    ]);

  const openViewer = (item, caption) => {
    const dlg = $('#viewer');
    const url = safeUrl(item.image?.url);
    if (!url) return;
    $('[data-viewer-img]').src = url;
    $('[data-viewer-img]').alt = item.title || '';
    $('[data-viewer-cap]').textContent = caption || item.title || '';
    dlg.showModal();
  };

  const sectionHead = (title, text, extra) =>
    el('div', { class: 'section-head' }, [
      el('h2', { class: 'disp h2', text: title }),
      text ? el('p', { class: 'muted', text }) : null,
      extra || null,
    ]);

  // Photos of the studio (site/assets/estudio, WebP at 800 and 1600 px, metadata removed).
  const STUDIO_PHOTOS = {
    hero: ['hero-artista-a-tatuar', 'Tatuador a trabalhar no estúdio, a preto e branco'],
    main: ['armario-desenhado', 'Armário preto do estúdio, desenhado à mão com caveira, âncora e flash'],
    strip: [
      ['carrinho-autocolantes', 'Carrinho vermelho de trabalho, coberto de autocolantes'],
      ['painel-black-red', 'Painel de madeira pintado a black & red'],
      ['aguarelas', 'Aguarelas emolduradas na parede do estúdio'],
      ['garrafas', 'Garrafas decoradas em caixas de madeira na parede'],
    ],
    more: [
      ['sessao', 'Sessão de tatuagem em curso no estúdio'],
      ['maquinas', 'Máquinas de tatuar em cima da bancada'],
      ['paineis-parede', 'Painéis de arte encostados à parede'],
    ],
  };
  const studioImg = ([name, alt], ratio = 'r43', sizes = '(max-width: 640px) 100vw, 50vw') => {
    const src = (w) => `assets/estudio/${name}-${w}.webp`;
    return el('button', { type: 'button', class: 'photo-btn', 'aria-label': `Ver maior: ${alt}`, onclick: () => openViewer({ image: { url: new URL(src(1600), location.href).href }, title: alt }, alt) }, [
      el('div', { class: `ph ${ratio}` }, el('img', { src: src(800), srcset: `${src(800)} 800w, ${src(1600)} 1600w`, sizes, alt, loading: 'lazy', decoding: 'async' })),
    ]);
  };

  // ------------------------------------------------------------------ Início v3 (UX canvas "HomeV3")
  // Decorative studio photos live in assets/v3 (WebP, metadata removed). Everything else comes from the app.
  const SVGNS = 'http://www.w3.org/2000/svg';
  const v3img = (name, alt = '', { pos, big = false, eager = false, sizes = '(max-width: 760px) 100vw, 50vw' } = {}) =>
    el('img', {
      src: `assets/v3/${name}-800.webp`,
      srcset: big ? `assets/v3/${name}-800.webp 800w, assets/v3/${name}-1600.webp 1600w` : null,
      sizes: big ? sizes : null,
      alt, loading: eager ? null : 'lazy', decoding: 'async', style: pos ? `object-position:${pos}` : null,
    });
  const svg = (viewBox, paths, cls, stroke = 'currentColor', width = 5) => {
    const s = document.createElementNS(SVGNS, 'svg');
    s.setAttribute('viewBox', viewBox);
    s.setAttribute('class', cls);
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', stroke);
    s.setAttribute('stroke-width', String(width));
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    for (const d of paths) { const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', d); s.append(p); }
    return s;
  };
  const btn3 = (text, href, variant = 'w', icon = '↗', extra = {}) =>
    el('a', { class: `v-btn ${variant}`, href, ...extra }, [text, icon ? el('i', { 'aria-hidden': 'true', text: icon }) : null]);
  const ext = { target: '_blank', rel: 'noopener noreferrer' };
  const kicker = (text, cls = '') => el('div', { class: `v-kicker mono ${cls}`.trim() }, [el('b', { 'aria-hidden': 'true' }), text]);
  const initials = (name) => String(name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const styleTags = (a) => String(a.styles || '').split(/[·,/|]/).map((s) => s.trim()).filter(Boolean);
  const artistHref = (a) => `#/artistas/${encodeURIComponent(a.id)}`;
  const polaroid = (name, alt, cap, cls, pos) => el('figure', { class: `v-polaroid ${cls}` }, [v3img(name, alt, { pos }), el('figcaption', { class: 'hand', text: cap })]);

  const spinBadge = (label = 'MARCAR SESSÃO · RESPOSTA EM 48 H ·', href = '#/marcar', aria = 'Marcar sessão, respondemos em 48 horas') => {
    const ring = document.createElementNS(SVGNS, 'svg');
    ring.setAttribute('viewBox', '0 0 200 200');
    ring.setAttribute('class', 'v-spin');
    ring.setAttribute('aria-hidden', 'true');
    ring.innerHTML = '<defs><path id="v-ring" d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0"/></defs>' +
      '<text><textPath href="#v-ring" textLength="458" lengthAdjust="spacing"></textPath></text>';
    ring.querySelector('textPath').textContent = label;
    return el('a', { class: 'v-float v-badge', href, 'aria-label': aria }, [ring, el('span', { 'aria-hidden': 'true', text: '↗' })]);
  };

  const heroV3 = () => {
    const p = data.profile;
    const n = data.artists.length;
    const stamp = el('div', { class: 'v-gstamp', hidden: true });
    getReviews().then((rv) => {
      if (!rv?.rating || data.profile.showGoogleReviews === false) return;
      stamp.append(
        el('span', { class: 'n', text: decimal(rv.rating) }),
        el('span', {}, [el('b', { text: '★★★★★ no Google' }), mono(`${rv.count} ${rv.count === 1 ? 'crítica' : 'críticas'}`)]),
      );
      stamp.setAttribute('aria-label', `${decimal(rv.rating)} em 5 no Google, ${rv.count} críticas`);
      stamp.hidden = false;
    });
    const pill = (a, i) => el('a', { class: `v-float v-apill ap-${i}`, href: artistHref(a) }, [
      el('span', { class: 'av' }, safeUrl(a.photo?.url) ? el('img', { src: a.photo.url, alt: '' }) : initials(a.displayName)),
      el('span', {}, [el('b', { text: a.displayName }), a.styles ? el('small', { text: a.styles }) : null]),
    ]);
    return el('section', { class: 'v-hero v-grid', 'aria-labelledby': 'hero-title' }, [
      el('div', { class: 'v-stage' }, [
        el('h1', { class: 'disp v-hl', id: 'hero-title', 'aria-label': 'Do papel à pele' }, [
          el('span', { class: 'v-row' }, [el('span', { text: 'Do' }), el('span', { class: 'v-inpic', 'aria-hidden': 'true' }, v3img('painel', '', { pos: '40% 45%', eager: true })), el('span', { text: 'papel' })]),
          el('span', { class: 'v-row' }, 'à pele'),
        ]),
        svg('0 0 150 90', ['M8 70 C 40 10, 90 10, 120 46', 'M104 30 L122 48 L98 56'], 'v-float v-doodle d1'),
        svg('0 0 120 120', ['M60 10 L64 52 L104 60 L64 68 L60 110 L56 68 L16 60 L56 52 Z'], 'v-float v-doodle d2'),
        svg('0 0 200 60', ['M6 40 C 30 6, 50 54, 76 24 S 120 50, 140 22 S 180 40, 194 18'], 'v-float v-doodle d3', '#fff', 4),
        polaroid('miguel-bw', 'Arants a desenhar no estúdio', 'primeiro, o desenho', 'v-float pol-a', '40% 40%'),
        polaroid('tatuagem-081', 'Tatuagem de caveira em sketch no antebraço', 'depois, a pele', 'v-float pol-b', '50% 45%'),
        ...data.artists.slice(0, 3).map(pill),
        spinBadge(),
      ]),
      el('div', { class: 'v-hero-foot' }, [
        el('div', { class: 'v-hero-copy' }, [
          el('p', { text: p.tagline || `${n === 3 ? 'Três artistas' : 'Artistas'}, um estúdio em Vila Nova de Gaia. Cada tatuagem começa num desenho feito à mão, para ti.` }),
          el('div', { class: 'v-btns' }, [btn3('Marcar sessão', '#/marcar', 'w'), n ? btn3('Fazer o teste', '#/#teste', 'o', null) : null]),
        ]),
        stamp,
      ]),
    ]);
  };

  const tapes = () => {
    const styles = [...new Set(data.artists.flatMap(styleTags).map((s) => s.replace(/\b\w/g, (c) => c.toUpperCase())))];
    const line = (words) => {
      const span = () => el('span', {}, words.flatMap((w) => [w, el('em', { text: '✶' })]));
      return el('div', { class: 'v-mq' }, [span(), span()]);
    };
    return el('div', { class: 'v-tapes', 'aria-hidden': 'true' }, [
      el('div', { class: 'v-tape light' }, line(['Do papel à pele', 'Desenho à medida', 'Resposta em 48 h', 'Vila Nova de Gaia'])),
      el('div', { class: 'v-tape' }, line([...(styles.length ? styles : ['Sketch', 'Black & grey', 'Black & red']), 'Flash', 'Cover-up'])),
    ]);
  };

  const manifesto = () => {
    const p = data.profile;
    const n = data.artists.length;
    const street = String(p.address || '').split(',')[0].trim();
    const rating = el('div', {}, [el('b', { text: '18+' }), el('span', { text: 'só maiores de idade, com documento' })]);
    getReviews().then((rv) => {
      if (!rv?.rating || data.profile.showGoogleReviews === false) return;
      rating.replaceChildren(el('b', { text: decimal(rv.rating) }), el('span', { text: `de média em ${rv.count} críticas no Google` }));
    });
    return el('section', { class: 'v-manifesto', 'aria-label': 'O estúdio' }, el('div', { class: 'wrap' }, [
      kicker(['O estúdio', street, 'Gaia'].filter(Boolean).join(' · ')),
      el('p', { class: 'big' }, [
        'Aqui não há catálogo. Cada peça começa ',
        el('span', { class: 'v-ipill', 'aria-hidden': 'true' }, v3img('caveira-sketch', '', { pos: '50% 40%' })),
        ' num desenho à mão, ganha forma ',
        el('span', { class: 'v-ipill r', 'aria-hidden': 'true' }, v3img('miguel-bw', '', { pos: '50% 35%' })),
        ' contigo ao lado e só depois ',
        el('span', { class: 'red', text: 'vai para a pele.' }),
      ]),
      el('div', { class: 'v-stats' }, [
        n ? el('div', {}, [el('b', { text: String(n) }), el('span', { text: n === 1 ? 'artista, com o seu traço' : 'artistas residentes, cada um com o seu traço' })]) : null,
        rating,
        el('div', {}, [el('b', { text: '48 h' }), el('span', { text: 'para responder com preço e datas' })]),
        el('div', {}, [el('b', { text: '1:1' }), el('span', { text: 'cada desenho é feito uma vez, para uma pessoa' })]),
      ]),
    ]));
  };

  const lines = (text) => String(text).split('\n').flatMap((line, j) => (j ? [el('br'), line] : [line]));
  const vHead = (title, text, extra, id, tag = 'h2') =>
    el('div', { class: 'v-ahead' }, [
      el(tag, { class: 'disp v-h2', id }, lines(title)),
      text ? el('p', { class: 'v-lead', text }) : null,
      extra || null,
    ]);

  const artistCardV3 = (a, i) => {
    const tags = styleTags(a);
    const hasPhoto = safeUrl(a.photo?.url);
    const go = el('span', { class: 'go', 'aria-hidden': 'true', text: '↗' });
    const words = (tags[0] || a.displayName).split(/\s+/).pop();
    const name = el('div', { class: 'name' }, a.displayName.split(/\s+/).flatMap((w, j) => (j ? [el('br'), w] : [w])));
    if (hasPhoto) {
      return el('a', { class: 'v-acard', href: artistHref(a), 'aria-label': `${a.displayName}${a.styles ? `, ${a.styles}` : ''}` }, [
        el('img', { class: 'ph', src: a.photo.url, alt: '', loading: 'lazy', decoding: 'async' }),
        el('div', { class: 'over' }, [
          el('div', { class: 'tags' }, tags.map((t) => el('span', { text: t }))),
          el('div', {}, [a.fullName ? mono(a.fullName) : null, name]),
        ]),
        go,
      ]);
    }
    return el('a', { class: `v-acard typo ${i % 2 ? 'ink' : 'red'}`, href: artistHref(a), 'aria-label': `${a.displayName}${a.styles ? `, ${a.styles}` : ''}` }, [
      el('div', { class: 'bgword', 'aria-hidden': 'true', text: `${words} ${words}` }),
      el('span', { class: 'soon hand', 'aria-hidden': 'true', text: 'retrato em breve' }),
      el('div', { class: 'over' }, [
        el('div', { class: 'tags' }, tags.map((t) => el('span', { text: t }))),
        el('div', {}, [a.fullName ? mono(a.fullName) : null, name]),
      ]),
      go,
    ]);
  };

  const artistsV3 = () => {
    const n = data.artists.length;
    if (!n) return null;
    const words = ['Uma', 'Duas', 'Três', 'Quatro', 'Cinco'][n - 1];
    return el('section', { class: 'v-sec', id: 'artistas', 'aria-labelledby': 'artists-title' }, el('div', { class: 'wrap' }, [
      vHead(words ? `${words} ${n === 1 ? 'mão' : 'mãos'}.\n${n === 1 ? 'Um traço' : `${words === 'Duas' ? 'Dois' : words} traços`}.` : 'Os artistas.', 'Escolhe pelo traço. Cada artista tem portfólio, flash e agenda próprios.', null, 'artists-title'),
      el('div', { class: `v-acards n${Math.min(n, 3)}` }, data.artists.map(artistCardV3)),
    ]));
  };

  // "Do papel à pele": the same piece as a drawing and as a finished piece, with a drag handle.
  const splitPiece = () => {
    const box = el('figure', { class: 'v-split', style: '--pos:54%' });
    const range = el('input', {
      type: 'range', min: '0', max: '100', value: '54', 'aria-label': 'Comparar o desenho a lápis com a peça a cor',
      oninput: (e) => box.style.setProperty('--pos', `${e.target.value}%`),
    });
    box.append(
      el('div', { class: 'half' }, v3img('vespa-aguarela', 'A vespa já pintada a cor', { big: true })),
      el('div', { class: 'half left' }, v3img('vespa-lapis', 'A vespa desenhada a lápis', { big: true })),
      el('div', { class: 'bar', 'aria-hidden': 'true' }),
      el('div', { class: 'knob', 'aria-hidden': 'true', text: '↔' }),
      el('span', { class: 'tag hand l', 'aria-hidden': 'true', text: 'lápis' }),
      el('span', { class: 'tag hand r', 'aria-hidden': 'true', text: 'cor' }),
      range,
      el('figcaption', { class: 'mono', text: 'Do papel à pele · arrasta para comparar' }),
    );
    return box;
  };

  const portfolioV3 = () => {
    let filter = 'all';
    const grid = el('div', { class: 'v-bento' });
    const tileFor = (p, cls) => el('button', { type: 'button', class: `v-tile ${cls}`, 'aria-label': `Ver maior: ${p.title || 'tatuagem'}`, onclick: () => openViewer(p, workCaption(p)) }, [
      el('img', { src: p.image?.url, alt: p.title || '', loading: 'lazy', decoding: 'async' }),
      el('span', { class: 'lab mono', text: [artistName(p.artistId), p.style].filter(Boolean).join(' · ') || p.title || '' }),
    ]);
    const draw = () => {
      const items = work().filter((w) => safeUrl(w.image?.url) && (filter === 'all' || w.artistId === filter));
      const featured = items.filter((w) => w.featured);
      const pick = (featured.length >= 4 ? featured : items).slice(0, 4);
      const more = el('a', { class: 'v-tile more', href: filter === 'all' ? '#/portfolio' : `#/portfolio?artista=${encodeURIComponent(filter)}` }, [
        el('span', { class: 'disp' }, ['Ver portfólio', el('br'), 'completo']), el('span', { class: 'dot', 'aria-hidden': 'true', text: '↗' }),
      ]);
      grid.replaceChildren(
        splitPiece(),
        ...(pick[0] ? [tileFor(pick[0], 't-a')] : []),
        more,
        ...pick.slice(1).map((p) => tileFor(p, 't-b')),
      );
      if (!pick.length) grid.append(el('p', { class: 'empty', text: 'Ainda não há trabalhos publicados aqui.' }));
    };
    draw();
    const chips = data.artists.length > 1
      ? el('div', { class: 'v-chips', role: 'group', 'aria-label': 'Filtrar por artista' }, [{ id: 'all', displayName: 'Todos' }, ...data.artists].map((a) =>
          el('button', {
            type: 'button', class: 'v-chip', 'aria-pressed': String(a.id === filter), text: a.displayName,
            onclick: (e) => { filter = a.id; $$('.v-chip', e.currentTarget.parentNode).forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); draw(); },
          })))
      : null;
    return el('section', { class: 'v-sec', id: 'portfolio', 'aria-labelledby': 'port-title' }, el('div', { class: 'wrap' }, [
      vHead('Trabalho\nrecente.', null, chips, 'port-title'),
      grid,
    ]));
  };

  const flashV3 = ({ items = flash(), title = 'Flash\nda casa.', text = 'Desenhos prontos a tatuar, feitos no estúdio. Cada um só se tatua uma vez: depois sai da lista.', id = 'flash', moreHref = '#/portfolio?cat=flash' } = {}) => {
    if (!items.length) return null;
    const rot = ['-3deg', '2deg', '-1.5deg', '3deg'];
    return el('section', { class: `v-flash${items.length < 3 ? ' compact' : ''}`, id, 'aria-labelledby': `${id}-title` }, [
      v3img('armario', '', { big: true, sizes: '100vw' }),
      el('div', { class: 'wrap' }, [
        vHead(title, text, null, `${id}-title`),
        el('div', { class: `v-frows${items.length < 4 ? ` n${items.length}` : ''}` }, [
          el('span', { class: 'v-sticker hand', 'aria-hidden': 'true', text: 'só 1 de cada!' }),
          ...items.slice(0, 4).map((p, i) => {
            const params = new URLSearchParams({ tipo: 'flash' });
            if (p.artistId) params.set('artista', p.artistId);
            if (p.flashNumber) params.set('flash', p.flashNumber);
            const specs = [artistName(p.artistId), p.flashSize].filter(Boolean).join(' · ');
            const price = p.priceFrom ? `desde ${eur(p.priceFrom)}`.replace(/ /g, '\u00a0') : '';
            return el('div', { class: 'v-fcard', style: `--r:${rot[i % 4]}` }, [
              el('button', { type: 'button', class: 'img', 'aria-label': `Ver maior: flash ${p.flashNumber || p.title}`, onclick: () => openViewer(p, `Flash nº ${p.flashNumber || ''} · ${artistName(p.artistId)}`) },
                el('img', { src: p.image?.url, alt: p.title || 'Flash', loading: 'lazy', decoding: 'async' })),
              el('div', { class: 'meta' }, [
                el('span', {}, [el('span', { class: 'num', text: p.flashNumber ? `Nº ${p.flashNumber}` : p.title }), specs ? mono(specs) : null, price ? el('span', { class: 'mono price', text: price }) : null]),
                el('a', { class: 'gb', href: `#/marcar?${params}`, 'aria-label': `Marcar o flash ${p.flashNumber || p.title}`, text: '↗' }),
              ]),
            ]);
          }),
        ]),
        items.length > 4 ? el('p', { class: 'v-more' }, btn3('Ver todo o flash', moreHref, 'w')) : null,
      ]),
    ]);
  };

  const reviewsV3 = () => {
    if (data.profile.showGoogleReviews === false) return null;
    const box = el('section', { class: 'v-rev', id: 'criticas', 'aria-labelledby': 'reviews-title', hidden: true });
    getReviews().then((rv) => {
      if (!rv || !rv.count || !rv.reviews?.length) return box.remove();
      const quote = (r, i) => el('figure', { class: `v-quote q${i}` }, [
        el('blockquote', {}, el('p', { text: r.text })),
        el('figcaption', { class: 'who' }, [
          r.authorPhoto ? el('img', { src: r.authorPhoto, alt: '', width: '40', height: '40', loading: 'lazy', referrerpolicy: 'no-referrer' }) : el('i', { 'aria-hidden': 'true', text: r.author.slice(0, 1) }),
          el('span', {}, [
            r.authorUrl ? el('a', { href: r.authorUrl, ...ext, text: r.author }) : el('b', { text: r.author }),
            mono(['Google', '★'.repeat(Math.round(r.rating)), r.relativeTime].filter(Boolean).join(' · ')),
          ]),
        ]),
      ]);
      box.append(el('div', { class: 'wrap v-revgrid' }, [
        el('div', { class: 'v-score-col' }, [
          kicker('Críticas no Google'),
          el('h2', { class: 'visually-hidden', id: 'reviews-title', text: 'Críticas no Google' }),
          rv.rating ? el('p', { class: 'disp v-score', 'aria-hidden': 'true', text: decimal(rv.rating) }) : null,
          rv.rating ? stars(rv.rating, 'big') : null,
          el('p', { class: 'v-lead', text: `${rv.rating ? `${decimal(rv.rating)} em 5, ` : ''}${rv.count} ${rv.count === 1 ? 'crítica' : 'críticas'}. Mostramos as mais recentes, tal como foram escritas.` }),
          el('div', { class: 'v-btns' }, [
            safeUrl(rv.reviewsUrl) ? btn3('Ver no Google', rv.reviewsUrl, 'k', '↗', ext) : null,
            safeUrl(rv.writeReviewUrl) ? btn3('Deixar uma crítica', rv.writeReviewUrl, 'o', null, ext) : null,
          ]),
          el('p', { class: 'mono muted', text: rv.demo ? 'Exemplo · os textos reais vêm do Google Maps' : 'Fonte: Google Maps' }),
        ]),
        el('div', { class: 'v-qcol' }, rv.reviews.slice(0, 3).map(quote)),
      ]));
      box.hidden = false;
    });
    return box;
  };

  const studioV3 = () => {
    const p = data.profile;
    const wa = whatsappUrl();
    const mapUrl = p.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.address} ${p.city || ''}`)}` : null;
    const [days, hours] = String(p.openingHours || '').split(/,\s*/);
    const tile = (name, alt, cls, lab, pos) => el('button', { type: 'button', class: `v-tile ${cls}`, 'aria-label': `Ver maior: ${alt}`, onclick: () => openViewer({ image: { url: new URL(`assets/v3/${name}-1600.webp`, location.href).href }, title: alt }, alt) }, [
      v3img(name, alt, { pos, big: true, sizes: '(max-width: 760px) 100vw, 40vw' }), lab ? el('span', { class: 'lab mono', text: lab }) : null,
    ]);
    const estudio = (name, alt, cls, lab) => el('button', { type: 'button', class: `v-tile ${cls}`, 'aria-label': `Ver maior: ${alt}`, onclick: () => openViewer({ image: { url: new URL(`assets/estudio/${name}-1600.webp`, location.href).href }, title: alt }, alt) }, [
      el('img', { src: `assets/estudio/${name}-800.webp`, srcset: `assets/estudio/${name}-800.webp 800w, assets/estudio/${name}-1600.webp 1600w`, sizes: '(max-width: 760px) 100vw, 40vw', alt, loading: 'lazy', decoding: 'async' }),
      lab ? el('span', { class: 'lab mono', text: lab }) : null,
    ]);
    return el('section', { class: 'v-sec', id: 'estudio', 'aria-labelledby': 'studio-title' }, el('div', { class: 'wrap' }, [
      vHead('Vem\nconhecer.', p.bio || 'Um estúdio pequeno, com tempo para cada desenho. Material descartável e esterilizado, sempre.', null, 'studio-title'),
      el('div', { class: 'v-sgrid' }, [
        tile('bandeira', 'Bandeira do estúdio com o olho e o nome ink compatível', 's-flag'),
        estudio('carrinho-autocolantes', 'Carrinho vermelho de trabalho, coberto de autocolantes', 's-cart', 'O carrinho'),
        el('div', { class: 'v-info' }, [
          el('div', {}, [
            mono(`${p.name || 'Ink Compatível'} · Gaia`),
            el('p', { class: 'disp big', text: hours ? days : 'Com marcação' }),
            el('dl', {}, [
              p.address ? [el('dt', { class: 'mono', text: 'Morada' }), el('dd', { text: [p.address, p.city].filter(Boolean).join(', ') })] : [],
              p.openingHours ? [el('dt', { class: 'mono', text: 'Horário' }), el('dd', { text: hours ? `${hours}, com marcação` : p.openingHours })] : [],
              p.phone || wa ? [el('dt', { class: 'mono', text: 'Contacto', id: 'contactos' }), el('dd', {}, [
                p.phone ? el('a', { href: `tel:${digits(p.phone)}`, text: p.phone }) : null,
                p.phone && wa ? ' · ' : null,
                wa ? el('a', { href: wa, ...ext, text: 'WhatsApp' }) : null,
              ])] : [],
            ].flat()),
          ]),
          mapUrl ? el('div', { class: 'v-btns' }, btn3('Como chegar', mapUrl, 'w', '↗', ext)) : null,
        ]),
        estudio('garrafas', 'Garrafas decoradas em caixas de madeira na parede', 's-bottles'),
        tile('trofeus', 'Troféus de convenções de tatuagem', 's-trophy', 'Prémios', '40% 50%'),
        el('div', { class: 'v-tile s-note' }, [
          el('span', { class: 'hand', text: 'antes de vir →' }),
          el('span', { text: p.depositInfo ? `18+, dorme bem, come antes. ${p.depositInfo}` : '18+, dorme bem, come antes. O sinal desconta no preço.' }),
        ]),
      ]),
    ]));
  };

  const prodCard = (item) => {
    const b = shopBadge(item);
    const link = item.kind === 'merch' ? safeUrl(item.externalUrl) : null;
    const left = item.kind === 'edition' && item.editionSize ? Math.max(0, Math.min(1, (item.stock || 0) / item.editionSize)) : null;
    return el('a', { class: 'v-prod', href: link || `#/loja/${encodeURIComponent(item.id)}`, ...(link ? ext : {}) }, [
      el('div', { class: `img k-${item.kind}` }, [
        el('img', { src: item.image?.url, alt: item.title, loading: 'lazy', decoding: 'async' }),
        el('span', { class: `bdg mono${/gone/.test(b.cls) ? ' gone' : ''}`, text: item.kind === 'original' && b.text === 'Peça única' ? (item.medium && /madeira|acr|óleo|tela/i.test(item.medium) ? 'Pintura original' : 'Original') : b.text }),
      ]),
      el('div', { class: 'row' }, [el('b', { text: item.title }), mono(shopPriceLine(item))]),
      left !== null ? el('div', { class: 'stock', role: 'img', 'aria-label': `Restam ${item.stock || 0} de ${item.editionSize}` }, el('i', { style: `width:${Math.round(left * 100)}%` })) : null,
    ]);
  };

  const shopV3 = () => {
    const firstOf = (kind) => data.shop.find((i) => i.kind === kind && (kind === 'merch' || sellable(i))) || data.shop.find((i) => i.kind === kind);
    const picks = [firstOf('original'), firstOf('edition'), firstOf('merch')].filter(Boolean);
    if (!picks.length) return null;
    return el('section', { class: 'v-sec', id: 'loja', 'aria-labelledby': 'shop-title' }, el('div', { class: 'wrap' }, [
      vHead('Leva arte\npara casa.', null, btn3('Ir à loja', '#/loja', 'k'), 'shop-title'),
      el('div', { class: 'v-pgrid' }, picks.map(prodCard)),
    ]));
  };

  const instagramV3 = () => {
    const ig = instagramUrl(data.profile.instagram);
    const posts = (data.profile.instagramPosts || []).filter((p) => safeUrl(p.url) && safeUrl(p.image?.url)).slice(0, 6);
    if (!ig || posts.length < 3) return null;
    return el('section', { class: 'v-sec', id: 'instagram', 'aria-labelledby': 'insta-title' }, el('div', { class: 'wrap' }, [
      el('div', { class: 'v-ahead' }, [
        el('div', {}, [kicker(ig.label), el('h2', { class: 'disp v-h2', id: 'insta-title' }, ['Acabado de sair', el('br'), 'da agulha.'])]),
        btn3('Seguir no Instagram', ig.url, 'o', '↗', ext),
      ]),
      el('ul', { class: 'v-igrow' }, posts.map((p, i) =>
        el('li', {}, el('a', { href: p.url, ...ext, 'aria-label': `Abrir no Instagram: ${p.alt || `post ${i + 1}`}` },
          el('img', { src: p.image.url, alt: p.alt || '', loading: 'lazy', decoding: 'async' }))))),
    ]));
  };

  const ctaV3 = () => {
    const wa = whatsappUrl('Olá! Queria marcar uma tatuagem.');
    return el('section', { class: 'v-cta v-grid', 'aria-labelledby': 'cta-title' }, [
      el('p', { class: 'hand v-cta-hand', 'aria-hidden': 'true', text: 'e agora?' }),
      el('h2', { class: 'disp', id: 'cta-title' }, ['Tens uma', el('br'), 'ideia?']),
      el('p', { class: 'v-cta-text', text: 'Conta-nos o que imaginas. Respondemos em 48 h com preço e datas.' }),
      el('div', { class: 'v-btns center' }, [btn3('Marcar sessão', '#/marcar', 'w'), wa ? btn3('WhatsApp', wa, 'o', null, ext) : null]),
      polaroid('vespa-lapis', '', 'a tua ideia', 'cta-a'),
      polaroid('tatuagem-081', '', 'na tua pele', 'cta-b'),
    ]);
  };

  // Shared CTA used by other pages.
  const ctaBlock = ctaV3;

  // ------------------------------------------------------------------ Google reviews (live from /api/reviews)
  let reviewsRequest = null;
  const getReviews = () => {
    if (!reviewsRequest) {
      reviewsRequest = APP_API
        ? fetch(`${APP_API}/api/reviews`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        : Promise.resolve(null);
    }
    return reviewsRequest;
  };
  const decimal = (n) => new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
  const stars = (n, cls = '') =>
    el('span', { class: `stars ${cls}`.trim(), role: 'img', 'aria-label': `${decimal(n)} de 5 estrelas` },
      [1, 2, 3, 4, 5].map((i) => el('span', { class: i <= Math.round(n) ? 'on' : '', 'aria-hidden': 'true', text: '★' })));

  // ------------------------------------------------------------------ compatibility test
  // Four steps: line, colour, size, body zone (+ "first tattoo" box). Line, colour and size score each artist
  // by the words in their "Estilos" (set in the app), weighted 50/30/20; "não sei" counts as compatible.
  // Zone, size, style and first tattoo travel to the booking form.
  const FINE = ['fine', 'fina', 'delicad', 'minimal'];
  const QUIZ = [
    {
      key: 'traco', q: 'Que traço te puxa mais?', weight: 50,
      options: [
        { label: 'Esboço solto', sub: 'Riscos à vista', img: 'caveira-sketch', tags: ['sketch', 'esboço', 'ilustra'], style: 'Sketch', say: 'traço de esboço' },
        { label: 'Sombras realistas', sub: 'Black & grey', img: 'tatuagem-009', tags: ['grey', 'gray', 'cinza', 'realis'], style: 'Black & grey', say: 'sombras em black & grey' },
        { label: 'Preto e vermelho', sub: 'Contraste forte', img: 'ig-caveira-flores', tags: ['red', 'vermelho'], style: 'Black & red', say: 'contraste preto e vermelho' },
        { label: 'Linha fina', sub: 'Delicada', img: 'tatuagem-015', tags: [...FINE, 'ornament'], style: 'Não sei', say: 'linha fina' },
        { label: 'Aguarela', sub: 'Manchas de cor', img: 'castelo-aguarela', tags: ['watercolor', 'aguarela'], style: 'Aguarela', say: 'aguarela' },
        { label: 'Ainda não sei', sub: 'Ajudamos a escolher', any: true, style: 'Não sei', say: 'traço em aberto' },
      ],
    },
    {
      key: 'cor', q: 'E de cor?', weight: 30,
      options: [
        { label: 'Só preto', sub: 'Tinta preta e cinzas', tags: ['grey', 'gray', 'cinza', 'sketch', 'blackwork', 'realis', 'dotwork', 'ornament', ...FINE], say: 'só a preto' },
        { label: 'Com vermelho', sub: 'Um toque, ou muito', tags: ['red', 'vermelho'], say: 'com vermelho' },
        { label: 'Com cor', sub: 'Aguarela, manchas', tags: ['watercolor', 'aguarela', 'color', 'colour', 'a cores'], say: 'com cor' },
        { label: 'Tanto faz', sub: 'Decidimos juntos', any: true, say: 'cor em aberto' },
      ],
    },
    {
      key: 'tamanho', q: 'Que tamanho imaginas?', weight: 20,
      options: [
        { label: 'Pequena', sub: 'Até 8 cm', any: true, size: 'Pequena, até 8 cm', say: 'pequena' },
        { label: 'Média', sub: 'Do tamanho da mão', any: true, size: 'Média, do tamanho da mão', say: 'média' },
        // Big pieces suit everyone except artists who only do fine line.
        { label: 'Grande', sub: 'Braço, costas, perna', size: 'Grande (braço, costas ou perna)', say: 'peça grande', fits: (s) => !FINE.some((t) => s.includes(t)) || /sketch|grey|realis|red/.test(s) },
        { label: 'Ainda não sei', sub: 'Vemos contigo', any: true, size: '', say: 'tamanho em aberto' },
      ],
    },
    {
      key: 'zona', q: 'Em que zona do corpo?', first: true,
      options: ['Braço', 'Perna', 'Costas', 'Peito', 'Mão', 'Outra'].map((z) => ({ label: z, zone: z })),
    },
  ];

  /** For each artist: % compatible, and which answers match ("combina") or are open for a chat ("a conversar"). */
  const quizScore = (answers) =>
    data.artists
      .map((a) => {
        const styles = String(a.styles || '').toLowerCase();
        let pct = 0;
        const yes = [];
        const talk = [];
        QUIZ.forEach((s, i) => {
          const o = s.options[answers[i]];
          if (!s.weight || !o) return;
          const ok = o.any || (o.fits ? o.fits(styles) : o.tags.some((t) => styles.includes(t)));
          if (ok) pct += s.weight;
          if (ok && !o.any) yes.push(o.say);
          if (!ok) talk.push(o.say);
        });
        return { a, pct, yes, talk };
      })
      .sort((x, y) => y.pct - x.pct || (y.a.acceptsBookings !== false) - (x.a.acceptsBookings !== false));

  // Dark block: intro on the left; on the right the question card with the result card overlapping it.
  const quizBlock = ({ standalone = false } = {}) => {
    const answers = [];
    let step = 0;
    let firstTattoo = false;
    const qcard = el('div', { class: 'v-qcard', 'aria-live': 'polite' });
    const rcard = el('div', { class: 'v-rcard' });
    const focusHead = () => { const h = qcard.querySelector('[data-quiz-focus]'); if (h && draw.moved) h.focus(); draw.moved = true; };

    const questionView = () => {
      const s = QUIZ[step];
      return [
        el('div', { class: 'v-qtop' }, [
          mono(`Pergunta ${step + 1} de ${QUIZ.length}`, 'quiz-count'),
          step > 0 ? el('button', { type: 'button', class: 'quiz-back mono', onclick: () => { step -= 1; draw(); }, text: '← Voltar' }) : null,
        ]),
        el('div', { class: 'v-bars', 'aria-hidden': 'true' }, QUIZ.map((_, i) => el('i', { class: i <= step ? 'on' : '' }))),
        el('h3', { class: 'quiz-q', tabindex: '-1', 'data-quiz-focus': '', id: `quiz-q-${step}`, text: s.q }),
        s.first
          ? el('label', { class: 'quiz-check' }, [
              el('input', { type: 'checkbox', checked: firstTattoo || null, onchange: (e) => { firstTattoo = e.target.checked; } }),
              'É a minha primeira tatuagem',
            ])
          : null,
        el('div', { class: `v-opts${s.first ? ' three' : ''}`, role: 'group', 'aria-labelledby': `quiz-q-${step}` }, s.options.map((o, i) =>
          el('button', { type: 'button', class: 'v-opt', 'aria-pressed': String(answers[step] === i), onclick: () => { answers[step] = i; step += 1; draw(); } }, [
            o.img ? el('span', { class: 'sw', 'aria-hidden': 'true' }, el('img', { src: `assets/v3/${o.img}-800.webp`, alt: '', loading: 'lazy' })) : null,
            el('span', {}, [el('b', { text: o.label }), o.sub ? el('small', { text: o.sub }) : null]),
          ]))),
      ];
    };

    const teaser = () => [
      mono('O teu resultado'),
      el('div', { class: 'v-pctrow' }, [el('span', { class: 'disp pct', text: '??%' }), el('span', {}, ['compatível', el('br'), 'com…'])]),
      el('p', { class: 'small', text: 'Responde às quatro perguntas e descobre.' }),
    ];

    const resultView = () => {
      const answer = (k) => { const i = QUIZ.findIndex((s) => s.key === k); return QUIZ[i].options[answers[i]] || {}; };
      const traco = answer('traco');
      const size = answer('tamanho');
      const zone = answer('zona');
      const params = new URLSearchParams();
      if (traco.style) params.set('estilo', traco.style);
      if (size.size) params.set('tamanho', size.size);
      if (zone.zone) params.set('zona', zone.zone);
      if (firstTattoo) params.set('primeira', '1');
      const restart = el('button', { type: 'button', class: 'quiz-back mono', onclick: () => { answers.length = 0; step = 0; firstTattoo = false; draw(); }, text: '↺ Refazer o teste' });
      const firstNote = firstTattoo ? el('p', { class: 'quiz-note', text: 'Primeira tatuagem? Explicamos tudo com calma: antes, durante a sessão e nos cuidados depois.' }) : null;

      const best = quizScore(answers)[0];
      if (!best) {
        rcard.replaceChildren(mono('O teu resultado'), el('p', { class: 'disp name', text: 'Fala connosco' }), btn3('Marcar sessão', `#/marcar?${params}`, 'w'));
        return [el('h3', { class: 'quiz-q', tabindex: '-1', 'data-quiz-focus': '', text: 'Conta-nos a ideia' }), restart];
      }
      const a = best.a;
      const bookable = a.acceptsBookings !== false && data.profile.bookingOpen !== false;
      params.set('artista', a.id);
      params.set('pct', String(best.pct));
      const also = quizScore(answers).slice(1).find((r) => r.pct >= 50);
      const artistFlash = flash().filter((f) => f.artistId === a.id).slice(0, 3);
      rcard.replaceChildren(
        mono('O teu resultado'),
        el('p', { class: 'v-pctrow quiz-pct' }, [el('span', { class: 'disp pct', text: `${best.pct}%` }), el('span', {}, ['És compatível', el('br'), 'com'])]),
        el('p', { class: 'disp name', text: a.displayName }),
        bookable ? btn3(`Marcar com ${a.displayName}`, `#/marcar?${params}`, 'w') : mono('Agenda fechada de momento'),
      );
      return [
        el('div', { class: 'v-qtop' }, [mono('O teu resultado', 'quiz-count'), restart]),
        el('h3', { class: 'quiz-q', tabindex: '-1', 'data-quiz-focus': '', text: `És ${best.pct}% compatível com ${a.displayName}` }),
        el('ul', { class: 'quiz-match' }, [
          ...best.yes.map((t) => el('li', { class: 'yes' }, [el('span', { 'aria-hidden': 'true', text: '✓' }), `Combina: ${t}`])),
          ...best.talk.map((t) => el('li', { class: 'talk' }, [el('span', { 'aria-hidden': 'true', text: '…' }), `A conversar: ${t}`])),
          zone.zone ? el('li', {}, [el('span', { 'aria-hidden': 'true', text: '·' }), `Zona: ${zone.zone.toLowerCase()}`]) : null,
        ]),
        also ? el('p', { class: 'small' }, ['Também combina contigo: ', el('a', { href: artistHref(also.a), text: `${also.a.displayName} (${also.pct}%)` }), '.']) : null,
        firstNote,
        artistFlash.length
          ? el('div', { class: 'quiz-flash' }, [
              mono(`Flash de ${a.displayName} pronto a tatuar`),
              el('div', { class: 'quiz-flash-row' }, artistFlash.map((f) =>
                el('a', { href: `#/marcar?${new URLSearchParams({ artista: a.id, tipo: 'flash', ...(f.flashNumber ? { flash: f.flashNumber } : {}) })}`, 'aria-label': `Marcar o flash ${f.flashNumber || f.title}` }, [
                  el('img', { src: f.image?.url, alt: '', loading: 'lazy' }),
                  f.flashNumber ? mono(`Nº ${f.flashNumber}`) : null,
                ]))),
            ])
          : null,
        el('p', { class: 'small' }, el('a', { class: 'lnk', href: artistHref(a), text: `Ver o portfólio de ${a.displayName}` })),
      ];
    };

    const draw = () => {
      const done = step >= QUIZ.length;
      if (!done) rcard.replaceChildren(...teaser());
      qcard.replaceChildren(...[].concat(done ? resultView() : questionView()).filter(Boolean));
      rcard.classList.toggle('done', done);
      focusHead();
    };
    draw();

    const titleTag = standalone ? 'h1' : 'h2';
    return el('section', { class: `v-teste${standalone ? ' standalone' : ''}`, id: 'teste', 'aria-labelledby': 'quiz-title' }, [
      el('img', { class: 'v-eye', src: 'assets/ink-compativel-olho-claro.svg', alt: '' }),
      el('div', { class: 'wrap v-tgrid' }, [
        el('div', {}, [
          kicker('Teste de compatibilidade · 1 minuto', 'light'),
          el(titleTag, { class: 'disp v-h2', id: 'quiz-title' }, ['Com quem', el('br'), 'és ', el('span', { class: 'red', text: 'compatível?' })]),
          el('p', { class: 'v-lead', text: 'Quatro perguntas sobre traço, cor, tamanho e zona. No fim dizemos-te qual dos artistas combina contigo, e a marcação abre já preenchida.' }),
          el('button', { type: 'button', class: 'v-btn w', onclick: () => { qcard.scrollIntoView({ block: 'center', behavior: 'smooth' }); qcard.querySelector('.v-opt')?.focus({ preventScroll: true }); } }, ['Começar o teste', el('i', { 'aria-hidden': 'true', text: '→' })]),
        ]),
        el('div', { class: 'v-qstage' }, [qcard, rcard]),
      ]),
    ]);
  };

  const workCaption = (p) => [artistName(p.artistId), p.style, p.title].filter(Boolean).join(' · ');

  const workGrid = (items, { min = '260px' } = {}) =>
    items.length
      ? el('div', { class: 'grid tight two-up', style: `--min:${min}` }, items.map((p) =>
          el('figure', { class: 'stack', style: 'margin:0;gap:8px' }, [
            zoomable(p, 'r11', workCaption(p)),
            el('figcaption', { class: 'mono muted', text: [p.title, p.style].filter(Boolean).join(' · ') }),
          ])
        ))
      : el('p', { class: 'empty', text: 'Ainda não há trabalhos publicados aqui.' });

  const flashCard = (p) => {
    const specs = [p.flashSize, p.flashSessions ? `${p.flashSessions} ${p.flashSessions === 1 ? 'sessão' : 'sessões'}` : '', p.priceFrom ? `desde ${eur(p.priceFrom)}` : '']
      .filter(Boolean)
      .join(' · ');
    const params = new URLSearchParams({ tipo: 'flash' });
    if (p.artistId) params.set('artista', p.artistId);
    if (p.flashNumber) params.set('flash', p.flashNumber);
    return el('div', { class: 'stack', style: 'gap:10px' }, [
      zoomable(p, 'r11', `Flash nº ${p.flashNumber || ''} · ${artistName(p.artistId)}`),
      mono([p.flashNumber ? `Flash nº ${p.flashNumber}` : p.title, artistName(p.artistId)].filter(Boolean).join(' · '), 'muted'),
      specs ? mono(specs) : null,
      el('a', { href: `#/marcar?${params}`, class: 'lnk', style: 'color:inherit', text: 'Quero este' }),
    ]);
  };

  const shopBadge = (item) => {
    if (item.kind === 'merch') return { text: merchStoreName(item.externalUrl), cls: 'badge light' };
    if (item.kind === 'original') {
      if (item.status === 'sold') return { text: 'Vendida', cls: 'badge gone' };
      if (item.status === 'reserved') return { text: 'Reservada', cls: 'badge gone' };
      return { text: 'Peça única', cls: 'badge' };
    }
    if ((item.stock || 0) <= 0) return { text: 'Esgotada', cls: 'badge gone' };
    return { text: item.editionSize ? `Edição de ${item.editionSize}` : 'Edição limitada', cls: 'badge' };
  };

  const merchStoreName = (url) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      if (host.includes('redbubble')) return 'Redbubble';
      if (host.includes('printful')) return 'Printful';
      return host;
    } catch {
      return 'Loja externa';
    }
  };

  const shopPriceLine = (item) => {
    if (item.kind === 'merch') return `No ${merchStoreName(item.externalUrl)} ↗ · desde ${eur(item.price)}`;
    if (item.kind === 'original') return item.status === 'sold' ? 'Vendida' : item.status === 'reserved' ? `${eur(item.price)} · reservada` : eur(item.price);
    return (item.stock || 0) > 0 ? `${eur(item.price)} · restam ${item.stock}` : 'Esgotada';
  };

  const shopCard = (item) => {
    const badge = shopBadge(item);
    const ext = item.kind === 'merch' ? safeUrl(item.externalUrl) : null;
    const spec = [artistName(item.artistId), item.dimensions, item.medium].filter(Boolean).join(' · ');
    return el('a', {
      class: 'card',
      href: ext || `#/loja/${encodeURIComponent(item.id)}`,
      target: ext ? '_blank' : null,
      rel: ext ? 'noopener noreferrer' : null,
    }, [
      el('div', { style: 'position:relative' }, [el('span', { class: `mono ${badge.cls}`, text: badge.text }), photo(item.image, item.title, 'r45')]),
      el('span', { class: 'card-title', text: item.title }),
      spec ? mono(spec, 'muted') : null,
      mono(shopPriceLine(item)),
    ]);
  };

  const artistCard = (a) =>
    el('a', { class: 'card', href: `#/artistas/${encodeURIComponent(a.id)}` }, [
      photo(a.photo, `Retrato de ${a.displayName}`, 'r34'),
      el('span', { class: 'disp artist-name', text: a.displayName }),
      a.styles ? mono(a.styles, 'muted') : null,
      el('span', { class: 'lnk', text: 'Ver trabalho' }),
    ]);

  const steps = () =>
    el('ol', { class: 'steps' }, [
      ['01', 'Conta a ideia', 'Zona, tamanho, referências. Respondemos em 48 h com preço e datas.'],
      ['02', 'Afinamos o esboço', 'O desenho é feito para ti. Só marcamos quando estiver certo.'],
      ['03', 'Sessão', 'Material descartável, espaço esterilizado, tempo sem pressa.'],
      ['04', 'Cuidados', 'Levas as instruções por escrito e falamos contigo na primeira semana.'],
    ].map(([n, t, d]) => el('li', {}, [mono(n, 'muted'), el('span', { class: 'disp', text: t }), el('span', { class: 'muted', text: d })])));

  const notice = (text, error = false) => el('div', { class: `notice${error ? ' error' : ''}`, role: error ? 'alert' : 'status' }, el('p', { text }));

  // ------------------------------------------------------------------ pages
  const pages = {};

  pages.home = () => [
    heroV3(),
    tapes(),
    manifesto(),
    artistsV3(),
    portfolioV3(),
    data.artists.length ? quizBlock() : null,
    flashV3(),
    reviewsV3(),
    studioV3(),
    shopV3(),
    instagramV3(),
    ctaV3(),
  ];

  const studioSection = ({ full = false } = {}) => {
    const p = data.profile;
    const wa = whatsappUrl();
    const ig = instagramUrl(p.instagram);
    const mapUrl = p.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.address} ${p.city || ''}`)}` : null;
    const contacts = [
      wa ? el('a', { href: wa, target: '_blank', rel: 'noopener noreferrer', text: 'WhatsApp' }) : null,
      ig ? el('a', { href: ig.url, target: '_blank', rel: 'noopener noreferrer', text: 'Instagram' }) : null,
      p.email ? el('a', { href: `mailto:${p.email}`, text: p.email }) : null,
      p.phone ? el('a', { href: `tel:${digits(p.phone)}`, text: p.phone }) : null,
    ].filter(Boolean);
    const facts = [
      p.address ? ['Morada', [p.address, p.city].filter(Boolean).join(' · ')] : null,
      p.openingHours ? ['Horário', p.openingHours] : null,
    ].filter(Boolean);
    return el('section', { class: 'section rule', id: 'estudio' }, el('div', { class: 'wrap', style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:48px;align-items:start' }, [
      el('div', { class: 'stack', style: 'gap:8px' }, [
        studioImg(STUDIO_PHOTOS.main),
        el('div', { class: 'studio-strip' }, STUDIO_PHOTOS.strip.map((ph) => studioImg(ph, 'r11', '(max-width: 640px) 50vw, 160px'))),
      ]),
      el('div', { class: 'stack' }, [
        el(full ? 'h1' : 'h2', { class: 'disp h2', text: 'O estúdio' }),
        p.bio ? el('p', { class: 'muted', style: 'margin:0;white-space:pre-line', text: p.bio }) : null,
        el('dl', { class: 'facts' }, [
          ...facts.flatMap(([k, v]) => [el('dt', { class: 'mono', text: k }), el('dd', { text: v })]),
          contacts.length ? el('dt', { class: 'mono', text: 'Contacto', id: 'contactos' }) : null,
          contacts.length ? el('dd', {}, contacts.flatMap((c, i) => (i ? [' · ', c] : [c]))) : null,
        ]),
        mapUrl ? el('p', { style: 'margin:0' }, el('a', { class: 'lnk', href: mapUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Abrir no mapa ↗' })) : null,
        el('h3', { class: 'disp', style: 'font-size:32px;margin-top:16px', text: 'Antes de vir' }),
        el('ul', { style: 'margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px' }, [
          'Só tatuamos maiores de 18 anos, com documento de identificação.',
          'Dorme bem, come antes da sessão e evita álcool nas 24 h anteriores.',
          p.depositInfo || 'A data fica marcada com um sinal, que desconta no preço final.',
        ].map((t) => el('li', { text: t }))),
      ]),
    ]));
  };

  const studioGallery = () =>
    el('section', { class: 'section rule' }, el('div', { class: 'wrap' }, [
      sectionHead('O espaço', 'Fotografias do estúdio em Vila Nova de Gaia.'),
      el('div', { class: 'grid tight two-up', style: '--min:300px' }, STUDIO_PHOTOS.more.map((ph) => studioImg(ph, 'r43', '(max-width: 640px) 50vw, 33vw'))),
    ]));

  pages.artists = () => [
    el('section', { class: 'section' }, el('div', { class: 'wrap' }, [
      sectionHead('Os artistas', 'Escolhe pelo traço. Cada um tem o seu portfólio, o seu flash e a sua agenda.'),
      data.artists.length ? el('div', { class: 'scroller' }, data.artists.map(artistCard)) : el('p', { class: 'empty', text: 'Em breve.' }),
    ])),
  ];

  const SHORT_DAYS = { segunda: 'Seg', terça: 'Ter', terca: 'Ter', quarta: 'Qua', quinta: 'Qui', sexta: 'Sex', sábado: 'Sáb', sabado: 'Sáb', domingo: 'Dom' };
  const shortDays = (text) => String(text || '').toLowerCase()
    .replace(/(segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)(-feira)?/g, (_, d) => SHORT_DAYS[d])
    .replace(/\s+a\s+/g, '–');

  /** Masonry of photos that open in the viewer; shows `step` at a time. */
  const masonry = (items, caption, step = 12) => {
    let shown = step;
    const grid = el('div', { class: 'v-masonry' });
    const more = el('p', { class: 'v-more' });
    const draw = () => {
      grid.replaceChildren(...items.slice(0, shown).map((p) => {
        const cap = caption(p);
        return el('button', { type: 'button', class: 'photo-btn', 'aria-label': `Ver maior: ${cap || p.title || 'fotografia'}`, onclick: () => openViewer(p, cap) }, [
          el('img', { src: p.image?.url, alt: p.title || cap || '', loading: 'lazy', decoding: 'async' }),
          cap ? el('span', { class: 'lab mono', text: cap }) : null,
        ]);
      }));
      more.replaceChildren(items.length > shown
        ? el('button', { type: 'button', class: 'v-btn k', onclick: () => { shown += step; draw(); } }, ['Ver mais', el('i', { 'aria-hidden': 'true', text: '↓' })])
        : '');
    };
    draw();
    return el('div', {}, [grid, more]);
  };

  pages.artist = (id, params) => {
    const a = artistById(id);
    if (!a) return pages.notFound();
    document.title = `${a.displayName} · Ink Compatível`;
    const ig = instagramUrl(a.instagram);
    const mine = data.portfolio.filter((p) => p.artistId === a.id);
    const tattoos = mine.filter((p) => !p.category || p.category === 'tattoo');
    const art = mine.filter((p) => p.category === 'drawing' || p.category === 'art');
    const fl = flash().filter((f) => f.artistId === a.id);
    const originals = data.shop.filter((s) => s.artistId === a.id && s.kind !== 'merch');
    const bookable = a.acceptsBookings !== false && data.profile.bookingOpen !== false;
    const book = `#/marcar?artista=${encodeURIComponent(a.id)}`;
    const firstName = String(a.fullName || a.displayName).split(/\s+/)[0];
    const bio = String(a.bio || '').trim();
    const [lead, ...restBio] = bio.split(/\n\s*\n/);
    const caption = (p) => [p.title, p.style].filter(Boolean).join(' · ');

    // Hero photos: the portrait (or a typographic card) and one piece of work.
    const showcase = tattoos[0] || art[0];
    const pol = (img, alt, cap, cls) => el('figure', { class: `v-polaroid ${cls}` }, [
      el('img', { src: img.url, alt, loading: 'eager', decoding: 'async' }), el('figcaption', { class: 'hand', text: cap }),
    ]);
    const portrait = safeUrl(a.photo?.url)
      ? pol(a.photo, `Retrato de ${a.displayName}`, firstName.toLowerCase(), 'ah-p1')
      : el('div', { class: 'v-polaroid ah-p1 ah-typo', role: 'img', 'aria-label': `${a.displayName}, retrato em breve` }, [
          el('span', { class: 'disp', 'aria-hidden': 'true', text: initials(a.displayName) }),
          el('span', { class: 'hand', 'aria-hidden': 'true', text: 'retrato em breve' }),
        ]);
    const piece = showcase && safeUrl(showcase.image?.url) ? pol(showcase.image, showcase.title || 'Tatuagem', (showcase.style || 'o trabalho').toLowerCase(), 'ah-p2') : null;

    const days = String(data.profile.openingHours || '').split(/,\s*/)[0];
    const facts = [
      a.priceFrom ? [`desde ${eur(a.priceFrom)}`, 'peças pequenas'] : null,
      fl.length ? [`${fl.length} flash`, fl.length === 1 ? 'disponível agora' : 'disponíveis agora'] : null,
      days ? [shortDays(days), 'sessões com marcação'] : null,
      ['48 h', 'para responder'],
    ].filter(Boolean);

    const hero = el('section', { class: 'v-hero v-grid v-ahero', 'aria-labelledby': 'artist-title' }, [
      el('div', { class: 'ah-grid' }, [
        el('div', { class: 'ah-text' }, [
          el('nav', { class: 'mono ah-crumb', 'aria-label': 'Artistas' }, [
            el('a', { href: '#/artistas', text: 'Artistas' }),
            el('span', { 'aria-hidden': 'true', text: '/' }),
            ...data.artists.map((x) => el('a', { href: artistHref(x), 'aria-current': x.id === a.id ? 'page' : null, text: x.id === a.id && a.fullName ? `${x.displayName} · ${a.fullName}` : x.displayName })),
          ]),
          el('h1', { class: 'disp ah-name', id: 'artist-title' }, a.displayName.split(/\s+/).flatMap((w, j) => (j ? [el('br'), w] : [w]))),
          styleTags(a).length ? el('ul', { class: 'ah-tags mono', 'aria-label': 'Estilos' }, styleTags(a).map((t) => el('li', { text: t }))) : null,
          lead ? el('p', { class: 'ah-lead', text: lead }) : null,
          el('div', { class: 'v-btns' }, [
            bookable ? btn3(`Marcar com ${a.displayName}`, book, 'w') : el('span', { class: 'mono', text: 'Agenda fechada de momento' }),
            fl.length ? btn3('Ver o flash', '#flash-artista', 'o', '↓') : null,
          ]),
          ig ? el('a', { class: 'mono ah-ig', href: ig.url, ...ext, text: `${ig.label} ↗` }) : null,
        ]),
        el('div', { class: 'ah-photos' }, [
          portrait,
          piece,
          bookable ? spinBadge(`MARCAR COM ${a.displayName.toUpperCase()} · 48 H ·`, book, `Marcar com ${a.displayName}`) : null,
        ]),
      ]),
      el('dl', { class: 'ah-facts', style: `--n:${facts.length}` }, facts.map(([b, t]) => el('div', {}, [el('dt', { class: 'disp', text: b }), el('dd', { text: t })]))),
    ]);

    // Portfolio tabs
    const tabs = [
      ['tat', 'Tatuagens', tattoos.length, () => masonry(tattoos, caption)],
      ['flash', 'Flash', fl.length, () => masonry(fl, (p) => [p.flashNumber ? `Nº ${p.flashNumber}` : p.title, p.flashSize].filter(Boolean).join(' · '))],
      ['arte', 'Desenho e arte', art.length, () => masonry(art, caption)],
      ['orig', 'Originais à venda', originals.length, () => el('div', { class: 'v-pgrid' }, originals.map(prodCard))],
    ].filter((t) => t[2] > 0);
    let current = tabs.some((t) => t[0] === params.get('tab')) ? params.get('tab') : tabs[0]?.[0];
    const panel = el('div', { id: 'artist-panel', role: 'tabpanel', tabindex: '0' });
    const tabButtons = tabs.map(([key, label, n]) =>
      el('button', { type: 'button', class: 'v-chip', role: 'tab', id: `tab-${key}`, 'aria-controls': 'artist-panel', 'aria-selected': String(key === current),
        onclick: () => { current = key; tabButtons.forEach((b, i) => b.setAttribute('aria-selected', String(tabs[i][0] === key))); drawPanel(); } },
        [label, el('b', { class: 'mono', text: String(n) })]));
    const drawPanel = () => { if (!current) return; panel.setAttribute('aria-labelledby', `tab-${current}`); panel.replaceChildren(tabs.find((t) => t[0] === current)[3]()); };
    drawPanel();
    const portfolio = el('section', { class: 'v-sec', id: 'trabalho', 'aria-labelledby': 'port-title' }, el('div', { class: 'wrap' }, [
      vHead('Portfólio.', null, tabs.length > 1 ? el('div', { class: 'v-tabs', role: 'tablist', 'aria-label': `Trabalho de ${a.displayName}` }, tabButtons) : null, 'port-title'),
      tabs.length ? panel : el('p', { class: 'empty', text: 'O portfólio está a ser preparado. Entretanto, espreita o Instagram.' }),
    ]));

    // About: only when there is more to say than the hero line.
    const artPiece = art.find((p) => safeUrl(p.image?.url));
    const about = restBio.length
      ? el('section', { class: 'v-sec', 'aria-labelledby': 'about-title' }, el('div', { class: 'wrap v-about' }, [
          artPiece ? el('figure', { class: 'v-polaroid', style: '--r:-3deg' }, [
            el('img', { src: artPiece.image.url, alt: artPiece.title || 'Desenho', loading: 'lazy', decoding: 'async' }),
            el('figcaption', { class: 'hand', text: 'também no papel' }),
          ]) : null,
          el('div', {}, [
            kicker(`Sobre ${a.displayName}`),
            el('h2', { class: 'v-aq', id: 'about-title', text: restBio[0] }),
            ...restBio.slice(1).map((t) => el('p', { class: 'v-lead', text: t })),
          ]),
        ]))
      : null;

    const cta = el('section', { class: 'v-cta v-grid', 'aria-labelledby': 'cta-title' }, [
      el('p', { class: 'hand v-cta-hand', 'aria-hidden': 'true', text: 'gostas do traço?' }),
      el('h2', { class: 'disp', id: 'cta-title' }, ['Marca com', el('br'), `${a.displayName}.`]),
      el('p', { class: 'v-cta-text', text: 'Conta a ideia, a zona e o tamanho. Respondemos em 48 h com preço e datas.' }),
      el('div', { class: 'v-btns center' }, [
        bookable ? btn3('Marcar sessão', book, 'w') : null,
        btn3('Não sei se é o meu traço: fazer o teste', '#/teste', 'o', null),
      ]),
    ]);

    return [
      hero,
      portfolio,
      flashV3({ items: fl, title: `Flash de\n${a.displayName}.`, text: 'Prontos a tatuar, um exemplar de cada. Escolhe o número e marca.', id: 'flash-artista', moreHref: `#/portfolio?cat=flash&artista=${encodeURIComponent(a.id)}` }),
      about,
      cta,
    ];
  };

  pages.portfolio = (_, params) => {
    const cats = [['all', 'Tudo'], ['tattoo', 'Tatuagens'], ['flash', 'Flash'], ['drawing', 'Desenho'], ['art', 'Arte']]
      .filter(([k]) => k === 'all' || data.portfolio.some((p) => p.category === k && (k !== 'flash' || p.available !== false)));
    let cat = cats.some(([k]) => k === params.get('cat')) ? params.get('cat') : 'all';
    let artist = artistById(params.get('artista')) ? params.get('artista') : 'all';
    const box = el('div');
    const draw = () => {
      const items = data.portfolio.filter((p) =>
        (cat === 'all' ? !isFlash(p) || p.available !== false : p.category === cat && (!isFlash(p) || p.available !== false)) &&
        (artist === 'all' || p.artistId === artist));
      box.replaceChildren(cat === 'flash'
        ? (items.length ? el('div', { class: 'grid two-up', style: '--min:240px' }, items.map(flashCard)) : el('p', { class: 'empty', text: 'Sem flash disponível.' }))
        : workGrid(items));
    };
    const chipRow = (label, opts, get, set) =>
      el('div', { class: 'filter-row', role: 'group', 'aria-label': label }, opts.map(([k, t]) =>
        el('button', { type: 'button', class: 'chip', 'aria-pressed': String(get() === k), text: t,
          onclick: (e) => { set(k); $$('.chip', e.target.parentNode).forEach((b) => b.setAttribute('aria-pressed', String(b === e.target))); draw(); } })));
    draw();
    return [
      el('section', { class: 'section' }, el('div', { class: 'wrap' }, [
        sectionHead('Portfólio', 'Trabalho dos três artistas. Toca numa foto para a ver maior.'),
        el('div', { class: 'filters' }, [
          cats.length > 2 ? chipRow('Tipo de trabalho', cats, () => cat, (v) => (cat = v)) : null,
          data.artists.length > 1 ? chipRow('Artista', [['all', 'Todos os artistas'], ...data.artists.map((a) => [a.id, a.displayName])], () => artist, (v) => (artist = v)) : null,
        ]),
        box,
      ])),
    ];
  };

  /** Adds one copy to the cart and explains what happens next in `status`. Returns false when no more copies fit. */
  const addToCart = (item, status, n = 1) => {
    const max = item.kind === 'original' ? 1 : Math.min(item.stock || 0, 10);
    n = Math.max(1, Math.min(n, max - cart.qty(item.id)));
    if (cart.qty(item.id) >= max) {
      status.replaceChildren(notice(item.kind === 'original' ? 'Esta peça já está no carrinho.' : 'Já tens no carrinho todas as cópias disponíveis.'));
      return false;
    }
    cart.add(item.id, n);
    status.replaceChildren(el('div', { class: 'notice stack', style: 'gap:12px' }, [
      el('p', { text: `No carrinho: ${n > 1 ? `${n} × ` : ''}${item.title}. Ao finalizar a compra fica reservado para ti durante 30 minutos.` }),
      el('div', { class: 'hero-actions' }, [
        el('button', { type: 'button', class: 'btn', onclick: openCart, text: 'Finalizar compra' }),
        el('a', { class: 'btn-out', href: '#/loja', text: 'Continuar a ver' }),
      ]),
    ]));
    return true;
  };

  pages.shop = (_, params) => {
    const KINDS = [['all', 'Tudo'], ['original', 'Originais'], ['edition', 'Edições limitadas'], ['merch', 'Merch']];
    const count = (k) => (k === 'all' ? data.shop.length : data.shop.filter((i) => i.kind === k).length);
    const kinds = KINDS.filter(([k]) => k === 'all' || count(k) > 0);
    let kind = kinds.some(([k]) => k === params.get('tipo')) ? params.get('tipo') : 'all';
    let sort = 'casa';
    const merchUrl = safeUrl(data.profile.merchStoreUrl);
    const firstImg = (k) => data.shop.find((i) => i.kind === k && safeUrl(i.image?.url));
    const eye = (cls = '') => el('img', { class: `eye ${cls}`.trim(), src: 'assets/ink-compativel-olho-escuro.svg', alt: '' });

    // Hero: one polaroid per kind of thing the shop sells.
    const orig = firstImg('original');
    const edition = firstImg('edition');
    const pols = [
      orig ? el('figure', { class: 'v-polaroid lf-1' }, [el('img', { src: orig.image.url, alt: '', decoding: 'async' }), el('figcaption', { class: 'hand', text: 'original' })]) : null,
      edition ? el('figure', { class: 'v-polaroid lf-2' }, [el('img', { src: edition.image.url, alt: '', decoding: 'async' }), el('figcaption', { class: 'hand', text: edition.editionSize ? `edição de ${edition.editionSize}` : 'edição limitada' })]) : null,
      count('merch') ? el('figure', { class: 'v-polaroid lf-3' }, [el('div', { class: 'ink' }, eye()), el('figcaption', { class: 'hand', text: 'merch' })]) : null,
    ];

    const grid = el('div', { class: 'v-pgrid four' });
    const merchBox = el('div');
    const sortRow = el('div', { class: 'v-chips', role: 'group', 'aria-label': 'Ordenar' });
    const listing = el('section', { class: 'v-sec', id: 'pecas', 'aria-labelledby': 'pecas-title' });
    const merchSec = el('section', { class: 'v-sec', id: 'merch', 'aria-labelledby': 'merch-title' });

    const soldStamp = (item) => (item.kind !== 'merch' && !sellable(item)
      ? el('span', { class: 'v-sold', 'aria-hidden': 'true' }, el('span', { text: item.kind === 'edition' ? 'Esgotada' : item.status === 'reserved' ? 'Reservada' : 'Vendida' }))
      : null);
    const piece = (item) => {
      const card = prodCard(item);
      card.querySelector('.img').append(...[soldStamp(item)].filter(Boolean));
      const spec = [artistName(item.artistId), item.medium, item.dimensions].filter(Boolean).join(' · ');
      if (spec) card.append(el('p', { class: 'spec mono', text: spec }));
      return card;
    };
    const merchCard = (item, i) => {
      const link = safeUrl(item.externalUrl);
      return el('a', { class: `v-merch t${i % 3}`, href: link || `#/loja/${encodeURIComponent(item.id)}`, ...(link ? ext : {}) }, [
        el('span', { class: 'mono', text: item.medium || 'Merch' }),
        safeUrl(item.image?.url) ? el('img', { src: item.image.url, alt: '', loading: 'lazy', decoding: 'async' }) : eye(),
        el('span', { class: 'row' }, [el('b', { text: item.title }), mono(`desde ${eur(item.price)}${link ? ' ↗' : ''}`)]),
      ]);
    };

    const draw = () => {
      const pieces = data.shop.filter((i) => i.kind !== 'merch' && (kind === 'all' || i.kind === kind));
      let shown = sort === 'livres' ? pieces.filter(sellable) : [...pieces];
      if (sort === 'preco') shown.sort((a, b) => a.price - b.price);
      else shown.sort((a, b) => Number(!sellable(a)) - Number(!sellable(b))); // sold at the end
      grid.replaceChildren(...(shown.length ? shown.map(piece) : [el('p', { class: 'empty', text: 'Nada por aqui de momento. Volta em breve.' })]));
      listing.hidden = kind === 'merch' || !pieces.length;
      const merch = data.shop.filter((i) => i.kind === 'merch');
      // With only one or two products, a card to the whole store keeps the row from looking empty.
      const storeCard = merchUrl && merch.length < 3
        ? el('a', { class: 'v-merch more', href: merchUrl, ...ext }, [
            el('span', { class: 'mono', text: 'Loja online' }),
            el('span', { class: 'disp big' }, ['Ver tudo na', el('br'), `${merchStoreName(merchUrl)} ↗`]),
            el('span', { class: 'mono', text: 'T-shirts, autocolantes e mais' }),
          ])
        : null;
      merchBox.replaceChildren(el('div', { class: 'v-merchgrid' }, [...merch.map(merchCard), storeCard].filter(Boolean)));
      merchSec.hidden = !(kind === 'all' || kind === 'merch') || !merch.length;
      sortRow.replaceChildren(...[['casa', 'Destaques'], ['preco', 'Preço'], ['livres', 'Disponíveis']].map(([k, t]) =>
        el('button', { type: 'button', class: 'v-chip', 'aria-pressed': String(k === sort), text: t, onclick: () => { sort = k; draw(); } })));
      tabs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
    };

    const thumb = (k) => {
      if (k === 'merch') return el('span', { class: 'th ink' }, eye());
      const it = firstImg(k);
      return it ? el('img', { class: 'th', src: it.image.url, alt: '' }) : null;
    };
    const tabs = kinds.map(([k, t]) =>
      el('button', { type: 'button', class: 'v-cat', 'data-kind': k, 'aria-pressed': String(k === kind), onclick: () => { kind = k; draw(); } },
        [k === 'all' ? null : thumb(k), t, el('small', { class: 'mono', text: String(count(k)) })]));

    // Featured edition: the first one still for sale.
    const feat = data.shop.find((i) => i.kind === 'edition' && sellable(i) && safeUrl(i.image?.url));
    let featured = null;
    if (feat) {
      const status = el('div', { 'aria-live': 'polite' });
      const left = feat.editionSize ? Math.max(0, Math.min(1, (feat.stock || 0) / feat.editionSize)) : null;
      const label = () => (cart.qty(feat.id) ? 'Adicionar outra' : 'Adicionar ao carrinho');
      const addBtn = el('button', { type: 'button', class: 'v-btn k', onclick: () => { if (addToCart(feat, status)) addBtn.firstChild.textContent = label(); } }, [label(), el('i', { 'aria-hidden': 'true', text: '+' })]);
      featured = el('section', { class: 'v-sec', 'aria-labelledby': 'ed-title' }, el('div', { class: 'wrap' }, el('div', { class: 'v-ed' }, [
        el('a', { class: 'pic', href: `#/loja/${encodeURIComponent(feat.id)}`, 'aria-label': `Ver ${feat.title}` }, el('img', { src: feat.image.url, alt: feat.title, decoding: 'async' })),
        el('div', { class: 'txt' }, [
          el('div', {}, [
            kicker('Edição em destaque'),
            el('h2', { class: 'disp', id: 'ed-title', text: feat.title }),
            feat.description ? el('p', { class: 'desc', text: feat.description }) : null,
            mono([artistName(feat.artistId), feat.medium, feat.dimensions].filter(Boolean).join(' · '), 'spec'),
          ]),
          el('div', {}, [
            el('div', { class: 'nums' }, [
              el('div', {}, [el('span', { class: 'disp big', text: String(feat.stock || 0) }), mono(feat.editionSize ? `restam de ${feat.editionSize}` : 'restam')]),
              el('span', { class: 'disp price', text: eur(feat.price) }),
            ]),
            left !== null ? el('div', { class: 'stock', role: 'img', 'aria-label': `Restam ${feat.stock || 0} de ${feat.editionSize}` }, el('i', { style: `width:${Math.round(left * 100)}%` })) : null,
            el('div', { class: 'v-btns' }, [addBtn, btn3('Ver detalhes', `#/loja/${encodeURIComponent(feat.id)}`, 'o', null)]),
            mono('Pagamento seguro pelo Stripe · Fica reservada 30 min ao finalizar', 'note'),
            status,
          ]),
        ]),
      ])));
    }

    listing.append(el('div', { class: 'wrap' }, [vHead('Originais e\nedições.', null, sortRow, 'pecas-title'), grid]));
    merchSec.append(el('div', { class: 'wrap' }, [
      el('div', { class: 'v-ahead' }, [
        el('div', {}, [kicker(merchUrl ? `Feito e enviado pela ${merchStoreName(merchUrl)}` : 'Feito e enviado pela loja online'), el('h2', { class: 'disp v-h2', id: 'merch-title', text: 'Merch.' })]),
        merchUrl ? btn3(`Ver tudo na ${merchStoreName(merchUrl)}`, merchUrl, 'o', '↗', ext) : null,
      ]),
      merchBox,
    ]));
    draw();

    return [
      el('section', { class: 'v-hero v-lhero', 'aria-labelledby': 'shop-title' }, [
        el('div', { class: 'lh' }, [
          el('div', {}, [
            kicker('Arte dos nossos artistas', 'light'),
            el('h1', { class: 'disp', id: 'shop-title', text: 'Loja' }),
            el('p', { class: 'lead', text: 'Originais únicos, edições numeradas que só existem aqui e merch com o olho da casa.' }),
          ]),
          el('div', { class: 'feat', 'aria-hidden': 'true' }, pols),
        ]),
        kinds.length > 2 ? el('div', { class: 'v-cats', role: 'group', 'aria-label': 'Tipo de peça' }, tabs) : null,
      ]),
      featured,
      listing,
      merchSec,
      el('section', { class: 'v-sec' }, el('div', { class: 'wrap' }, el('div', { class: 'v-shopinfo' }, [
        ['Pagamento', 'Originais e edições pagam-se aqui, num só checkout seguro pelo Stripe.'],
        ['Envio', 'Enviados do estúdio, bem embalados. Os portes aparecem antes de pagares.'],
        ['Merch', 'Vendido e enviado pela loja online. Pagas lá, com a conta deles.'],
      ].map(([t, d]) => el('div', {}, [mono(t), el('p', { text: d })])).concat(
        el('div', {}, [mono('Devoluções'), el('p', {}, el('a', { href: '#/envios', text: 'Ler a política de envios e devoluções' }))])
      )))),
    ];
  };

  pages.product = (id) => {
    const item = data.shop.find((i) => i.id === id);
    if (!item) return pages.notFound();
    document.title = `${item.title} · Loja Ink Compatível`;
    const kindLabel = { original: 'Originais', edition: 'Edições limitadas', merch: 'Merch' }[item.kind];
    const a = artistById(item.artistId);
    const canBuy = sellable(item) && item.kind !== 'merch';
    const status = el('div', { 'aria-live': 'polite' });
    const ext = safeUrl(item.externalUrl);
    const ext3 = { target: '_blank', rel: 'noopener noreferrer' };
    const isEd = item.kind === 'edition';
    const size = isEd ? item.editionSize || 0 : 0;
    const left = isEd ? Math.max(0, item.stock || 0) : 0;
    const badge = shopBadge(item);

    // Gallery: the piece "posed" on paper, with a round stamp.
    const stamp = isEd && size
      ? el('span', { class: 'stamp' }, [el('b', { class: 'disp', text: String(left) }), el('span', { class: 'mono', text: left ? `de ${size}` : 'esgotada' }), left ? el('span', { class: 'mono', text: 'restam' }) : null])
      : item.kind === 'original'
        ? el('span', { class: 'stamp ink' }, [el('span', { class: 'mono', text: item.status === 'available' ? 'peça' : '' }), el('b', { class: 'disp', text: item.status === 'available' ? 'única' : item.status === 'sold' ? 'vendida' : 'reservada' })])
        : null;
    const gallery = el('div', { class: 'v-gal' }, el('button', { type: 'button', class: `main k-${item.kind}`, 'aria-label': `Ver maior: ${item.title}`, onclick: () => openViewer(item, item.title) }, [
      el('img', { class: 'art', src: item.image?.url, alt: item.title, decoding: 'async' }),
      stamp,
      isEd ? el('span', { class: 'note hand', 'aria-hidden': 'true', text: 'numerada à mão' }) : null,
    ]));

    // Quantity (editions only)
    let qty = 1;
    const maxQty = () => Math.max(0, Math.min(left, 10) - cart.qty(item.id));
    const qtyOut = el('b', { 'aria-live': 'polite', text: '1' });
    const setQty = (n) => { qty = Math.max(1, Math.min(n, Math.max(1, maxQty()))); qtyOut.textContent = String(qty); };
    const qtyBox = isEd && canBuy
      ? el('div', { class: 'v-qty', role: 'group', 'aria-label': 'Quantidade' }, [
          el('button', { type: 'button', 'aria-label': 'Menos uma', onclick: () => setQty(qty - 1), text: '−' }), qtyOut,
          el('button', { type: 'button', 'aria-label': 'Mais uma', onclick: () => setQty(qty + 1), text: '+' }),
        ])
      : null;
    const label = () => (canBuy ? (cart.qty(item.id) ? (item.kind === 'original' ? 'Já está no carrinho' : 'Adicionar outra') : 'Adicionar ao carrinho') : isEd ? 'Esgotada' : item.status === 'reserved' ? 'Reservada' : 'Vendida');
    const addBtn = el('button', { type: 'button', class: 'v-btn k add', disabled: !canBuy || null, onclick: () => {
      if (addToCart(item, status, qty)) { addBtn.firstChild.textContent = label(); setQty(1); }
    } }, [label(), el('i', { 'aria-hidden': 'true', text: '+' })]);

    const specs = [
      item.dimensions ? ['Formato', item.dimensions] : null,
      item.medium ? ['Técnica', item.medium] : null,
      item.year ? ['Ano', item.year] : null,
      isEd && size ? ['Tiragem', `${size} exemplares, numerados`] : null,
      item.kind !== 'merch' ? ['Envio', item.shippingPrice ? `Portes ${eur(item.shippingPrice)}` : 'Portes grátis'] : null,
    ].filter(Boolean).slice(0, 4);

    const sold = size - left;
    const panel = el('div', { class: 'v-ppanel' }, [
      el('div', { class: 'pills' }, [
        el('span', { class: `pill${/gone/.test(badge.cls) ? ' gone' : isEd || item.kind === 'original' ? ' red' : ''}`, text: badge.text }),
        isEd ? el('span', { class: 'pill o', text: 'Só no site' }) : null,
        item.kind === 'merch' ? el('span', { class: 'pill o', text: 'Feito e enviado pela loja online' }) : null,
      ]),
      el('h1', { class: 'disp', text: item.title }),
      item.description ? el('p', { class: 'desc', text: item.description }) : null,
      el('div', { class: 'price' }, [
        el('span', { class: 'disp', text: item.kind === 'merch' ? `desde ${eur(item.price)}` : eur(item.price) }),
        mono(item.kind === 'merch' ? 'Preço na loja online' : 'Portes mostrados antes de pagar'),
      ]),
      isEd && size
        ? el('div', { class: 'v-count' }, [
            el('div', { class: 'head' }, [el('b', { text: left ? `Restam ${left} de ${size}` : 'Esgotada' }), left ? mono(`o nº ${sold + 1} é o próximo`) : null]),
            size <= 60 ? el('div', { class: 'bars', 'aria-hidden': 'true', style: `--n:${size}` }, Array.from({ length: size }, (_, i) => el('i', { class: i < left ? '' : 'off' }))) : el('div', { class: 'stock' }, el('i', { style: `width:${Math.round((left / size) * 100)}%` })),
          ])
        : null,
      specs.length ? el('dl', { class: 'v-specs' }, specs.map(([k, t]) => el('div', {}, [el('dt', { class: 'mono', text: k }), el('dd', { text: t })]))) : null,
      item.kind === 'merch'
        ? (ext ? btn3(`Comprar na ${merchStoreName(ext)}`, ext, 'k', '↗', { ...ext3, class: 'v-btn k add' }) : null)
        : el('div', {}, [
            el('div', { class: 'buy' }, [qtyBox, addBtn]),
            canBuy ? mono('Ao finalizar fica reservado 30 min para ti · Pagamento seguro pelo Stripe', 'note') : null,
            status,
          ]),
      a ? el('a', { class: 'v-by', href: artistHref(a) }, [
            safeUrl(a.photo?.url) ? el('img', { src: a.photo.url, alt: '' }) : el('span', { class: 'av disp', 'aria-hidden': 'true', text: initials(a.displayName) }),
            el('span', { class: 'who' }, [mono('Desenhado por'), el('b', { text: a.displayName })]),
            el('span', { class: 'go', text: 'Ver artista ↗' }),
          ])
        : null,
      item.kind !== 'merch'
        ? el('div', { class: 'v-acc' }, [
            el('details', { open: true }, [el('summary', { text: 'Envios e devoluções' }), el('p', {}, [
              `Sai do estúdio, em Gaia, bem embalado. Portes: ${item.shippingPrice ? eur(item.shippingPrice) : 'grátis'}. Tens 14 dias para devolver, como manda a lei. `,
              el('a', { href: '#/envios', text: 'Ler a política' }),
            ])]),
            el('details', {}, [el('summary', { text: 'Cuidados' }), el('p', { text: 'Guarda longe do sol direto e da humidade. Para emoldurar, um vidro com proteção UV ajuda a manter as cores.' })]),
            el('details', {}, [el('summary', { text: 'Pagamento' }), el('p', { text: 'Pagas aqui no site, num checkout seguro do Stripe. Os meios de pagamento disponíveis aparecem lá.' })]),
          ])
        : null,
    ]);

    const more = [
      ...data.shop.filter((i) => i.id !== item.id && i.artistId === item.artistId && (i.kind === 'merch' || sellable(i))),
      ...data.shop.filter((i) => i.id !== item.id && i.artistId !== item.artistId && (i.kind === 'merch' || sellable(i))),
    ].slice(0, 4);

    return [
      el('section', { class: 'v-product' }, el('div', { class: 'wrap' }, [
        el('nav', { class: 'mono v-crumbs', 'aria-label': 'Caminho' }, [
          el('a', { href: '#/loja', text: 'Loja' }), ' / ',
          el('a', { href: `#/loja?tipo=${item.kind}`, text: kindLabel }), ' / ',
          el('span', { 'aria-current': 'page', text: item.title }),
        ]),
        el('div', { class: 'pwrap' }, [gallery, panel]),
      ])),
      more.length
        ? el('section', { class: 'v-sec', 'aria-labelledby': 'more-title' }, el('div', { class: 'wrap' }, [
            vHead('Também\npodes gostar.', null, btn3('Ver a loja', '#/loja', 'o'), 'more-title'),
            el('div', { class: 'v-pgrid four' }, more.map(prodCard)),
          ]))
        : null,
    ];
  };

  pages.studio = () => [
    studioSection({ full: true }),
    studioGallery(),
    el('section', { class: 'section rule' }, el('div', { class: 'wrap' }, [el('h2', { class: 'disp h2', style: 'margin-bottom:40px', text: 'Como funciona' }), steps()])),
  ];

  pages.thanks = () => {
    cart.clear();
    return [
      el('section', { class: 'section' }, el('div', { class: 'wrap stack prose' }, [
        mono('Pagamento recebido', 'muted'),
        el('h1', { class: 'disp h2', text: 'Obrigado!' }),
        el('p', { text: 'A tua encomenda está confirmada. Recebes o recibo do Stripe por email e avisamos-te quando sair do estúdio.' }),
        el('div', { class: 'hero-actions' }, [el('a', { class: 'btn-out', href: '#/loja', text: 'Voltar à loja' }), el('a', { class: 'btn', href: '#/marcar', text: 'Marcar sessão' })]),
      ])),
    ];
  };

  pages.privacy = () => {
    const p = data.profile;
    const contact = p.email || p.phone || '[contacto do estúdio]';
    return [el('section', { class: 'section' }, el('div', { class: 'wrap prose' }, [
      el('h1', { class: 'disp h2', text: 'Privacidade' }),
      el('p', { text: `Responsável pelo tratamento: Ink Compatível${p.address ? `, ${p.address}` : ''}${p.city ? `, ${p.city}` : ''}. Contacto: ${contact}.` }),
      el('h2', { text: 'Pedidos de marcação' }),
      el('p', { text: 'Guardamos o nome, telemóvel, email, Instagram (se o deres) e o que escreves sobre a tatuagem, para te responder com preço e datas. Guardamos também a data em que confirmaste ter 18 anos ou mais e em que aceitaste esta política.' }),
      el('h2', { text: 'Compras na loja' }),
      el('p', { text: 'Para enviar a encomenda guardamos o nome, morada, email e telemóvel. O pagamento é feito no Stripe: nunca vemos nem guardamos os dados do cartão. O merch é vendido pela loja externa, com a política dela.' }),
      el('h2', { text: 'Onde ficam os dados' }),
      el('p', { text: 'Num sistema de gestão do estúdio (Google Firebase, na UE ou com garantias equivalentes), só acessível à equipa do estúdio. Não vendemos nem partilhamos os teus dados para publicidade.' }),
      el('h2', { text: 'Quanto tempo' }),
      el('p', { text: 'Pedidos que não avançam são apagados ao fim de 12 meses. Dados de clientes e faturas guardam-se pelo prazo que a lei fiscal exige.' }),
      el('h2', { text: 'Os teus direitos' }),
      el('p', { text: `Podes pedir para ver, corrigir ou apagar os teus dados, ou opor-te ao seu uso, escrevendo para ${contact}. Se achares que não tratámos bem os teus dados, podes queixar-te à CNPD (cnpd.pt).` }),
    ]))];
  };

  pages.shipping = () => [el('section', { class: 'section' }, el('div', { class: 'wrap prose' }, [
    el('h1', { class: 'disp h2', text: 'Envios e devoluções' }),
    el('h2', { text: 'Envios' }),
    el('p', { text: 'Originais e edições limitadas saem do estúdio em Vila Nova de Gaia, bem protegidos. Os portes de cada encomenda são mostrados antes de pagares. Recebes o número de seguimento por email quando a encomenda sair.' }),
    el('h2', { text: 'Devoluções' }),
    el('p', { text: 'Tens 14 dias depois de receber para desistir da compra, sem dares motivo. Avisa-nos por email ou WhatsApp e devolve a peça no estado em que a recebeste. Devolvemos o valor pago, incluindo os portes de envio normais, até 14 dias depois de recebermos a peça.' }),
    el('h2', { text: 'Merch' }),
    el('p', { text: 'T-shirts, sweats e autocolantes são vendidos e enviados pela loja externa (por exemplo, o Redbubble). Envios, trocas e devoluções seguem as regras dessa loja.' }),
    el('h2', { text: 'Problemas' }),
    el('p', {}, ['Se alguma coisa chegar danificada, manda-nos uma foto nas primeiras 48 h e resolvemos. Também podes usar o ', el('a', { href: 'https://www.livroreclamacoes.pt/', target: '_blank', rel: 'noopener noreferrer', text: 'Livro de Reclamações Eletrónico' }), '.']),
  ]))];

  pages.notFound = () => [el('section', { class: 'section' }, el('div', { class: 'wrap stack' }, [
    el('h1', { class: 'disp h2', text: 'Não encontrámos esta página' }),
    el('p', {}, el('a', { class: 'lnk', href: '#/', text: 'Voltar ao início' })),
  ]))];

  // ------------------------------------------------------------------ booking (3 steps)
  const booking = { step: 1, values: {}, sentId: null };

  pages.quiz = () => (data.artists.length ? [quizBlock({ standalone: true })] : pages.notFound());

  pages.booking = (_, params) => {
    const p = data.profile;
    const wa = whatsappUrl('Olá! Queria marcar uma tatuagem.');
    const v = booking.values;
    if (booking.step === 4) { booking.step = 1; booking.values = {}; booking.sentId = null; }
    if (params.get('artista') && artistById(params.get('artista'))) v.artistId = params.get('artista');
    if (params.get('tipo') === 'flash') v.tattooType = 'Flash';
    if (params.get('flash')) v.flashNumber = params.get('flash').slice(0, 20);
    // From the compatibility test.
    if (['Sketch', 'Black & grey', 'Black & red', 'Aguarela', 'Não sei'].includes(params.get('estilo'))) v.style = params.get('estilo');
    if (params.get('tamanho')) v.size = params.get('tamanho').slice(0, 100);
    if (params.get('primeira') === '1') v.firstTattoo = true;
    if (['Braço', 'Perna', 'Costas', 'Peito', 'Mão', 'Outra'].includes(params.get('zona'))) v.placement = params.get('zona');
    if (/^\d{1,3}$/.test(params.get('pct') || '')) v.fromTest = Number(params.get('pct'));
    if (Object.keys(Object.fromEntries(params)).length) history.replaceState(null, '', '#/marcar');

    const bookable = data.artists.filter((a) => a.acceptsBookings !== false);
    const formBox = el('div', { class: 'v-formcard' });
    const progress = el('ol', { class: 'v-steps', 'aria-label': 'Passos' });
    const summary = el('dl');
    const drawSummary = () => {
      const artist = artistById(v.artistId);
      const rows = [
        ['Artista', artist ? artist.displayName : 'Sugerido por nós'],
        ['Tipo', v.tattooType || 'Desenho novo'],
        v.tattooType === 'Flash' && v.flashNumber ? ['Flash', `Nº ${v.flashNumber}`] : null,
        v.style && v.style !== 'Não sei' ? ['Estilo', v.style] : null,
        v.size ? ['Tamanho', v.size] : null,
        v.placement ? ['Zona', v.placement] : null,
        v.firstTattoo ? ['Primeira', 'Sim, explicamos tudo'] : null,
      ].filter(Boolean);
      summary.replaceChildren(...rows.flatMap(([k, t]) => [el('dt', { class: 'mono', text: k }), el('dd', { text: t })]));
    };
    const draw = () => {
      progress.replaceChildren(...[['Artista e tipo', 'agora'], ['A ideia', 'zona, tamanho, referências'], ['Contacto', 'e confirmação']].map(([label, sub], i) =>
        el('li', { class: booking.step === i + 1 ? 'on' : booking.step > i + 1 ? 'done' : '', 'aria-current': booking.step === i + 1 ? 'step' : null }, [
          el('i', { 'aria-hidden': 'true', text: booking.step > i + 1 ? '✓' : String(i + 1) }),
          el('span', {}, [el('b', { text: label }), el('small', { class: 'mono', text: booking.step === i + 1 ? 'agora' : sub })]),
        ])));
      progress.hidden = booking.step === 4;
      drawSummary();
      formBox.replaceChildren(stepViews[booking.step]());
      const first = formBox.querySelector('h2');
      if (first && draw.moved) { first.setAttribute('tabindex', '-1'); first.focus(); }
      draw.moved = true;
    };

    const option = (name, value, label, note, checked) =>
      el('label', { class: 'option' }, [
        el('input', { type: 'radio', name, value, checked: checked || null }),
        el('span', {}, [label, note ? el('small', { text: note }) : null]),
      ]);
    const field = (id, label, input, hint) => el('div', { class: 'fld' }, [el('label', { for: id, text: label }), input, hint ? el('p', { class: 'hint', id: `${id}-hint`, text: hint }) : null, el('p', { class: 'err', id: `${id}-err`, hidden: true })]);
    const setError = (form, name, msg) => {
      const input = form.elements[name];
      const target = input instanceof RadioNodeList ? input[0] : input;
      const err = form.querySelector(`#${name}-err`);
      if (target && target.setAttribute) target.setAttribute('aria-invalid', msg ? 'true' : 'false');
      if (err) { err.textContent = msg || ''; err.hidden = !msg; }
      if (target && target.setAttribute && msg) target.setAttribute('aria-describedby', `${name}-err`);
      return !msg;
    };
    const firstInvalid = (form) => form.querySelector('[aria-invalid="true"]')?.focus();
    const actions = (back, nextLabel) => el('div', { class: 'form-actions' }, [
      back ? el('button', { type: 'button', class: 'v-btn o', onclick: () => { save(back.form); booking.step -= 1; draw(); }, text: 'Voltar' }) : mono(`Passo ${booking.step} de 3`, 'muted'),
      el('button', { type: 'submit', class: 'v-btn k' }, [nextLabel, el('i', { 'aria-hidden': 'true', text: '→' })]),
    ]);
    const save = (form) => {
      for (const elx of form.elements) {
        if (!elx.name || elx.name === 'website') continue;
        if (elx.type === 'radio') { if (elx.checked) v[elx.name] = elx.value; }
        else if (elx.type === 'checkbox') v[elx.name] = elx.checked;
        else v[elx.name] = elx.value;
      }
    };

    const stepViews = {
      1: () => {
        const form = el('form', { class: 'form', novalidate: true });
        const flashBox = el('div', { hidden: v.tattooType !== 'Flash' }, field('flashNumber', 'Número do flash', el('input', { id: 'flashNumber', name: 'flashNumber', inputmode: 'numeric', maxlength: '20', value: v.flashNumber || '' }), 'Está na legenda do desenho, por exemplo 014.'));
        const fromTest = v.fromTest && artistById(v.artistId)
          ? el('div', { class: 'v-fromtest' }, [
              el('b', { class: 'p disp', text: `${v.fromTest}%` }),
              el('span', {}, [el('b', { text: 'Vens do teste de compatibilidade.' }), el('br'), el('span', { class: 'muted', text: `Já escolhemos ${artistById(v.artistId).displayName} e guardámos as tuas respostas. Podes mudar tudo.` })]),
              el('a', { class: 'lnk', href: '#/teste', text: 'Refazer' }),
            ])
          : null;
        const artistOption = (a, i) => {
          const pic = safeUrl(a.photo?.url);
          return el('label', { class: `v-ap${pic ? '' : ` plain t${i % 2}`}` }, [
            el('input', { type: 'radio', name: 'artistId', value: a.id, checked: v.artistId === a.id || null }),
            pic ? el('img', { src: a.photo.url, alt: '' }) : null,
            el('span', { class: 'ok', 'aria-hidden': 'true', text: '✓' }),
            el('b', { class: 'disp' }, a.displayName.split(/\s+/).flatMap((w, j) => (j ? [el('br'), w] : [w]))),
            a.styles ? el('small', { class: 'mono', text: a.styles }) : null,
          ]);
        };
        form.append(
          fromTest,
          el('fieldset', {}, [
            el('legend', {}, el('h2', { class: 'v-q', text: 'Com quem queres marcar?' })),
            el('div', { class: 'v-apick' }, [
              ...bookable.map(artistOption),
              el('label', { class: 'v-ap help' }, [
                el('input', { type: 'radio', name: 'artistId', value: '', checked: !v.artistId || null }),
                el('span', { class: 'ok', 'aria-hidden': 'true', text: '✓' }),
                el('b', { class: 'disp' }, ['Não sei,', el('br'), 'ajudem-me']),
                el('small', { class: 'mono', text: 'Escolhemos por ti' }),
              ]),
            ]),
          ]),
          el('fieldset', {}, [
            el('legend', {}, el('h2', { class: 'v-q', text: 'O que procuras?' })),
            el('div', { class: 'v-kinds', onchange: (e) => { if (e.target.name === 'tattooType') flashBox.hidden = e.target.value !== 'Flash'; } }, [
              ['Desenho novo', 'Feito para ti'], ['Flash', 'Diz-nos o nº'], ['Cover-up', 'Tapar uma antiga'], ['Retoque', 'Feita cá'],
            ].map(([t, n]) => el('label', { class: 'v-kind' }, [
              el('input', { type: 'radio', name: 'tattooType', value: t, checked: (v.tattooType || 'Desenho novo') === t || null }),
              el('b', { text: t }), el('small', { class: 'mono', text: n }),
            ]))),
          ]),
          flashBox,
          actions(null, 'Continuar'),
        );
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          save(form);
          if (v.tattooType !== 'Flash') v.flashNumber = '';
          booking.step = 2; draw();
        });
        form.addEventListener('change', () => { save(form); drawSummary(); });
        return form;
      },
      2: () => {
        const form = el('form', { class: 'form', novalidate: true });
        const zones = ['Antebraço', 'Braço', 'Ombro', 'Mão', 'Perna', 'Costas', 'Peito', 'Costela', 'Pescoço', 'Outra'];
        form.append(
          el('h2', { class: 'v-q', text: 'A ideia' }),
          field('idea', 'Descreve o que imaginas', el('textarea', { id: 'idea', name: 'idea', maxlength: '4000', required: true, placeholder: v.tattooType === 'Cover-up' ? 'O que queres tapar e o que gostavas de ter no lugar.' : 'O desenho, o significado, o que não queres…' }, v.idea || '')),
          el('div', { class: 'two' }, [
            field('placement', 'Zona do corpo', el('select', { id: 'placement', name: 'placement' }, [el('option', { value: '', text: 'Escolhe' }), ...zones.map((z) => el('option', { value: z, text: z, selected: v.placement === z || null }))])),
            field('size', 'Tamanho aproximado', el('input', { id: 'size', name: 'size', maxlength: '100', placeholder: 'Ex.: 12 × 8 cm', value: v.size || '' })),
          ]),
          el('fieldset', {}, [
            el('legend', { text: 'Estilo' }),
            el('div', { class: 'options' }, ['Sketch', 'Black & grey', 'Black & red', 'Aguarela', 'Não sei'].map((s) => option('style', s, s, null, (v.style || 'Não sei') === s))),
          ]),
          field('referenceUrl', 'Link para referências (opcional)', el('input', { id: 'referenceUrl', name: 'referenceUrl', type: 'url', maxlength: '500', placeholder: 'https://', value: v.referenceUrl || '' }), 'Também podes mandar fotos pelo WhatsApp depois de enviar o pedido.'),
          el('label', { class: 'check' }, [el('input', { type: 'checkbox', name: 'firstTattoo', checked: v.firstTattoo || null }), 'É a minha primeira tatuagem']),
          actions({ form }, 'Continuar'),
        );
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          save(form);
          const ok = [
            setError(form, 'idea', (v.idea || '').trim().length < 10 ? 'Conta-nos um pouco mais (pelo menos uma frase).' : ''),
            setError(form, 'referenceUrl', v.referenceUrl && !/^https?:\/\/\S+\.\S+/.test(v.referenceUrl.trim()) ? 'Cola um link completo, começado por https://' : ''),
          ].every(Boolean);
          if (!ok) return firstInvalid(form);
          booking.step = 3; draw();
        });
        return form;
      },
      3: () => {
        const form = el('form', { class: 'form', novalidate: true });
        const status = el('div', { 'aria-live': 'assertive' });
        const startedAt = Date.now();
        form.append(
          el('h2', { class: 'v-q', text: 'Como falamos contigo' }),
          el('div', { class: 'two' }, [
            field('name', 'Nome', el('input', { id: 'name', name: 'name', autocomplete: 'name', maxlength: '120', required: true, value: v.name || '' })),
            field('phone', 'Telemóvel (WhatsApp)', el('input', { id: 'phone', name: 'phone', type: 'tel', autocomplete: 'tel', maxlength: '40', required: true, value: v.phone || '' })),
            field('email', 'Email', el('input', { id: 'email', name: 'email', type: 'email', autocomplete: 'email', maxlength: '200', required: true, value: v.email || '' })),
            field('instagram', 'Instagram (opcional)', el('input', { id: 'instagram', name: 'instagram', maxlength: '100', placeholder: '@', value: v.instagram || '' })),
          ]),
          el('fieldset', {}, [
            el('legend', { text: 'Disponibilidade' }),
            el('div', { class: 'options' }, ['Qualquer dia', 'Dias úteis', 'Sábados'].map((d) => option('preferredDates', d, d, null, (v.preferredDates || 'Qualquer dia') === d))),
          ]),
          el('div', { class: 'hp', 'aria-hidden': 'true' }, [el('label', { for: 'website', text: 'Website' }), el('input', { id: 'website', name: 'website', tabindex: '-1', autocomplete: 'off' })]),
          el('div', { class: 'stack', style: 'gap:8px' }, [
            el('label', { class: 'check' }, [el('input', { type: 'checkbox', name: 'adult', id: 'adult', checked: v.adult || null }), 'Tenho 18 anos ou mais.']),
            el('p', { class: 'err', id: 'adult-err', hidden: true }),
            el('label', { class: 'check' }, [el('input', { type: 'checkbox', name: 'privacy', id: 'privacy', checked: v.privacy || null }),
              el('span', {}, ['Aceito que a Ink Compatível guarde estes dados para responder ao pedido. ', el('a', { href: '#/privacidade', target: '_blank', text: 'Política de privacidade' })])]),
            el('p', { class: 'err', id: 'privacy-err', hidden: true }),
          ]),
          status,
          actions({ form }, 'Enviar pedido'),
        );
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          save(form);
          const ok = [
            setError(form, 'name', (v.name || '').trim().length < 2 ? 'Diz-nos o teu nome.' : ''),
            setError(form, 'phone', digits(v.phone).length < 9 ? 'Indica um telemóvel válido.' : ''),
            setError(form, 'email', !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v.email || '').trim()) ? 'Indica um email válido.' : ''),
            setError(form, 'adult', v.adult ? '' : 'Só tatuamos maiores de 18 anos.'),
            setError(form, 'privacy', v.privacy ? '' : 'Precisamos da tua autorização para guardar o pedido.'),
          ].every(Boolean);
          if (!ok) return firstInvalid(form);
          if (form.elements.website.value || Date.now() - startedAt < 3000) {
            booking.step = 4; booking.sentId = null; return draw(); // bot: pretend it worked
          }
          const button = form.querySelector('[type=submit]');
          button.disabled = true; button.firstChild.textContent = 'A enviar…';
          const now = new Date().toISOString();
          const artist = artistById(v.artistId);
          try {
            booking.sentId = await sendBooking({
              name: v.name, email: v.email, phone: v.phone, instagram: v.instagram,
              artistId: artist?.id, artistName: artist?.displayName,
              tattooType: v.tattooType, flashNumber: v.tattooType === 'Flash' ? v.flashNumber : '',
              firstTattoo: !!v.firstTattoo,
              idea: v.idea, placement: v.placement, size: v.size, style: v.style,
              preferredDates: v.preferredDates, referenceUrl: v.referenceUrl,
              status: 'new', createdAt: now, adultConfirmedAt: now, privacyAcceptedAt: now,
            });
            booking.step = 4; draw();
          } catch (err) {
            console.error(err);
            button.disabled = false; button.firstChild.textContent = 'Enviar pedido';
            status.replaceChildren(notice(`Não conseguimos enviar o pedido. Tenta outra vez${wa ? ' ou fala connosco pelo WhatsApp' : ''}.`, true));
          }
        });
        return form;
      },
      4: () => {
        const artist = artistById(v.artistId);
        const who = artist ? `${artist.displayName} responde` : 'Escolhemos o artista certo e respondemos';
        return el('div', { class: 'stack' }, [
          booking.sentId ? mono(`Pedido nº ${booking.sentId.slice(-6).toUpperCase()} · enviado`, 'muted') : null,
          el('h2', { class: 'disp', style: 'font-size:clamp(56px,7vw,96px)', text: 'Recebido.' }),
          el('p', { style: 'margin:0;font-size:19px', text: `${who} em 48 h, por WhatsApp. O pedido já está na agenda do estúdio.` }),
          el('ol', { class: 'steps', style: 'margin-top:16px' }, [
            'Recebes o preço e as datas livres por WhatsApp.',
            'Pagas o sinal por um link seguro e a data fica tua.',
            'Antes da sessão vês o esboço final.',
          ].map((t, i) => el('li', {}, [mono(`0${i + 1}`, 'muted'), el('span', { text: t })]))),
          el('div', { class: 'v-btns' }, [
            btn3('Ver mais trabalho', '#/portfolio', 'k'),
            btn3('Voltar ao início', '#/', 'o', null),
          ]),
        ]);
      },
    };

    if (p.bookingOpen === false) {
      return [el('section', { class: 'section' }, el('div', { class: 'wrap stack prose' }, [
        el('h1', { class: 'disp h2', text: 'Agenda fechada' }),
        el('p', { text: 'De momento não estamos a aceitar novos pedidos pelo site.' }),
        wa ? el('a', { class: 'btn', href: wa, target: '_blank', rel: 'noopener noreferrer', text: 'Falar no WhatsApp' }) : null,
      ]))];
    }

    draw.moved = false;
    draw();
    return [
      el('section', { class: 'v-hero v-grid v-mhero', 'aria-labelledby': 'booking-title' }, [
        el('div', { class: 'mh' }, [
          el('div', {}, [
            kicker('Respondemos em 48 h', 'white'),
            el('h1', { class: 'disp', id: 'booking-title' }, ['Marcar', el('br'), 'sessão']),
          ]),
          polaroid('vespa-lapis', '', 'conta-nos a ideia', 'mh-pol'),
        ]),
        progress,
      ]),
      el('section', { class: 'v-sec v-booking' }, el('div', { class: 'wrap mgrid' }, [
        formBox,
        el('aside', { class: 'v-side' }, [
          el('div', { class: 'how' }, [
            el('h2', { class: 'disp', text: 'Como funciona' }),
            el('ol', {}, [
              ['Envias o pedido', 'Não pagas nada. Vai direto para a agenda do artista.'],
              ['Respondemos em 48 h', 'Com preço, datas e perguntas sobre o desenho.'],
              ['O sinal', p.depositInfo || 'Guarda a data e desconta no preço final.'],
              ['Afinamos o esboço', 'Vês o desenho final antes da sessão.'],
            ].map(([t, d], i) => el('li', {}, [el('i', { class: 'disp', 'aria-hidden': 'true', text: String(i + 1) }), el('span', {}, [el('b', { text: t }), el('br'), el('span', { text: d })])]))),
          ]),
          el('div', { class: 'sum' }, [mono('O teu pedido'), summary]),
          wa ? btn3('Prefiro falar no WhatsApp', wa, 'o', null, ext) : null,
        ]),
      ])),
    ];
  };

  // ------------------------------------------------------------------ cart
  const CART_KEY = 'ink-cart-v1';
  const cart = {
    lines: (() => {
      try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]').filter((l) => l && typeof l.id === 'string' && l.qty > 0); } catch { return []; }
    })(),
    persist() {
      try { localStorage.setItem(CART_KEY, JSON.stringify(this.lines)); } catch { /* private mode */ }
      updateCartCount();
    },
    qty(id) { return this.lines.find((l) => l.id === id)?.qty || 0; },
    add(id, n) {
      const line = this.lines.find((l) => l.id === id);
      if (line) line.qty += n; else this.lines.push({ id, qty: n });
      this.persist();
    },
    set(id, qty) {
      this.lines = qty > 0 ? this.lines.map((l) => (l.id === id ? { ...l, qty } : l)) : this.lines.filter((l) => l.id !== id);
      this.persist();
    },
    clear() { this.lines = []; this.persist(); },
    count() { return this.lines.reduce((s, l) => s + l.qty, 0); },
    /** Drops lines that are no longer for sale and caps quantities to the stock. */
    reconcile() {
      const removed = [];
      this.lines = this.lines.flatMap((l) => {
        const item = data.shop.find((i) => i.id === l.id);
        if (!item || item.kind === 'merch' || !sellable(item)) { if (item) removed.push(item.title); return []; }
        const max = item.kind === 'original' ? 1 : Math.min(item.stock || 0, 10);
        return [{ id: l.id, qty: Math.min(l.qty, max) }];
      });
      this.persist();
      return removed;
    },
  };

  const updateCartCount = () => {
    const n = cart.count();
    $$('[data-cart-count]').forEach((e) => (e.textContent = String(n)));
    $$('[data-open-cart]').forEach((b) => b.setAttribute('aria-label', `Carrinho, ${n} ${n === 1 ? 'artigo' : 'artigos'}`));
  };

  const ERRORS = {
    sold_out: (t) => `${t ? `«${t}»` : 'Uma peça'} acabou de esgotar. Tirámo-la do carrinho.`,
    not_found: (t) => `${t ? `«${t}»` : 'Uma peça'} já não está à venda. Tirámo-la do carrinho.`,
    not_for_sale: (t) => `${t ? `«${t}»` : 'Uma peça'} já não está à venda. Tirámo-la do carrinho.`,
    busy: () => 'Há muita gente a comprar agora. Tenta outra vez daqui a nada.',
    shop_closed: () => 'A loja online ainda não está aberta. Fala connosco pelo WhatsApp.',
  };

  const renderCart = (message) => {
    const body = $('[data-cart-body]');
    const removed = cart.reconcile();
    const items = cart.lines.map((l) => ({ line: l, item: data.shop.find((i) => i.id === l.id) })).filter((x) => x.item);
    const msgs = [message ? notice(message, true) : null, removed.length ? notice(`Já não está disponível: ${removed.join(', ')}.`) : null];
    if (!items.length) {
      body.replaceChildren(...msgs.filter(Boolean), el('p', { class: 'muted', text: 'O carrinho está vazio.' }), el('a', { class: 'btn-out', href: '#/loja', onclick: closeCart, text: 'Ver a loja' }));
      return;
    }
    const subtotal = items.reduce((s, { line, item }) => s + line.qty * (item.price || 0), 0);
    const shipping = Math.max(0, ...items.map(({ item }) => item.shippingPrice || 0));
    const pay = el('button', { type: 'button', class: 'btn btn-block', text: 'Finalizar compra' });
    pay.addEventListener('click', () => checkout(pay));
    body.replaceChildren(
      ...msgs.filter(Boolean),
      ...items.map(({ line, item }) => {
        const max = item.kind === 'original' ? 1 : Math.min(item.stock || 0, 10);
        return el('div', { class: 'cart-line' }, [
          photo(item.image, item.title, ''),
          el('div', { class: 'stack', style: 'gap:6px' }, [
            el('a', { href: `#/loja/${encodeURIComponent(item.id)}`, onclick: closeCart, style: 'color:inherit;font-weight:600', text: item.title }),
            mono(item.kind === 'original' ? 'Original · peça única' : 'Edição limitada', 'muted'),
            item.kind === 'edition'
              ? el('div', { class: 'qty' }, [
                  el('button', { type: 'button', 'aria-label': `Menos uma cópia de ${item.title}`, onclick: () => { cart.set(item.id, line.qty - 1); renderCart(); }, text: '−' }),
                  el('span', { 'aria-live': 'polite', text: String(line.qty) }),
                  el('button', { type: 'button', 'aria-label': `Mais uma cópia de ${item.title}`, disabled: line.qty >= max || null, onclick: () => { cart.set(item.id, line.qty + 1); renderCart(); }, text: '+' }),
                ])
              : null,
          ]),
          el('div', { class: 'stack', style: 'gap:6px;align-items:flex-end' }, [
            el('span', { style: 'font-weight:600', text: eur(line.qty * item.price) }),
            el('button', { type: 'button', class: 'lnk', style: 'background:none;border:0;padding:0;cursor:pointer;font-size:14px', 'aria-label': `Remover ${item.title}`, onclick: () => { cart.set(item.id, 0); renderCart(); }, text: 'Remover' }),
          ]),
        ]);
      }),
      el('div', { class: 'totals' }, [
        el('span', { text: 'Subtotal' }), el('span', { text: eur(subtotal) }),
        el('span', { text: 'Portes' }), el('span', { text: shipping ? eur(shipping) : 'Grátis' }),
        el('span', { class: 'total', text: 'Total' }), el('span', { class: 'total', text: eur(subtotal + shipping) }),
      ]),
      pay,
      el('p', { class: 'hint', text: 'Pagamento seguro pelo Stripe. Ao avançar, as peças ficam reservadas para ti durante 30 minutos.' }),
    );
  };

  const checkout = async (button) => {
    if (!APP_API) return renderCart(ERRORS.shop_closed());
    button.disabled = true;
    button.textContent = 'A preparar o pagamento…';
    const here = `${location.origin}${location.pathname}`;
    try {
      const res = await fetch(`${APP_API}/api/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ items: cart.lines, successUrl: `${here}?compra=ok`, cancelUrl: `${here}#/loja` }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.url) { location.href = out.url; return; }
      const item = data.shop.find((i) => i.id === out.itemId);
      if (out.itemId && ['sold_out', 'not_found', 'not_for_sale'].includes(out.error)) {
        cart.set(out.itemId, 0);
        await load().catch(() => {});
      }
      renderCart((ERRORS[out.error] || (() => 'Não foi possível abrir o pagamento. Tenta outra vez.'))(item?.title));
    } catch (err) {
      console.error(err);
      renderCart('Sem ligação ao pagamento. Verifica a internet e tenta outra vez.');
    }
  };

  const openCart = () => { renderCart(); const d = $('#cart'); if (!d.open) d.showModal(); };
  const closeCart = () => $('#cart').close();

  // ------------------------------------------------------------------ router
  const routes = [
    [/^\/?$/, 'home', 'Ink Compatível · Tattoo studio em Vila Nova de Gaia', ''],
    [/^\/artistas\/?$/, 'artists', 'Artistas · Ink Compatível', 'artistas'],
    [/^\/artistas\/([^/]+)$/, 'artist', null, 'artistas'],
    [/^\/portfolio\/?$/, 'portfolio', 'Portfólio · Ink Compatível', 'portfolio'],
    [/^\/loja\/?$/, 'shop', 'Loja · Ink Compatível', 'loja'],
    [/^\/loja\/([^/]+)$/, 'product', null, 'loja'],
    [/^\/estudio\/?$/, 'studio', 'Estúdio · Ink Compatível', 'estudio'],
    [/^\/marcar\/?$/, 'booking', 'Marcar sessão · Ink Compatível', 'marcar'],
    [/^\/teste\/?$/, 'quiz', 'Teste de compatibilidade · Ink Compatível', ''],
    [/^\/obrigado\/?$/, 'thanks', 'Obrigado · Ink Compatível', 'loja'],
    [/^\/privacidade\/?$/, 'privacy', 'Privacidade · Ink Compatível', ''],
    [/^\/envios\/?$/, 'shipping', 'Envios e devoluções · Ink Compatível', 'loja'],
  ];

  let lastPath = null;
  const route = () => {
    const raw = location.hash.replace(/^#/, '') || '/';
    // In-page anchors (e.g. "#trabalho") are not routes.
    if (!raw.startsWith('/')) return;
    const [pathAndAnchor, query = ''] = raw.split('?');
    const [path, anchor] = pathAndAnchor.split('#');
    const params = new URLSearchParams(query);
    const main = $('#main');
    $('#main-nav').classList.remove('open');
    $('.menu-btn').setAttribute('aria-expanded', 'false');

    if (!data.ready) return;
    if (data.failed) {
      main.replaceChildren(el('div', { class: 'wrap loading', role: 'alert', text: 'Não foi possível carregar o site. Tenta recarregar a página.' }));
      return;
    }
    const match = routes.map(([re, name, title, nav]) => ({ m: path.match(re), name, title, nav })).find((r) => r.m) || { name: 'notFound', m: [], nav: '' };
    document.title = match.title || 'Ink Compatível';
    $$('[data-nav]').forEach((a) => (a.dataset.nav === match.nav ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    let content;
    try {
      content = pages[match.name](match.m[1] ? decodeURIComponent(match.m[1]) : undefined, params);
    } catch (err) {
      console.error(err);
      content = pages.notFound();
    }
    main.replaceChildren(...[].concat(content).filter(Boolean));
    document.body.classList.toggle('has-mobile-cta', match.name !== 'booking');
    document.body.classList.toggle('home', match.name === 'home');
    // Pages that open with a red hero get the see-through header over it.
    document.body.classList.toggle('overhero', main.firstElementChild?.classList.contains('v-hero') || false);
    document.body.classList.toggle('overdark', main.firstElementChild?.classList.contains('v-lhero') || false);
    onScroll();
    $('[data-mobile-cta]').hidden = match.name === 'booking';
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
    else if (path !== lastPath) { window.scrollTo(0, 0); if (lastPath !== null) main.focus({ preventScroll: true }); }
    lastPath = path;
  };

  // On the home page the header sits transparent over the red hero until the page scrolls.
  const onScroll = () => {
    const header = $('.site-header');
    header.classList.toggle('solid', !document.body.classList.contains('overhero') || window.scrollY > 40 || $('#main-nav').classList.contains('open'));
  };

  // ------------------------------------------------------------------ boot
  const boot = async () => {
    $('[data-year]').textContent = String(new Date().getFullYear());
    $('.menu-btn').addEventListener('click', (e) => {
      const nav = $('#main-nav');
      nav.classList.toggle('open');
      e.currentTarget.setAttribute('aria-expanded', String(nav.classList.contains('open')));
      onScroll();
    });
    $$('[data-open-cart]').forEach((b) => b.addEventListener('click', openCart));
    $('[data-close-cart]').addEventListener('click', closeCart);
    $('#cart').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeCart(); });
    $('[data-close-viewer]').addEventListener('click', () => $('#viewer').close());
    $('#viewer').addEventListener('click', (e) => { if (e.target.tagName !== 'IMG') $('#viewer').close(); });
    window.addEventListener('hashchange', route);
    window.addEventListener('scroll', onScroll, { passive: true });
    updateCartCount();

    // Back from Stripe: ?compra=ok
    const search = new URLSearchParams(location.search);
    if (search.get('compra') === 'ok') history.replaceState(null, '', `${location.pathname}#/obrigado`);

    try { await load(); } catch (err) { console.error(err); data.ready = true; data.failed = true; }

    const p = data.profile;
    const wa = whatsappUrl('Olá! Queria marcar uma tatuagem.');
    const waBtn = $('[data-whatsapp]');
    if (wa) { waBtn.href = wa; waBtn.hidden = false; }
    const fwa = $('[data-footer-whatsapp]');
    if (wa) { fwa.href = wa; fwa.hidden = false; }
    const fig = instagramUrl(p.instagram);
    if (fig) { const a = $('[data-footer-instagram]'); a.href = fig.url; a.hidden = false; }
    $('[data-footer-contact]').textContent = [[p.address, p.city].filter(Boolean).join(', '), p.phone, p.email].filter(Boolean).join('\n');
    cart.reconcile();
    route();
  };

  boot();
})();

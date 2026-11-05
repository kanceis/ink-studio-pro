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

  pages.home = () => {
    const p = data.profile;
    let filter = 'all';
    const workBox = el('div');
    const drawWork = () => {
      const items = work().filter((w) => filter === 'all' || w.artistId === filter);
      const featured = items.filter((w) => w.featured);
      workBox.replaceChildren(workGrid((featured.length >= 4 ? featured : items).slice(0, 8)));
    };
    const filterChips = data.artists.length > 1
      ? el('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrar por artista' }, [{ id: 'all', displayName: 'Todos' }, ...data.artists].map((a) =>
          el('button', {
            type: 'button', class: 'chip', 'aria-pressed': String(a.id === filter), text: a.displayName,
            onclick: (e) => { filter = a.id; $$('.chip', e.target.parentNode).forEach((b) => b.setAttribute('aria-pressed', String(b === e.target))); drawWork(); },
          })))
      : null;
    drawWork();

    const shopItems = data.shop.filter((i) => i.kind === 'merch' || sellable(i)).slice(0, 3);
    const flashItems = flash().slice(0, 4);

    return [
      el('section', { class: 'wrap hero' }, [
        el('div', { class: 'stack' }, [
          mono('Sketch · Black & grey · Black & red', 'muted'),
          el('h1', { class: 'disp' }, ['Do papel', el('br'), 'à pele']),
          el('p', { text: p.tagline || `${data.artists.length === 3 ? 'Três artistas' : 'Artistas'}, um estúdio em Vila Nova de Gaia. Cada tatuagem começa num desenho feito para ti.` }),
          el('div', { class: 'hero-actions' }, [
            el('a', { class: 'btn', href: '#/marcar', text: 'Marcar sessão' }),
            el('a', { class: 'btn-out', href: '#/portfolio', text: 'Ver portfólio' }),
          ]),
          mono('Respondemos em 48 h', 'muted'),
        ]),
        studioImg(STUDIO_PHOTOS.hero, 'r45', '(max-width: 900px) 100vw, 50vw'),
      ]),

      data.artists.length
        ? el('section', { class: 'section rule', id: 'artistas' }, el('div', { class: 'wrap' }, [
            sectionHead('Os artistas', 'Escolhe pelo traço. Cada um tem o seu portfólio, o seu flash e a sua agenda.'),
            el('div', { class: 'scroller' }, data.artists.map(artistCard)),
          ]))
        : null,

      el('section', { class: 'section rule', id: 'portfolio' }, el('div', { class: 'wrap' }, [
        sectionHead('Trabalho recente', null, filterChips),
        workBox,
        el('p', {}, el('a', { class: 'lnk', href: '#/portfolio', text: 'Ver portfólio completo' })),
      ])),

      flashItems.length
        ? el('section', { class: 'section dark', id: 'flash' }, el('div', { class: 'wrap' }, [
            sectionHead('Flash disponível', 'Desenhos prontos a tatuar. Um só exemplar: depois de tatuado, sai da lista.'),
            el('div', { class: 'grid two-up', style: '--min:240px' }, flashItems.map(flashCard)),
            flash().length > 4 ? el('p', {}, el('a', { href: '#/portfolio?cat=flash', text: 'Ver todo o flash' })) : null,
          ]))
        : null,

      el('section', { class: 'section', id: 'processo' }, el('div', { class: 'wrap' }, [el('h2', { class: 'disp h2', style: 'margin-bottom:40px', text: 'Como funciona' }), steps()])),

      shopItems.length
        ? el('section', { class: 'section rule', id: 'loja' }, el('div', { class: 'wrap' }, [
            el('div', { class: 'section-head' }, [
              el('div', { class: 'stack', style: 'gap:8px' }, [mono('Ink Compatível · Loja', 'muted'), el('h2', { class: 'disp h2', text: 'Loja' })]),
              el('a', { class: 'lnk', href: '#/loja', text: 'Ver tudo na loja' }),
            ]),
            el('div', { class: 'grid two-up' }, shopItems.map(shopCard)),
          ]))
        : null,

      studioSection(),
    ];
  };

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

  pages.artist = (id, params) => {
    const a = artistById(id);
    if (!a) return pages.notFound();
    document.title = `${a.displayName} · Ink Compatível`;
    const ig = instagramUrl(a.instagram);
    const tattoos = work().filter((w) => w.artistId === a.id);
    const fl = flash().filter((f) => f.artistId === a.id);
    const originals = data.shop.filter((s) => s.artistId === a.id && s.kind !== 'merch');
    const tabs = [
      ['tat', 'Tatuagens', () => {
        const styles = [...new Set(tattoos.map((t) => t.style).filter(Boolean))];
        let style = 'all';
        const box = el('div');
        const draw = () => box.replaceChildren(workGrid(tattoos.filter((t) => style === 'all' || t.style === style), { min: '280px' }));
        draw();
        return el('div', { class: 'stack' }, [
          styles.length > 1
            ? el('div', { class: 'chips', role: 'group', 'aria-label': 'Filtrar por estilo' }, ['all', ...styles].map((s) =>
                el('button', { type: 'button', class: 'chip', 'aria-pressed': String(s === style), text: s === 'all' ? 'Tudo' : s,
                  onclick: (e) => { style = s; $$('.chip', e.target.parentNode).forEach((b) => b.setAttribute('aria-pressed', String(b === e.target))); draw(); } })))
            : null,
          box,
        ]);
      }],
      ['flash', 'Flash disponível', () => fl.length ? el('div', { class: 'grid two-up', style: '--min:260px' }, fl.map(flashCard)) : el('p', { class: 'empty', text: 'Sem flash disponível neste momento.' })],
      ['orig', 'Originais e prints', () => originals.length ? el('div', { class: 'grid two-up' }, originals.map(shopCard)) : el('p', { class: 'empty', text: 'Sem peças à venda neste momento.' })],
    ];
    let current = tabs.some((t) => t[0] === params.get('tab')) ? params.get('tab') : 'tat';
    const panel = el('div', { id: 'artist-panel', role: 'tabpanel' });
    const tabButtons = tabs.map(([key, label]) =>
      el('button', { type: 'button', class: 'tab', role: 'tab', id: `tab-${key}`, 'aria-controls': 'artist-panel', 'aria-selected': String(key === current), text: label,
        onclick: () => { current = key; tabButtons.forEach((b, i) => b.setAttribute('aria-selected', String(tabs[i][0] === key))); drawPanel(); } }));
    const drawPanel = () => { panel.setAttribute('aria-labelledby', `tab-${current}`); panel.replaceChildren(tabs.find((t) => t[0] === current)[2]()); };
    drawPanel();
    const bookable = a.acceptsBookings !== false && data.profile.bookingOpen !== false;

    return [
      el('div', { class: 'wrap switcher' }, [mono('Artistas:', 'muted'), ...data.artists.map((x) =>
        el('a', { href: `#/artistas/${encodeURIComponent(x.id)}`, 'aria-current': x.id === a.id ? 'page' : null, text: x.displayName }))]),
      el('section', { class: 'wrap artist-hero' }, [
        photo(a.photo, `Retrato de ${a.displayName}`, 'r45'),
        el('div', { class: 'stack', style: 'gap:22px' }, [
          a.styles ? mono(a.styles, 'muted') : null,
          el('h1', { class: 'disp', text: a.displayName }),
          a.fullName ? mono(a.fullName, 'muted') : null,
          a.bio ? el('p', { text: a.bio }) : null,
          el('dl', { class: 'facts' }, [
            ig ? el('dt', { class: 'mono', text: 'Instagram' }) : null,
            ig ? el('dd', {}, el('a', { href: ig.url, target: '_blank', rel: 'noopener noreferrer', text: ig.label })) : null,
            el('dt', { class: 'mono', text: 'Preço' }),
            el('dd', { text: a.priceFrom ? `Desde ${eur(a.priceFrom)} · orçamento por peça` : 'Orçamento por peça' }),
          ]),
          el('div', { class: 'hero-actions' }, [
            bookable ? el('a', { class: 'btn', href: `#/marcar?artista=${encodeURIComponent(a.id)}`, text: `Marcar sessão com ${a.displayName}` }) : mono('Agenda fechada de momento', 'muted'),
            el('a', { class: 'btn-out', href: '#trabalho', onclick: (e) => { e.preventDefault(); $('#trabalho').scrollIntoView(); }, text: 'Ver trabalho' }),
          ]),
        ]),
      ]),
      el('section', { class: 'rule', id: 'trabalho', style: 'padding-bottom:96px' }, el('div', { class: 'wrap' }, [
        el('div', { class: 'tabs', role: 'tablist', 'aria-label': `Trabalho de ${a.displayName}` }, tabButtons),
        panel,
      ])),
      bookable
        ? el('section', { class: 'section dark', style: 'padding:72px 0' }, el('div', { class: 'wrap cta-band' }, [
            el('h2', { class: 'disp', text: `Tens uma ideia para ${a.displayName === 'Jojo' ? 'a' : 'o'} ${a.displayName}?` }),
            el('a', { class: 'btn-light', href: `#/marcar?artista=${encodeURIComponent(a.id)}`, text: 'Conta-nos a ideia' }),
          ]))
        : null,
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

  pages.shop = (_, params) => {
    const kinds = [['all', 'Tudo'], ['original', 'Originais'], ['edition', 'Edições limitadas'], ['merch', 'Merch']]
      .filter(([k]) => k === 'all' || data.shop.some((i) => i.kind === k));
    let kind = kinds.some(([k]) => k === params.get('tipo')) ? params.get('tipo') : 'all';
    let artist = 'all';
    const box = el('div');
    const draw = () => {
      const items = data.shop
        .filter((i) => (kind === 'all' || i.kind === kind) && (artist === 'all' || i.artistId === artist))
        // available first, sold at the end
        .sort((a, b) => Number(a.kind !== 'merch' && !sellable(a)) - Number(b.kind !== 'merch' && !sellable(b)));
      box.replaceChildren(items.length ? el('div', { class: 'grid two-up' }, items.map(shopCard)) : el('p', { class: 'empty', text: 'Nada por aqui ainda. Volta em breve.' }));
    };
    const chipRow = (label, opts, get, set) =>
      el('div', { class: 'filter-row', role: 'group', 'aria-label': label }, opts.map(([k, t]) =>
        el('button', { type: 'button', class: 'chip', 'aria-pressed': String(get() === k), text: t,
          onclick: (e) => { set(k); $$('.chip', e.target.parentNode).forEach((b) => b.setAttribute('aria-pressed', String(b === e.target))); draw(); } })));
    draw();
    const merchUrl = safeUrl(data.profile.merchStoreUrl);
    const shopArtists = data.artists.filter((a) => data.shop.some((i) => i.artistId === a.id));
    return [
      el('section', { class: 'section' }, el('div', { class: 'wrap' }, [
        el('div', { class: 'section-head' }, [
          el('div', { class: 'stack', style: 'gap:8px' }, [mono('Ink Compatível · Loja', 'muted'), el('h1', { class: 'disp h2', text: 'Loja' })]),
          el('p', { class: 'muted', text: 'Originais são peças únicas, desenhadas à mão. Edições limitadas são numeradas e só se vendem aqui. O merch abre a loja online dos artistas.' }),
        ]),
        el('div', { class: 'filters' }, [
          kinds.length > 2 ? chipRow('Tipo de produto', kinds, () => kind, (v) => (kind = v)) : null,
          shopArtists.length > 1 ? chipRow('Artista', [['all', 'Todos os artistas'], ...shopArtists.map((a) => [a.id, a.displayName])], () => artist, (v) => (artist = v)) : null,
        ]),
        box,
        merchUrl ? el('p', { style: 'margin-top:32px' }, el('a', { class: 'btn-out', href: merchUrl, target: '_blank', rel: 'noopener noreferrer', text: `Ver todo o merch no ${merchStoreName(merchUrl)} ↗` })) : null,
        el('div', { class: 'shop-info' }, [
          ['Pagamento', 'Originais e edições pagam-se aqui, num só checkout seguro pelo Stripe.'],
          ['Envio', 'Enviados do estúdio, bem embalados. Os portes aparecem antes de pagares.'],
          ['Merch', 'Vendido e enviado pela loja online. Pagas lá, com a conta deles.'],
        ].map(([t, d]) => el('div', {}, [mono(t), el('p', { text: d })])).concat(
          el('div', {}, [mono('Devoluções'), el('p', {}, el('a', { href: '#/envios', text: 'Ler a política de envios e devoluções' }))])
        )),
      ])),
    ];
  };

  pages.product = (id) => {
    const item = data.shop.find((i) => i.id === id);
    if (!item) return pages.notFound();
    document.title = `${item.title} · Loja Ink Compatível`;
    const kindLabel = { original: 'Originais', edition: 'Edições limitadas', merch: 'Merch' }[item.kind];
    const artist = artistName(item.artistId);
    const inCart = cart.qty(item.id);
    const canBuy = sellable(item) && item.kind !== 'merch';
    const status = el('div', { 'aria-live': 'polite' });

    const add = (e) => {
      const button = e.currentTarget;
      const max = item.kind === 'original' ? 1 : Math.min(item.stock || 0, 10);
      if (cart.qty(item.id) >= max) {
        status.replaceChildren(notice(item.kind === 'original' ? 'Esta peça já está no carrinho.' : 'Já tens no carrinho todas as cópias disponíveis.'));
        return;
      }
      cart.add(item.id, 1);
      button.textContent = item.kind === 'edition' ? 'Adicionar outra' : 'Já está no carrinho';
      status.replaceChildren(el('div', { class: 'notice stack', style: 'gap:12px' }, [
        el('p', { text: `No carrinho: ${item.title}. Ao finalizar a compra fica reservado para ti durante 30 minutos.` }),
        el('div', { class: 'hero-actions' }, [
          el('button', { type: 'button', class: 'btn', onclick: openCart, text: 'Finalizar compra' }),
          el('a', { class: 'btn-out', href: '#/loja', text: 'Continuar a ver' }),
        ]),
      ]));
    };

    const facts = [
      item.dimensions ? ['Formato', item.dimensions] : null,
      item.medium ? ['Técnica', item.medium] : null,
      item.year ? ['Ano', item.year] : null,
      item.kind === 'edition' && item.editionSize ? ['Tiragem', `${item.editionSize} exemplares, numerados`] : null,
    ].filter(Boolean);
    const more = data.shop.filter((i) => i.id !== item.id && i.artistId === item.artistId && (i.kind === 'merch' || sellable(i))).slice(0, 3);
    const ext = safeUrl(item.externalUrl);

    return [
      el('nav', { class: 'wrap crumbs mono', 'aria-label': 'Caminho' }, [
        el('a', { href: '#/loja', text: 'Loja' }), ' / ',
        el('a', { href: `#/loja?tipo=${item.kind}`, text: kindLabel }), ' / ',
        el('span', { 'aria-current': 'page', text: item.title }),
      ]),
      el('section', { class: 'wrap product' }, [
        el('button', { type: 'button', class: 'photo-btn', 'aria-label': `Ver maior: ${item.title}`, onclick: () => openViewer(item, item.title) }, photo(item.image, item.title, 'r45')),
        el('div', { class: 'stack' }, [
          mono([artist, item.kind === 'edition' ? 'edição limitada · só no site' : item.kind === 'original' ? 'original · peça única' : 'merch'].filter(Boolean).join(' · '), 'muted'),
          el('h1', { class: 'disp', text: item.title }),
          el('div', { class: 'stock-line' }, [
            el('span', { class: 'price', text: eur(item.price) }),
            item.kind === 'edition' ? mono((item.stock || 0) > 0 ? `Restam ${item.stock}${item.editionSize ? ` de ${item.editionSize}` : ''}` : 'Esgotada', 'muted') : null,
            item.kind === 'original' && item.status !== 'available' ? mono(item.status === 'sold' ? 'Vendida' : 'Reservada: alguém está a pagar. Se não concluir, volta a ficar disponível.', 'muted') : null,
          ]),
          item.description ? el('p', { style: 'margin:0;white-space:pre-line;max-width:560px', text: item.description }) : null,
          facts.length ? el('dl', { class: 'facts' }, facts.flatMap(([k, v]) => [el('dt', { class: 'mono', text: k }), el('dd', { text: v })])) : null,
          item.kind === 'merch'
            ? (ext ? el('a', { class: 'btn', href: ext, target: '_blank', rel: 'noopener noreferrer', text: `Comprar no ${merchStoreName(ext)} ↗` }) : null)
            : el('button', { type: 'button', class: 'btn', disabled: !canBuy, onclick: add, text: canBuy ? (inCart ? (item.kind === 'original' ? 'Já está no carrinho' : 'Adicionar outra') : 'Adicionar ao carrinho') : item.kind === 'edition' ? 'Esgotada' : item.status === 'reserved' ? 'Reservada' : 'Vendida' }),
          status,
          item.kind !== 'merch'
            ? el('dl', { class: 'facts', style: 'border-top:2px solid var(--tinta);padding-top:20px' }, [
                el('dt', { class: 'mono', text: 'Pagamento' }), el('dd', { text: 'Seguro, pelo Stripe.' }),
                el('dt', { class: 'mono', text: 'Envio' }), el('dd', { text: `Sai do estúdio bem embalado. Portes: ${item.shippingPrice ? eur(item.shippingPrice) : 'grátis'}.` }),
                el('dt', { class: 'mono', text: 'Devoluções' }), el('dd', {}, ['14 dias para devolver, como manda a lei. ', el('a', { href: '#/envios', text: 'Ler a política' })]),
              ])
            : null,
        ]),
      ]),
      more.length && artist
        ? el('section', { class: 'section rule' }, el('div', { class: 'wrap' }, [
            sectionHead(`Mais ${artist === 'Jojo' ? 'da' : 'do'} ${artist}`),
            el('div', { class: 'grid two-up' }, more.map(shopCard)),
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

  pages.booking = (_, params) => {
    const p = data.profile;
    const wa = whatsappUrl('Olá! Queria marcar uma tatuagem.');
    const v = booking.values;
    if (booking.step === 4) { booking.step = 1; booking.values = {}; booking.sentId = null; }
    if (params.get('artista') && artistById(params.get('artista'))) v.artistId = params.get('artista');
    if (params.get('tipo') === 'flash') v.tattooType = 'Flash';
    if (params.get('flash')) v.flashNumber = params.get('flash').slice(0, 20);
    if (Object.keys(Object.fromEntries(params)).length) history.replaceState(null, '', '#/marcar');

    const bookable = data.artists.filter((a) => a.acceptsBookings !== false);
    const formBox = el('div');
    const progress = el('ol', { class: 'progress' });
    const draw = () => {
      progress.replaceChildren(...['Artista e tipo', 'A ideia', 'Contacto'].map((label, i) =>
        el('li', { class: booking.step > i ? 'on' : '', 'aria-current': booking.step === i + 1 ? 'step' : null }, [mono(`0${i + 1} · ${label}`)])));
      progress.hidden = booking.step === 4;
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
      back ? el('button', { type: 'button', class: 'btn-out', onclick: () => { save(back.form); booking.step -= 1; draw(); }, text: 'Voltar' }) : el('span'),
      el('button', { type: 'submit', class: 'btn', text: nextLabel }),
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
        form.append(
          el('h2', { class: 'disp', text: 'Com quem?' }),
          el('fieldset', {}, [
            el('legend', { class: 'hint', text: 'Escolhe o artista. Se não souberes, ajudamos.' }),
            el('div', { class: 'options' }, [
              ...bookable.map((a) => option('artistId', a.id, a.displayName, a.styles, v.artistId === a.id)),
              option('artistId', '', 'Não sei, ajudem-me', 'Sugerimos pelo estilo', !v.artistId),
            ]),
          ]),
          el('fieldset', {}, [
            el('legend', { text: 'O que procuras?' }),
            el('div', { class: 'options', onchange: (e) => { if (e.target.name === 'tattooType') flashBox.hidden = e.target.value !== 'Flash'; } }, [
              ['Desenho novo', 'Feito para ti'], ['Flash', 'Diz-nos o número'], ['Cover-up', 'Tapar uma antiga'], ['Retoque', 'Feita no estúdio'],
            ].map(([t, n]) => option('tattooType', t, t, n, (v.tattooType || 'Desenho novo') === t))),
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
        return form;
      },
      2: () => {
        const form = el('form', { class: 'form', novalidate: true });
        const zones = ['Antebraço', 'Braço', 'Ombro', 'Mão', 'Perna', 'Costas', 'Peito', 'Costela', 'Pescoço', 'Outra'];
        form.append(
          el('h2', { class: 'disp', text: 'A ideia' }),
          field('idea', 'Descreve o que imaginas', el('textarea', { id: 'idea', name: 'idea', maxlength: '4000', required: true, placeholder: v.tattooType === 'Cover-up' ? 'O que queres tapar e o que gostavas de ter no lugar.' : 'O desenho, o significado, o que não queres…' }, v.idea || '')),
          el('div', { class: 'two' }, [
            field('placement', 'Zona do corpo', el('select', { id: 'placement', name: 'placement' }, [el('option', { value: '', text: 'Escolhe' }), ...zones.map((z) => el('option', { value: z, text: z, selected: v.placement === z || null }))])),
            field('size', 'Tamanho aproximado', el('input', { id: 'size', name: 'size', maxlength: '100', placeholder: 'Ex.: 12 × 8 cm', value: v.size || '' })),
          ]),
          el('fieldset', {}, [
            el('legend', { text: 'Estilo' }),
            el('div', { class: 'options' }, ['Sketch', 'Black & grey', 'Black & red', 'Não sei'].map((s) => option('style', s, s, null, (v.style || 'Não sei') === s))),
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
          el('h2', { class: 'disp', text: 'Como falamos contigo' }),
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
          button.disabled = true; button.textContent = 'A enviar…';
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
            button.disabled = false; button.textContent = 'Enviar pedido';
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
          el('div', { class: 'hero-actions' }, [
            el('a', { class: 'btn-out', href: '#/', text: 'Voltar ao início' }),
            el('a', { class: 'btn', href: '#/portfolio', text: 'Ver mais trabalho' }),
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
    return [el('section', { class: 'wrap booking' }, [
      el('div', {}, [
        mono('Pedido de orçamento', 'muted'),
        el('h1', { class: 'disp', text: 'Marcar sessão' }),
        el('p', { style: 'margin:16px 0 0;font-size:18px;max-width:560px', text: 'Conta-nos a ideia, o tamanho e onde a queres. Respondemos em 48 h.' }),
        progress,
        formBox,
      ]),
      el('aside', { class: 'aside' }, [
        el('h2', { class: 'disp', style: 'font-size:32px', text: 'Como funciona' }),
        el('ol', {}, [
          'Mandas o pedido. Não pagas nada.',
          'O artista responde em 48 h com preço e datas.',
          p.depositInfo || 'Pagas um sinal para guardar a data. Desconta no preço final.',
          'Afinamos o esboço contigo antes da sessão.',
        ].map((t, i) => el('li', {}, [mono(`0${i + 1}`, 'muted'), el('span', { text: t })]))),
        wa ? el('div', { class: 'stack', style: 'gap:8px' }, [el('span', { style: 'font-weight:600', text: 'Preferes falar já?' }), el('a', { class: 'btn-out', href: wa, target: '_blank', rel: 'noopener noreferrer', text: 'WhatsApp do estúdio' })]) : null,
      ]),
    ])];
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
    $('[data-mobile-cta]').hidden = match.name === 'booking';
    if (anchor) document.getElementById(anchor)?.scrollIntoView();
    else if (path !== lastPath) { window.scrollTo(0, 0); if (lastPath !== null) main.focus({ preventScroll: true }); }
    lastPath = path;
  };

  // ------------------------------------------------------------------ boot
  const boot = async () => {
    $('[data-year]').textContent = String(new Date().getFullYear());
    $('.menu-btn').addEventListener('click', (e) => {
      const nav = $('#main-nav');
      nav.classList.toggle('open');
      e.currentTarget.setAttribute('aria-expanded', String(nav.classList.contains('open')));
    });
    $$('[data-open-cart]').forEach((b) => b.addEventListener('click', openCart));
    $('[data-close-cart]').addEventListener('click', closeCart);
    $('#cart').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeCart(); });
    $('[data-close-viewer]').addEventListener('click', () => $('#viewer').close());
    $('#viewer').addEventListener('click', (e) => { if (e.target.tagName !== 'IMG') $('#viewer').close(); });
    window.addEventListener('hashchange', route);
    updateCartCount();

    // Back from Stripe: ?compra=ok
    const search = new URLSearchParams(location.search);
    if (search.get('compra') === 'ok') history.replaceState(null, '', `${location.pathname}#/obrigado`);

    try { await load(); } catch (err) { console.error(err); data.ready = true; data.failed = true; }

    const p = data.profile;
    const wa = whatsappUrl('Olá! Queria marcar uma tatuagem.');
    const waBtn = $('[data-whatsapp]');
    if (wa) { waBtn.href = wa; waBtn.hidden = false; }
    $('[data-footer-contact]').textContent = [[p.address, p.city].filter(Boolean).join(', '), p.phone, p.email].filter(Boolean).join('\n');
    cart.reconcile();
    route();
  };

  boot();
})();

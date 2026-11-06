/* Ink Compatível · camada de movimento (v1)
   Especificação: ux/animacoes/especificacao-animacoes.md. Sem dependências; usa o Lenis se estiver carregado.
   O site é uma SPA: app.js volta a desenhar o #main em cada rota, por isso a camada observa o #main
   e aplica-se a tudo o que lá aparece. Cada elemento é tratado uma só vez. */
(function () {
  'use strict';
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  if (!RM) root.classList.add('mo');
  const $ = (s, r = document) => [...r.querySelectorAll(s)];
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  const once = (el, key) => (el.dataset[key] ? false : (el.dataset[key] = '1'));

  // Entra uma vez: põe .in e avisa com o evento "inview".
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    io.unobserve(e.target);
    e.target.dispatchEvent(new Event('inview'));
  }), { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
  const ioHalf = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    ioHalf.unobserve(e.target);
    e.target.dispatchEvent(new Event('inview'));
  }), { threshold: 0.5 });

  const REVEAL = '.v-kicker, .v-ahead > .v-lead, .v-ahead > .v-chips, .v-ahead > .v-btn, .v-stats > div, .v-acard, .v-quote, .v-qcard, .v-rcard, .v-prod, .v-igrow li, .v-info, .v-manifesto .big, .v-cta-hand, .v-cta-text, .v-score, .v-elist li';

  // Estado das coisas que vivem no ciclo de animação (refeito a cada scan).
  let parallax = [];
  let tapes = [];
  let estilos = null;

  const scan = (scope) => {
    // 1 · revelação
    $(REVEAL, scope).forEach((el) => {
      if (!once(el, 'mr') || el.closest('.v-hero')) return;
      el.setAttribute('data-r', '');
      const sib = [...el.parentElement.children].filter((c) => c.matches(REVEAL));
      el.style.setProperty('--i', Math.max(0, sib.indexOf(el)));
      io.observe(el);
    });
    // 3 · fotos dos bentos
    $('.v-tile, .v-split', scope).forEach((el) => {
      if (!once(el, 'mr')) return;
      el.setAttribute(el.querySelector('img') ? 'data-img' : 'data-r', '');
      el.style.setProperty('--i', [...el.parentElement.children].indexOf(el) % 4);
      io.observe(el);
    });
    // 2 · títulos: cada linha (separada por <br>) numa máscara
    $('h2.v-h2', scope).forEach((h) => {
      if (!once(h, 'mr')) return;
      const lines = [[]];
      [...h.childNodes].forEach((n) => (n.nodeName === 'BR' ? lines.push([]) : lines[lines.length - 1].push(n)));
      h.replaceChildren(...lines.map((nodes, i) => {
        const inner = document.createElement('span');
        inner.append(...nodes);
        const ln = document.createElement('span');
        ln.className = 'ln';
        ln.style.setProperty('--l', i);
        ln.append(inner);
        return ln;
      }));
      h.setAttribute('data-lines', '');
      io.observe(h);
    });

    // 4 + 5 · hero
    $('.v-hero', scope).forEach((hero) => {
      if (!once(hero, 'mr')) return;
      $('.v-apill', hero).forEach((a, i) => a.style.setProperty('--i', i));
      $('.v-doodle path', hero).forEach((p) => p.setAttribute('pathLength', '1'));
      fontsReady.then(() => setTimeout(() => requestAnimationFrame(() => hero.classList.add('go')), 120));
      const pic = hero.querySelector('.v-inpic');
      if (pic) {
        const srcs = [['painel', '40% 45%'], ['caveira-sketch', '50% 40%'], ['tatuagem-081', '50% 45%'], ['vespa-lapis', '50% 50%'], ['vespa-aguarela', '50% 50%'], ['ig-caveira-flores', '50% 40%']];
        const first = pic.querySelector('img');
        if (first) first.classList.add('on');
        srcs.slice(1).forEach(([name, pos]) => {
          const im = new Image();
          im.alt = '';
          im.decoding = 'async';
          im.src = `assets/v3/${name}-800.webp`;
          im.style.objectPosition = pos;
          pic.append(im);
        });
        if (!RM) {
          let k = 0;
          const t = setInterval(() => {
            if (!pic.isConnected) return clearInterval(t);
            const im = pic.children;
            im[k].classList.remove('on');
            k = (k + 1) % im.length;
            im[k].classList.add('on');
          }, 1800);
        }
      }
    });

    // 8 · números que contam (4,8 · 38 · 48 h · 3 …)
    $('.v-stats b, .v-score, .v-gstamp .n', scope).forEach((el) => {
      if (RM || !once(el, 'mc')) return;
      const m = el.textContent.trim().match(/^(\d+)(?:,(\d))?(.*)$/);
      if (!m || el.textContent.includes(':')) return;
      const target = parseFloat(`${m[1]}.${m[2] || 0}`);
      const dec = m[2] ? 1 : 0;
      const suf = m[3];
      const show = (v) => { el.textContent = v.toFixed(dec).replace('.', ',') + suf; };
      el.setAttribute('aria-label', el.textContent.trim());
      show(0);
      el.addEventListener('inview', () => {
        const t0 = performance.now();
        const f = (t) => { const p = Math.min(1, (t - t0) / 1400); show(target * (1 - Math.pow(1 - p, 4))); if (p < 1) requestAnimationFrame(f); };
        requestAnimationFrame(f);
      }, { once: true });
      ioHalf.observe(el);
    });

    // 10 · teste: a barra da pergunta atual enche; o nome do resultado escreve-se letra a letra
    $('.v-bars', scope).forEach((bars) => {
      if (!once(bars, 'mr')) return;
      const on = $('i.on', bars);
      if (on.length > 1) on[on.length - 1].classList.add('fill');
    });
    $('.v-rcard.done .name', scope).forEach((n) => {
      if (RM || !once(n, 'mt')) return;
      const full = n.textContent;
      n.setAttribute('aria-label', full);
      n.textContent = '';
      n.classList.add('typed');
      let i = 0;
      setTimeout(function type() { n.textContent = full.slice(0, ++i); if (i < full.length) setTimeout(type, 110); }, 350);
    });

    // 11 · flash: cada carta parte do centro da fila
    $('.v-frows', scope).forEach((rows) => {
      if (!once(rows, 'mr')) return;
      const rr = rows.getBoundingClientRect();
      $('.v-fcard', rows).forEach((c, i) => {
        const b = c.getBoundingClientRect();
        c.style.setProperty('--fx', `${(rr.left + rr.width / 2 - (b.left + b.width / 2)).toFixed(0)}px`);
        c.style.setProperty('--i', i);
      });
      io.observe(rows);
    });

    // 9 · Estilos da casa
    $('.v-estilos', scope).forEach((st) => {
      if (!once(st, 'mr')) return;
      const lis = $('.v-elist li', st);
      const figs = $('.v-eframe figure', st);
      const bars = $('.prog b', st);
      let cur = 0;
      const set = (n) => {
        if (n === cur) return;
        cur = n;
        lis.forEach((l, i) => l.classList.toggle('on', i === n));
        figs.forEach((f, i) => f.classList.toggle('on', i === n));
      };
      lis.forEach((l, i) => l.querySelector('button').addEventListener('click', () => {
        const top = st.getBoundingClientRect().top + scrollY;
        const span = st.offsetHeight - innerHeight;
        const y = top + span * (i + 0.5) / lis.length;
        if (lenis) lenis.scrollTo(y); else window.scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' });
      }));
      st._upd = () => {
        const b = st.getBoundingClientRect();
        const span = st.offsetHeight - innerHeight;
        const p = Math.min(0.9999, Math.max(0, -b.top / span));
        const n = Math.floor(p * lis.length);
        set(n);
        const f = p * lis.length - n;
        bars.forEach((x, i) => { x.style.width = `${i < n ? 100 : i === n ? f * 100 : 0}%`; });
      };
    });

    // 12 · CTA: a palavra roda
    $('.rot', scope).forEach((rot) => {
      if (!once(rot, 'mr')) return;
      const ws = $('.w', rot);
      const svg = rot.querySelector('svg');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.querySelector('path').setAttribute('pathLength', '1');
      let k = 0;
      const fit = () => { rot.style.width = `${ws[k].offsetWidth}px`; };
      fontsReady.then(fit);
      addEventListener('resize', fit);
      if (RM) return;
      svg.classList.add('draw');
      let vis = false;
      new IntersectionObserver((e) => { vis = e[0].isIntersecting; }).observe(rot);
      const t = setInterval(() => {
        if (!rot.isConnected) { clearInterval(t); removeEventListener('resize', fit); return; }
        if (!vis) return;
        const a = ws[k];
        a.classList.remove('on');
        a.classList.add('out');
        setTimeout(() => a.classList.remove('out'), 450);
        k = (k + 1) % ws.length;
        ws[k].classList.add('on');
        fit();
        svg.classList.remove('draw');
        void svg.getBoundingClientRect();
        svg.classList.add('draw');
      }, 2300);
    });

    // 6 + 7 · listas do ciclo de animação
    parallax = $('.v-hero .v-polaroid, .v-hero .v-doodle, .v-cta .v-polaroid');
    parallax.forEach((el, i) => {
      el._sp = el.closest('.v-cta') ? (i % 2 ? 0.12 : -0.1) : (el.matches('svg') ? 0.18 : (i % 2 ? 0.1 : 0.22));
      el._sec = el.closest('section');
    });
    tapes = $('.v-mq').map((t) => t.getAnimations()[0]).filter(Boolean);
    estilos = document.querySelector('.v-estilos');
  };

  // 13 · wordmark do rodapé (fixo, fora do #main)
  const wm = document.querySelector('.footer-wordmark');
  if (wm) {
    const txt = wm.textContent.trim();
    wm.replaceChildren(...[...txt].map((c, i) => {
      const s = document.createElement('span');
      s.style.setProperty('--i', i);
      s.textContent = c === ' ' ? ' ' : c;
      return s;
    }));
    wm.classList.add('wm');
    io.observe(wm);
    if (!RM) {
      const sp = [...wm.children];
      wm.addEventListener('inview', () => setTimeout(() => wm.classList.add('live'), 1200));
      wm.addEventListener('mousemove', (e) => sp.forEach((s) => {
        const b = s.getBoundingClientRect();
        const k = Math.max(0, 1 - Math.abs(e.clientX - (b.left + b.width / 2)) / 260);
        s.style.translate = `0 ${(-k * 22).toFixed(1)}%`;
        s.style.color = k > 0.6 ? '#D0201A' : '';
      }));
      wm.addEventListener('mouseleave', () => sp.forEach((s) => { s.style.translate = ''; s.style.color = ''; }));
    }
  }

  // Scroll suave (Lenis, lerp .1) + paralaxe + velocidade das fitas
  let lenis = null;
  if (!RM && window.Lenis) lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
  // Depois de uma mudança de rota o app.js mexe no scroll; o Lenis tem de partir dessa posição.
  addEventListener('hashchange', () => { if (lenis) requestAnimationFrame(() => lenis.scrollTo(scrollY, { immediate: true, force: true })); });

  let lastY = scrollY;
  let vel = 0;
  const frame = (t) => {
    if (lenis) lenis.raf(t);
    const y = scrollY;
    vel += ((y - lastY) - vel) * 0.2;
    lastY = y;
    if (!RM) {
      parallax.forEach((el) => {
        if (!el.isConnected || !el._sec) return;
        const b = el._sec.getBoundingClientRect();
        const off = el._sec.classList.contains('v-hero') ? b.top : (b.top + b.height / 2 - innerHeight / 2);
        el.style.setProperty('--py', `${(off * el._sp).toFixed(1)}px`);
      });
      const rate = 1 + Math.min(5, Math.abs(vel) * 0.25);
      tapes.forEach((a) => { a.playbackRate = rate; });
    }
    if (estilos && estilos.isConnected && estilos._upd) estilos._upd();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // O app.js desenha o #main de forma assíncrona; cada vez que aparecem elementos novos, aplica a camada.
  const main = document.getElementById('main');
  if (main) {
    let queued = false;
    new MutationObserver((records) => {
      if (queued || !records.some((r) => [...r.addedNodes].some((n) => n.nodeType === 1))) return;
      queued = true;
      queueMicrotask(() => { queued = false; scan(main); });
    }).observe(main, { childList: true, subtree: true });
    scan(main);
  }
})();

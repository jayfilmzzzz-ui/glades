/* Glades storefront logic — render catalog, filter, quick-view, contact (demo). Checkout deferred. */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const products = window.GLADES_PRODUCTS || [];
  const grid = $('#grid');
  const typeLabel = (t) => (t === 'hat' ? 'Hat' : 'Tee');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gallery = (p) => (Array.isArray(p.imgs) && p.imgs.length ? p.imgs : [p.img]);
  // escape text for safe interpolation into HTML text + double-quoted attributes (names contain " and &)
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  let descentRefresh = null; // assigned by the descent block; called by the tab switcher to re-arm the pan on Shop re-entry

  function card(p) {
    const shots = gallery(p).length;
    const count = shots > 1 ? `<span class="card-shots" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M21 7v12a2 2 0 0 1-2 2H7"/></svg>${shots}</span>` : '';
    return `<article class="card reveal" data-id="${p.id}" data-cat="${p.type}" role="button" tabindex="0" aria-label="${esc(p.name)} — $${p.price}${shots > 1 ? `, ${shots} photos` : ''}, quick view">
      <div class="card-img"><span class="card-badge">${typeLabel(p.type)}</span>${count}<img src="${p.img}" alt="${esc(p.name)}" loading="lazy" /></div>
      <div class="card-body">
        <div class="card-name">${esc(p.name)}</div>
        <div class="card-note">${esc(p.note || '')}</div>
        <div class="card-foot">
          <span class="card-price">$${p.price}</span>
          <button class="card-buy" type="button" data-buy="${p.id}">Buy</button>
        </div>
      </div>
    </article>`;
  }

  function render(cat = 'all') {
    grid.innerHTML = products.filter((p) => cat === 'all' || p.type === cat).map(card).join('');
    wireReveal();
  }

  // filters — real category filtering (All / Hats / Tees)
  $$('#filters .filter').forEach((b) => b.addEventListener('click', () => {
    $$('#filters .filter').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    render(b.dataset.cat);
    dispatchEvent(new Event('resize')); // grid height changed → recompute the descent pan
  }));

  // ---- quick-view modal with focus management ----
  const modal = $('#modal'), modalBody = $('#modalBody'), modalCard = $('.modal-card', modal);
  let lastFocus = null;
  function trapTab(e) {
    if (e.key !== 'Tab') return;
    const f = $$('button, a[href], input, textarea, [tabindex]:not([tabindex="-1"])', modalCard).filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  let galDispose = null;
  function openModal(p) {
    if (galDispose) { galDispose(); galDispose = null; }
    lastFocus = document.activeElement;
    const imgs = gallery(p);
    const multi = imgs.length > 1;
    const thumbs = multi ? `<div class="mgal-thumbs" role="tablist" aria-label="${esc(p.name)} photos">
        ${imgs.map((src, i) => `<button class="mgal-thumb${i === 0 ? ' is-on' : ''}" type="button" role="tab" aria-selected="${i === 0}" aria-controls="mgalMain" tabindex="${i === 0 ? 0 : -1}" data-i="${i}" aria-label="Photo ${i + 1} of ${imgs.length}"><img src="${src}" alt="" loading="lazy" /></button>`).join('')}
      </div>` : '';
    const arrows = multi ? `<button class="mgal-arr prev" type="button" data-dir="-1" aria-label="Previous photo">‹</button>
        <button class="mgal-arr next" type="button" data-dir="1" aria-label="Next photo">›</button>` : '';
    modalBody.innerHTML = `<div class="mgal" data-i="0">
        <div class="mgal-stage">
          <img class="mgal-main" id="mgalMain" src="${imgs[0]}" alt="${esc(p.name)}${multi ? ' — photo 1 of ' + imgs.length : ''}"${multi ? ' aria-describedby="mgalCount"' : ''} />
          ${arrows}
          ${multi ? `<span class="mgal-count" id="mgalCount" aria-live="polite" aria-atomic="true">1 / ${imgs.length}</span>` : ''}
        </div>
        ${thumbs}
      </div>
      <div class="modal-info">
        <span class="card-badge">${typeLabel(p.type)}</span>
        <h3 id="modalTitle">${esc(p.name)}</h3>
        <div class="price">$${p.price}</div>
        <p>${esc(p.note || '')}</p>
        <button class="btn btn-primary" type="button" data-buy="${p.id}">Buy — $${p.price}</button>
        <small>Secure checkout coming soon — this is a preview. We'll wire ordering (Etsy / Shopify) next.</small>
      </div>`;
    modalCard.setAttribute('aria-labelledby', 'modalTitle');
    modal.hidden = false; document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => modal.classList.add('is-open'));   // scale+fade in
    modalCard.addEventListener('keydown', trapTab);
    galDispose = multi ? wireGallery($('.mgal', modalBody), imgs) : null;
    $('.modal-x', modal).focus();
  }

  // gallery controller: thumbnails + arrows + swipe + ←/→ keys; each gallery = only its product's verified photos
  function wireGallery(root, imgs) {
    const main = $('.mgal-main', root), count = $('.mgal-count', root);
    const thumbs = $$('.mgal-thumb', root);
    const baseAlt = (main.getAttribute('alt') || '').replace(/ — photo \d+ of \d+$/, '');
    let i = 0;
    const go = (n) => {
      i = (n + imgs.length) % imgs.length;
      root.dataset.i = i;
      main.src = imgs[i];
      main.alt = `${baseAlt} — photo ${i + 1} of ${imgs.length}`;
      if (count) count.textContent = `${i + 1} / ${imgs.length}`;
      thumbs.forEach((t, k) => { const on = k === i; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
      if (thumbs[i]) thumbs[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced ? 'auto' : 'smooth' });
    };
    const onClick = (e) => {
      const arr = e.target.closest('.mgal-arr'); if (arr) { go(i + (+arr.dataset.dir)); return; }
      const th = e.target.closest('.mgal-thumb'); if (th) go(+th.dataset.i);
    };
    const onKey = (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    };
    let x0 = null;
    const ts = (e) => { x0 = e.changedTouches[0].clientX; };
    const te = (e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1)); x0 = null; };
    root.addEventListener('click', onClick);
    modalCard.addEventListener('keydown', onKey);
    const stage = $('.mgal-stage', root);
    stage.addEventListener('touchstart', ts, { passive: true });
    stage.addEventListener('touchend', te, { passive: true });
    return () => { modalCard.removeEventListener('keydown', onKey); };
  }
  function closeModal() {
    if (modal.hidden) return;
    modal.classList.remove('is-open');                 // scale+fade out
    document.body.style.overflow = '';
    modalCard.removeEventListener('keydown', trapTab);
    if (galDispose) { galDispose(); galDispose = null; }
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (reduced) { modal.hidden = true; }
    else setTimeout(() => { if (!modal.classList.contains('is-open')) modal.hidden = true; }, 270);
  }
  // close: tap the backdrop OR the X (both carry data-close)
  modal.addEventListener('click', (e) => { if (e.target.matches('[data-close]')) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  // mobile: swipe DOWN on the card to dismiss (vertical-dominant gesture; won't clash with the gallery's horizontal swipe)
  let _sy = null, _sx = null;
  modalCard.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; _sy = t.clientY; _sx = t.clientX; }, { passive: true });
  modalCard.addEventListener('touchend', (e) => {
    if (_sy == null) return;
    const t = e.changedTouches[0], dy = t.clientY - _sy, dx = t.clientX - _sx;
    if (dy > 90 && dy > Math.abs(dx) * 1.4) closeModal();
    _sy = _sx = null;
  }, { passive: true });

  // delegate: buy → placeholder toast; card click/Enter/Space → modal
  document.addEventListener('click', (e) => {
    const buy = e.target.closest('[data-buy]');
    if (buy) { e.stopPropagation();
      const p = products.find((x) => x.id === buy.dataset.buy);
      flash(`"${p.name}" — checkout coming soon. We'll wire ordering next.`);
      return;
    }
    const c = e.target.closest('.card');
    if (c) { const p = products.find((x) => x.id === c.dataset.id); if (p) openModal(p); }
  });
  grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const c = e.target.closest('.card');
    if (c && !e.target.closest('[data-buy]')) { e.preventDefault(); const p = products.find((x) => x.id === c.dataset.id); if (p) openModal(p); }
  });

  // tiny toast
  let toastEl;
  function flash(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'g-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl);
      Object.assign(toastEl.style, { position: 'fixed', left: '50%', bottom: '26px', transform: 'translateX(-50%) translateY(16px)',
        background: '#16291d', color: '#f5efe2', padding: '12px 20px', borderRadius: '999px', font: '600 13px Inter,sans-serif',
        boxShadow: '0 14px 34px rgba(0,0,0,.3)', zIndex: 200, opacity: 0, transition: '.22s', pointerEvents: 'none', maxWidth: '90vw', textAlign: 'center' }); }
    toastEl.textContent = msg; toastEl.style.opacity = 1; toastEl.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(flash._t); flash._t = setTimeout(() => { toastEl.style.opacity = 0; toastEl.style.transform = 'translateX(-50%) translateY(16px)'; }, 2600);
  }

  // contact + ride-booking forms (demo) with a11y feedback — wires every .contact-form (Airboat Rides + Contact tabs)
  $$('.contact-form').forEach((form) => form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const bad = [];
    [f.name, f.contact].forEach((el) => {
      if (!el || !el.setAttribute) return;
      const ok = el.value.trim().length > 0;
      el.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok) bad.push(el);
    });
    if (bad.length) { bad[0].focus(); flash('Add your name + a way to reach you.'); return; }
    const note = f.querySelector('.form-note'); if (note) note.hidden = false;
    flash("Got it (demo) — we'll wire this to email/booking next.");
    f.reset();
  }));

  // reveal on scroll (fresh observer each render; threshold 0 = never blank on tall/narrow)
  let io = null;
  function wireReveal() {
    if (io) io.disconnect();
    const els = $$('.reveal:not(.in)');
    if (!('IntersectionObserver' in window) || reduced) { els.forEach((e) => e.classList.add('in')); return; }
    io = new IntersectionObserver((ents, ob) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); ob.unobserve(en.target); } }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    els.forEach((e) => io.observe(e));
  }

  // subtle hero parallax (cinematic depth; disabled for reduced-motion)
  const heroBg = $('.hero-bg');
  if (heroBg && !reduced) {
    let ticking = false;
    addEventListener('scroll', () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => { heroBg.style.transform = `translate3d(0, ${(window.scrollY * 0.28).toFixed(1)}px, 0)`; ticking = false; });
    }, { passive: true });
  }

  // SCROLL-DESCENT: pan the tall stitched scene by scroll progress so scrolling the shop = descending the water.
  // Scene is shown full-width at natural scale; we translate it up to reveal deeper layers. Smooth via rAF + transform3d.
  // When the scene is shorter than the section (narrow/mobile) maxT=0 → no pan, native scroll reveals it.
  const shopBg = $('.shop-bg'), shopSec = $('#shop');
  if (shopBg && shopSec) {
    let t2 = false;
    const motionMQ = matchMedia('(prefers-reduced-motion: reduce)');
    const updDescent = () => {
      const secH = shopSec.offsetHeight;
      const sceneH = shopBg.offsetHeight;            // full descent scene at current width
      const maxT = Math.max(0, sceneH - secH);       // how much taller the scene is than the section
      // no pan when the scene fits (mobile/native) or the section is shorter than the viewport (e.g. filtered to one row)
      if (maxT === 0 || secH <= window.innerHeight) { shopBg.style.transform = ''; shopBg.style.willChange = 'auto'; return; }
      if (motionMQ.matches) {                        // reduced-motion: static deep-frame (descent "story", no scroll motion)
        shopBg.style.transform = `translate3d(0, ${(-0.32 * maxT).toFixed(1)}px, 0)`;
        shopBg.style.willChange = 'auto';
        return;
      }
      const span = Math.max(1, secH - window.innerHeight);
      const p = Math.max(0, Math.min(1, -shopSec.getBoundingClientRect().top / span));
      // promote to its own layer ONLY while actively mid-pan (drop it at the clamped ends / off-shop)
      shopBg.style.willChange = (p > 0 && p < 1) ? 'transform' : 'auto';
      shopBg.style.transform = `translate3d(0, ${(-p * maxT).toFixed(1)}px, 0)`;
    };
    addEventListener('scroll', () => { if (t2) return; t2 = true; requestAnimationFrame(() => { updDescent(); t2 = false; }); }, { passive: true });
    addEventListener('resize', updDescent, { passive: true });
    // respect in-session reduced-motion toggle (addListener fallback for old iOS Safari)
    if (motionMQ.addEventListener) motionMQ.addEventListener('change', updDescent);
    else if (motionMQ.addListener) motionMQ.addListener(updDescent);
    descentRefresh = updDescent; // expose so the tab switcher can re-arm the pan when Shop is re-opened
    updDescent();
  }

  render('all');

  // ===== REAL TAB SWITCHER (SPA): nav switches views, resets scroll, re-arms the descent on Shop re-entry =====
  (function tabs() {
    const VIEWS = ['shop', 'rides', 'contact'];
    const norm = (n) => (VIEWS.includes(n) ? n : 'shop');
    // route hashes are '#/<view>' (slash-prefixed so they never collide with in-page element ids → no anchor-scroll)
    const routeOf = (h) => (String(h || '').replace(/^#\/?/, '')) || '';
    const hashFor = (name) => '#/' + name;
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; // we control scroll on route change, not the browser
    function show(name, opts = {}) {
      name = norm(name);
      $$('.tabview').forEach((v) => { const on = v.id === 'view-' + name; v.classList.toggle('is-active', on); v.hidden = !on; });
      $$('.nav-tab').forEach((a) => { const on = a.dataset.tab === name; a.classList.toggle('is-active', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); } // snap to top (not smooth-animate through content)
      if (name === 'shop') {
        // SPA gotcha: after a display:none→show toggle the pan/observers can go stale — re-arm them once layout is back
        requestAnimationFrame(() => {
          if (descentRefresh) descentRefresh();
          wireReveal();
          if (opts.scrollGrid) { const sh = $('#shop'); if (sh) sh.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' }); }
        });
      }
      const view = $('#view-' + name); if (view && view.focus) view.focus({ preventScroll: true });
    }
    // tab links → switch view + push canonical route hash
    $$('[data-tab]').forEach((el) => el.addEventListener('click', (e) => {
      e.preventDefault();
      const name = norm(el.dataset.tab);
      show(name, { scrollGrid: el.hasAttribute('data-scroll-grid') });
      const hash = hashFor(name);
      if (location.hash !== hash) history.pushState({ tab: name }, '', hash);
    }));
    // in-view smooth-scroll links (e.g. hero "Book an Airboat Ride" → booking form) — no route/hash change
    $$('[data-scroll-to]').forEach((el) => el.addEventListener('click', (e) => {
      const target = $(el.getAttribute('data-scroll-to'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }); }
    }));
    addEventListener('popstate', () => show(routeOf(location.hash)));
    // initial load: honor a valid deep-link route, else Shop; canonicalize an invalid/non-route hash
    const initial = routeOf(location.hash);
    if (location.hash && !VIEWS.includes(initial)) history.replaceState({}, '', hashFor('shop'));
    show(initial);
  })();
})();

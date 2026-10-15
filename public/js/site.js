/* ARSARA storefront behaviour: cart, shipping calculator, WhatsApp checkout, menu, reveals, gallery. */
(function () {
  'use strict';
  var M = window.ArsaraMoney;
  var CART_KEY = 'arsara.cart.v1';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- storage (wrapped: may be unavailable) ---------- */
  function loadCart() {
    try {
      var raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      if (!Array.isArray(raw)) return [];
      return raw.filter(function (l) { return l && typeof l.slug === 'string' && Number.isInteger(l.qty) && l.qty > 0; })
        .map(function (l) { return { slug: l.slug, qty: Math.min(l.qty, 99) }; });
    } catch (e) { return memCart; }
  }
  var memCart = [];
  function saveCart(c) { memCart = c; try { localStorage.setItem(CART_KEY, JSON.stringify(c)); } catch (e) { /* ignore */ } }

  /* ---------- catalogue (prices/stock from trusted server) ---------- */
  var catalogPromise = null;
  function catalog() {
    if (!catalogPromise) {
      catalogPromise = fetch('/api/catalog', { headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error('catalog'); return r.json(); })
        .catch(function (e) { catalogPromise = null; throw e; });
    }
    return catalogPromise;
  }
  function productBySlug(cat, slug) { return cat.products.filter(function (p) { return p.slug === slug; })[0]; }

  /* ---------- toast ---------- */
  function toast(msg, opts) {
    opts = opts || {};
    var region = $('#toast-region'); if (!region) return;
    var t = document.createElement('div');
    t.className = 'toast' + (opts.error ? ' err' : '');
    var s = document.createElement('span'); s.textContent = msg; t.appendChild(s);
    if (opts.href) { var a = document.createElement('a'); a.href = opts.href; a.textContent = opts.label || 'View'; t.appendChild(a); }
    region.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 320); }, opts.ms || 3800);
  }

  /* ---------- cart count badge ---------- */
  function updateBadge(bump) {
    var n = loadCart().reduce(function (a, l) { return a + l.qty; }, 0);
    $$('[data-cart-count]').forEach(function (el) {
      el.textContent = n; el.setAttribute('data-zero', n === 0 ? 'true' : 'false');
      if (bump) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    });
    var link = $('[data-cart-link]'); if (link) link.setAttribute('aria-label', 'Cart, ' + n + (n === 1 ? ' item' : ' items'));
  }

  /* ---------- add to cart ---------- */
  function addToCart(slug, qty) {
    return catalog().then(function (cat) {
      var p = productBySlug(cat, slug);
      if (!p) { toast('This product is no longer available.', { error: true }); return false; }
      var cart = loadCart();
      var line = cart.filter(function (l) { return l.slug === slug; })[0];
      var have = line ? line.qty : 0;
      if (p.stock <= 0) { toast(p.name + ' is out of stock.', { error: true }); return false; }
      var room = p.stock - have;
      if (room <= 0) { toast('You already have all ' + p.stock + ' available in your cart.', { error: true, href: '/cart', label: 'View cart' }); return false; }
      var add = Math.min(qty, room);
      if (line) line.qty += add; else cart.push({ slug: slug, qty: add });
      saveCart(cart); updateBadge(true);
      toast(add < qty ? 'Added ' + add + ' (only ' + p.stock + ' available).' : 'Added to cart.', { href: '/cart', label: 'View cart' });
      return true;
    }).catch(function () { toast('Could not reach the shop. Please try again.', { error: true }); return false; });
  }

  /* ---------- shipping message (dynamic, never hardcoded amounts) ---------- */
  function shipMessage(t, cfg) {
    if (t.itemCount === 0) return 'Add items to see your shipping.';
    if (t.freeShipping) return 'Free shipping unlocked.';
    return 'Add ' + M.formatPaise(t.remainingForFreePaise) + ' more to unlock free shipping.';
  }

  /* ---------- menu ---------- */
  function initMenu() {
    var btn = $('[data-menu-open]'), panel = $('#mobile-nav'), close = $('[data-menu-close]');
    if (!btn || !panel) return;
    var lastFocus = null;
    function focusables() { return $$('a[href], button:not([disabled])', panel).filter(function (el) { return el.offsetParent !== null || el === close; }); }
    function open() {
      lastFocus = document.activeElement;
      panel.hidden = false; void panel.offsetWidth; panel.classList.add('open');
      btn.setAttribute('aria-expanded', 'true'); document.body.style.overflow = 'hidden';
      var f = focusables(); (f[1] || f[0]).focus();
      Array.prototype.forEach.call(document.body.children, function (c) { if (c !== panel && c.tagName !== 'SCRIPT') c.setAttribute('inert', ''); });
    }
    function shut() {
      panel.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); document.body.style.overflow = '';
      Array.prototype.forEach.call(document.body.children, function (c) { c.removeAttribute('inert'); });
      setTimeout(function () { if (!panel.classList.contains('open')) panel.hidden = true; }, 600);
      if (lastFocus) lastFocus.focus();
    }
    btn.addEventListener('click', open); close.addEventListener('click', shut);
    $$('a', panel).forEach(function (a) { a.addEventListener('click', function () { panel.classList.remove('open'); document.body.style.overflow = ''; Array.prototype.forEach.call(document.body.children, function (c) { c.removeAttribute('inert'); }); }); });
    document.addEventListener('keydown', function (e) {
      if (!panel.classList.contains('open')) return;
      if (e.key === 'Escape') { e.preventDefault(); shut(); return; }
      if (e.key === 'Tab') {
        var f = focusables(); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 960 && panel.classList.contains('open')) shut(); });
  }

  /* ---------- scroll reveal ---------- */
  function initReveal() {
    var els = $$('[data-reveal], [data-mask]');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || document.documentElement.classList.contains('rm')) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el, i) { if (el.hasAttribute('data-reveal')) el.style.setProperty('--rd', (i % 3) * 0.08 + 's'); io.observe(el); });
    // Safety net: never leave content hidden.
    setTimeout(function () { els.forEach(function (e) { var r = e.getBoundingClientRect(); if (r.top < window.innerHeight) e.classList.add('in'); }); }, 1200);
  }

  /* ---------- gallery ---------- */
  function initGallery() {
    var g = $('[data-gallery]'); if (!g) return;
    var main = $('[data-gallery-main]', g);
    $$('[data-thumb]', g).forEach(function (b) {
      b.addEventListener('click', function () {
        main.src = b.getAttribute('data-src'); main.alt = b.getAttribute('data-alt');
        $$('[data-thumb]', g).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      });
    });
  }

  /* ---------- quantity + add buttons ---------- */
  function clampQty(input) {
    var max = parseInt(input.getAttribute('max'), 10) || 99;
    var v = parseInt(input.value, 10); if (!(v >= 1)) v = 1; if (v > max) v = max;
    input.value = v; return v;
  }
  function initProduct() {
    var root = $('[data-product]'); if (!root) return;
    var input = $('[data-qty]', root); var msg = $('[data-qty-msg]', root);
    if (input) {
      $('[data-qty-dec]', root).addEventListener('click', function () { input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1); msg.textContent = ''; });
      $('[data-qty-inc]', root).addEventListener('click', function () {
        var max = parseInt(input.getAttribute('max'), 10) || 1, v = (parseInt(input.value, 10) || 1) + 1;
        if (v > max) { msg.textContent = 'Only ' + max + ' available.'; v = max; } else msg.textContent = '';
        input.value = v;
      });
      input.addEventListener('change', function () { clampQty(input); });
    }
    // refresh stock live from the server (page may be cached)
    catalog().then(function (cat) {
      var p = productBySlug(cat, root.getAttribute('data-product')); if (!p || !input) return;
      input.setAttribute('max', Math.max(1, p.stock)); clampQty(input);
      var st = $('[data-stock-status]', root);
      if (st && p.stock <= 0) { st.lastChild.textContent = 'Out of stock'; }
    }).catch(function () {});
  }
  function initAddButtons() {
    $$('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        var qty = 1;
        if (b.hasAttribute('data-use-qty')) { var i = $('[data-qty]'); if (i) qty = clampQty(i); }
        b.disabled = true; addToCart(b.getAttribute('data-add'), qty).then(function () { b.disabled = false; });
      });
    });
  }

  /* ---------- shipping calculator (no personal info) ---------- */
  function initCalc() {
    $$('[data-shipcalc]').forEach(function (box) {
      var unit = parseInt(box.getAttribute('data-unit'), 10), max = parseInt(box.getAttribute('data-max'), 10) || 1;
      var qty = $('[data-calc-qty]', box);
      var out = { sub: $('[data-calc-sub]', box), ship: $('[data-calc-ship]', box), total: $('[data-calc-total]', box), msg: $('[data-calc-msg]', box) };
      catalog().then(function (cat) {
        function run() {
          var q = parseInt(qty.value, 10); if (!(q >= 1)) q = 1; if (q > max) q = max; qty.value = q;
          var t = M.calculate([{ unitPaise: unit, qty: q }], cat.config);
          out.sub.textContent = M.formatPaise(t.merchandisePaise);
          out.ship.textContent = t.shippingPaise === 0 ? 'FREE' : M.formatPaise(t.shippingPaise);
          out.total.textContent = M.formatPaise(t.totalPaise);
          out.msg.textContent = shipMessage(t); out.msg.classList.toggle('ok', t.freeShipping);
        }
        qty.addEventListener('input', run); qty.addEventListener('change', run);
        $('[data-calc-dec]', box).addEventListener('click', function () { qty.value = Math.max(1, (parseInt(qty.value, 10) || 1) - 1); run(); });
        $('[data-calc-inc]', box).addEventListener('click', function () { qty.value = (parseInt(qty.value, 10) || 1) + 1; run(); });
        run();
      }).catch(function () {});
    });
  }

  /* ---------- cart page ---------- */
  function initCartPage() {
    var root = $('[data-cart-root]'); if (!root) return;
    var linesEl = $('[data-cart-lines]', root), sumEl = $('[data-cart-summary]', root);
    var checkoutBtn = $('[data-checkout]', root), checkoutMsg = $('[data-checkout-msg]', root);
    var state = null;

    function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
    function iconSvg(name) {
      var paths = { minus: '<path d="M5 12h14"/>', plus: '<path d="M5 12h14M12 5v14"/>', trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6M14 11v6"/>' };
      var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      s.setAttribute('class', 'icon'); s.setAttribute('width', '16'); s.setAttribute('height', '16'); s.setAttribute('viewBox', '0 0 24 24');
      s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.75'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
      s.innerHTML = paths[name]; return s;
    }

    function reconcile(cat) {
      // Drop unknown products, clamp to live stock; report what changed.
      var cart = loadCart(), notes = [], out = [];
      cart.forEach(function (l) {
        var p = productBySlug(cat, l.slug);
        if (!p) { notes.push('An item that is no longer available was removed from your cart.'); return; }
        if (p.stock <= 0) { notes.push(p.name + ' is now out of stock and was removed.'); return; }
        if (l.qty > p.stock) { notes.push('Only ' + p.stock + ' of ' + p.name + ' available; quantity reduced.'); l.qty = p.stock; }
        out.push(l);
      });
      saveCart(out); updateBadge(false);
      return { cart: out, notes: notes };
    }

    function render() {
      var cat = state.cat, cart = loadCart();
      linesEl.textContent = '';
      state.notes.forEach(function (n) { linesEl.appendChild(el('p', 'ship-msg', n)); });
      if (!cart.length) {
        var empty = el('div', 'cart-empty');
        empty.appendChild(el('p', null, 'Your cart is empty.'));
        var a = el('a', 'btn btn-burgundy', 'Explore the Pantry'); a.href = '/shop'; empty.appendChild(a);
        linesEl.appendChild(empty); sumEl.hidden = true; return;
      }
      var lines = [];
      cart.forEach(function (l) {
        var p = productBySlug(cat, l.slug); if (!p) return;
        lines.push({ unitPaise: p.unitPaise, qty: l.qty });
        var row = el('div', 'cart-line');
        var img = document.createElement('img'); img.src = p.image; img.alt = ''; img.width = 92; img.height = 100; row.appendChild(img);
        var info = el('div');
        var h = el('h2'); var link = el('a', null, p.name); link.href = p.url; h.appendChild(link); info.appendChild(h);
        info.appendChild(el('p', 'meta', p.pack + ' · ' + M.formatPaise(p.unitPaise) + ' each'));
        var ctl = el('div', 'controls');
        var q = el('div', 'qty'); q.setAttribute('role', 'group'); q.setAttribute('aria-label', 'Quantity for ' + p.name);
        var dec = el('button', 'qty-btn'); dec.type = 'button'; dec.setAttribute('aria-label', 'Decrease quantity of ' + p.name); dec.appendChild(iconSvg('minus'));
        var inp = document.createElement('input'); inp.type = 'number'; inp.min = 1; inp.max = p.stock; inp.value = l.qty; inp.setAttribute('inputmode', 'numeric'); inp.setAttribute('aria-label', 'Quantity of ' + p.name);
        var inc = el('button', 'qty-btn'); inc.type = 'button'; inc.setAttribute('aria-label', 'Increase quantity of ' + p.name); inc.appendChild(iconSvg('plus'));
        if (l.qty >= p.stock) inc.disabled = true;
        q.appendChild(dec); q.appendChild(inp); q.appendChild(inc); ctl.appendChild(q);
        var rm = el('button', 'remove-btn'); rm.type = 'button'; rm.appendChild(iconSvg('trash')); rm.appendChild(document.createTextNode(' Remove'));
        rm.setAttribute('aria-label', 'Remove ' + p.name + ' from cart'); ctl.appendChild(rm); info.appendChild(ctl);
        row.appendChild(info);
        row.appendChild(el('p', 'line-total', M.formatPaise(p.unitPaise * l.qty)));
        if (l.qty >= p.stock) row.appendChild(el('p', 'line-warn', 'Maximum available: ' + p.stock));
        linesEl.appendChild(row);
        function setQty(n) { n = Math.max(1, Math.min(p.stock, n)); var c = loadCart(); c.forEach(function (x) { if (x.slug === l.slug) x.qty = n; }); saveCart(c); updateBadge(false); state.notes = []; render(); }
        dec.addEventListener('click', function () { setQty(l.qty - 1); });
        inc.addEventListener('click', function () { setQty(l.qty + 1); });
        inp.addEventListener('change', function () { setQty(parseInt(inp.value, 10) || 1); });
        rm.addEventListener('click', function () { saveCart(loadCart().filter(function (x) { return x.slug !== l.slug; })); updateBadge(false); state.notes = []; render(); toast('Removed from cart.'); });
      });
      var t = M.calculate(lines, cat.config);
      $('[data-sum-sub]', root).textContent = M.formatPaise(t.merchandisePaise);
      $('[data-sum-ship]', root).textContent = t.shippingPaise === 0 ? 'FREE' : M.formatPaise(t.shippingPaise);
      $('[data-sum-total]', root).textContent = M.formatPaise(t.totalPaise);
      var msg = $('[data-ship-msg]', root); msg.textContent = shipMessage(t); msg.classList.toggle('ok', t.freeShipping);
      var bar = $('[data-ship-bar]', root);
      var pct = cat.config.freeThresholdPaise > 0 ? Math.min(100, Math.round(t.merchandisePaise / cat.config.freeThresholdPaise * 100)) : 100;
      bar.style.width = pct + '%'; bar.setAttribute('data-full', t.freeShipping ? 'true' : 'false');
      sumEl.hidden = false; checkoutMsg.textContent = '';
    }

    catalog().then(function (cat) { var r = reconcile(cat); state = { cat: cat, notes: r.notes }; render(); })
      .catch(function () { linesEl.textContent = ''; linesEl.appendChild(el('p', 'ship-msg', 'We could not load live prices. Please refresh the page.')); });

    checkoutBtn.addEventListener('click', function () {
      if (!state) return;
      var cart = loadCart(); if (!cart.length) return;
      checkoutBtn.disabled = true; checkoutMsg.textContent = '';
      // Open the window synchronously (popup-blocker safe), then point it at WhatsApp once the server has verified the cart.
      var win = window.open('', '_blank');
      fetch('/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (!res.ok) {
            if (win) win.close();
            checkoutMsg.textContent = res.j.error || 'Could not start your enquiry. Please try again.';
            return catalog().then(function () { catalogPromise = null; return catalog(); }).then(function (cat) { var r = reconcile(cat); state = { cat: cat, notes: r.notes }; render(); checkoutMsg.textContent = res.j.error || ''; });
          }
          if (win) { win.opener = null; win.location.href = res.j.whatsappUrl; } else { window.location.href = res.j.whatsappUrl; }
          toast('Enquiry ' + res.j.ref + ' opened in WhatsApp. Your order is not confirmed until ARSARA replies.', { ms: 7000 });
        })
        .catch(function () { if (win) win.close(); checkoutMsg.textContent = 'Network problem. Please check your connection and try again.'; })
        .then(function () { checkoutBtn.disabled = false; });
    });
  }

  /* ---------- boot ---------- */
  function ready(fn) { if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    updateBadge(false); initMenu(); initReveal(); initGallery(); initProduct(); initAddButtons(); initCalc(); initCartPage();
    window.addEventListener('storage', function (e) { if (e.key === CART_KEY) updateBadge(false); });
  });
})();

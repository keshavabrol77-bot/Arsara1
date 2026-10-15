/* ARSARA admin SPA. All data goes through /api/admin/* which enforces a server-side session on every call. */
(function () {
  'use strict';
  var M = window.ArsaraMoney;
  var app = document.getElementById('app');
  var state = { me: null, tab: 'dashboard', meta: null };

  /* ---------- tiny DOM helper ---------- */
  function h(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else if (k === 'checked') e.checked = !!v;
      else e.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(e, x); });
    else e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  function toast(msg, err) {
    var r = document.getElementById('toast-region');
    var t = h('div', { class: 'toast' + (err ? ' err' : ''), text: msg }); r.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 320); }, err ? 6000 : 3000);
  }

  /* ---------- API ---------- */
  function api(method, path, body) {
    var opts = { method: method, headers: { 'X-Arsara-Csrf': '1' }, credentials: 'same-origin' };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch('/api/admin' + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && path !== '/login') { state.me = null; showLogin(); throw new Error('Please sign in again.'); }
        if (!r.ok) throw new Error(j.error || 'Request failed');
        return j;
      });
    });
  }
  function fail(e) { toast(e.message || 'Something went wrong', true); }

  var rupees = function (p) { return M.formatPaise(p); };
  var toPaise = function (v) { v = String(v).trim(); if (v === '') return null; var n = Math.round(parseFloat(v) * 100); return isNaN(n) ? NaN : n; };
  var fromPaise = function (p) { return p == null ? '' : (p % 100 ? (p / 100).toFixed(2) : String(p / 100)); };
  var fmtDate = function (s) { var d = new Date(s); return isNaN(d) ? s : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }); };
  var label = function (s) { return String(s).replace(/_/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); }); };

  function field(lbl, input, help) { return h('div', { class: 'a-field' }, h('label', { text: lbl }), input, help ? h('small', { text: help }) : null); }
  function lblField(id, lbl, input, help) { input.id = id; return h('div', { class: 'a-field' }, h('label', { for: id, text: lbl }), input, help ? h('small', { text: help }) : null); }

  /* ---------- login ---------- */
  function showLogin(msg) {
    clear(app);
    var email = h('input', { type: 'email', id: 'le', autocomplete: 'username', required: true });
    var pw = h('input', { type: 'password', id: 'lp', autocomplete: 'current-password', required: true });
    var err = h('p', { class: 'a-err', role: 'alert', hidden: true });
    var form = h('form', { onsubmit: function (e) {
      e.preventDefault(); err.hidden = true;
      api('POST', '/login', { email: email.value, password: pw.value }).then(boot).catch(function (x) { err.textContent = x.message; err.hidden = false; });
    } },
      h('img', { src: '/img/logo-full.png', alt: 'ARSARA', width: 120, height: 118 }),
      h('h1', { text: 'Admin sign in' }),
      h('div', { class: 'a-field' }, h('label', { for: 'le', text: 'Email' }), email),
      h('div', { class: 'a-field' }, h('label', { for: 'lp', text: 'Password' }), pw),
      msg ? h('p', { class: 'a-ok', text: msg }) : null, err,
      h('button', { class: 'btn btn-burgundy', type: 'submit', text: 'Sign in' }));
    app.appendChild(h('div', { class: 'a-login' }, form)); email.focus();
  }

  /* ---------- shell ---------- */
  var TABS = [['dashboard', 'Dashboard'], ['products', 'Products'], ['orders', 'Orders'], ['settings', 'Settings'], ['homepage', 'Homepage'], ['pages', 'Policies & pages']];
  function shell() {
    clear(app);
    var main = h('main', { class: 'a-main', id: 'a-main', tabindex: '-1' });
    var nav = h('nav', { class: 'a-nav', 'aria-label': 'Admin' }, TABS.map(function (t) {
      return h('button', { type: 'button', 'aria-current': state.tab === t[0] ? 'page' : null, onclick: function () { state.tab = t[0]; shell(); } }, t[1]);
    }));
    app.appendChild(h('div', { class: 'a-shell' },
      h('aside', { class: 'a-side' },
        h('div', { class: 'a-brand' }, 'ARSARA', h('small', { text: 'Admin' })), nav,
        h('div', { class: 'a-foot' }, h('span', { text: state.me.email }),
          h('a', { href: '/', target: '_blank', rel: 'noopener', text: 'View website' }),
          h('button', { class: 'a-btn-link', type: 'button', onclick: function () { api('POST', '/logout').then(function () { showLogin('You have been signed out.'); }); }, text: 'Sign out' }))),
      main));
    var views = { dashboard: viewDashboard, products: viewProducts, orders: viewOrders, settings: viewSettings, homepage: viewHomepage, pages: viewPages };
    views[state.tab](main);
  }

  /* ---------- dashboard ---------- */
  function viewDashboard(main) {
    main.appendChild(h('h1', { text: 'Dashboard' }));
    api('GET', '/dashboard').then(function (d) {
      var cnt = function (arr, key, val) { var r = arr.filter(function (x) { return x[key] === val; })[0]; return r ? r.n : 0; };
      main.appendChild(h('div', { class: 'a-cards' },
        card(d.activeProducts, 'Active products'), card(d.availableUnits, 'Units in stock'), card(d.low.length, 'Low stock'), card(d.out.length, 'Out of stock'),
        card(cnt(d.byStatus, 'status', 'enquiry_received'), 'New enquiries'), card(cnt(d.byPay, 'payment_status', 'verified'), 'Verified payments')));
      if (d.launch.length) main.appendChild(h('section', { class: 'a-panel warn' }, h('h2', { text: 'Before launch' }), h('ul', null, d.launch.map(function (x) { return h('li', { text: x }); }))));
      if (d.low.length || d.out.length) main.appendChild(h('section', { class: 'a-panel' }, h('h2', { text: 'Stock alerts' }), h('ul', null,
        d.low.map(function (p) { return h('li', { text: p.name + ': only ' + p.stock + ' left (alert at ' + p.threshold + ')' }); }),
        d.out.map(function (p) { return h('li', { text: p.name + ': out of stock' }); }))));
      main.appendChild(h('h2', { text: 'Recent order enquiries' }));
      main.appendChild(enquiryTable(d.recent));
      main.appendChild(h('p', { class: 'small muted', text: 'An enquiry is created when a customer presses the WhatsApp button. It is not an order, and it is never marked paid automatically.' }));
    }).catch(fail);
  }
  function card(n, l) { return h('div', { class: 'a-card' }, h('b', { text: String(n) }), h('span', { text: l })); }
  function enquiryTable(rows) {
    if (!rows.length) return h('p', { class: 'muted', text: 'No enquiries yet.' });
    return h('div', { class: 'a-table-wrap' }, h('table', { class: 'a-table' },
      h('thead', null, h('tr', null, ['Reference', 'When', 'Items', 'Total', 'Status', 'Payment'].map(function (t) { return h('th', { scope: 'col', text: t }); }))),
      h('tbody', null, rows.map(function (r) {
        return h('tr', null, h('td', { text: r.ref }), h('td', { text: fmtDate(r.created_at) }),
          h('td', { text: r.items.map(function (i) { return i.qty + ' × ' + i.name; }).join(', ') }), h('td', { text: rupees(r.total_paise) }),
          h('td', null, h('span', { class: 'pill', text: label(r.status) })),
          h('td', null, h('span', { class: 'pill ' + (r.payment_status === 'verified' ? 'ok' : 'warn'), text: label(r.payment_status) })));
      }))));
  }

  /* ---------- products ---------- */
  function viewProducts(main) {
    main.appendChild(h('h1', { text: 'Products' }));
    var list = h('div'); main.appendChild(list);
    function load() {
      api('GET', '/products').then(function (d) {
        clear(list);
        list.appendChild(h('div', { class: 'a-actions', style: 'margin-bottom:1rem' }, h('button', { class: 'btn btn-burgundy', type: 'button', onclick: function () { editProduct(main, null); }, text: 'Add product' })));
        list.appendChild(h('div', { class: 'a-table-wrap' }, h('table', { class: 'a-table' },
          h('thead', null, h('tr', null, ['Product', 'Price', 'Stock', 'Status', ''].map(function (t) { return h('th', { scope: 'col', text: t }); }))),
          h('tbody', null, d.products.map(function (p) {
            var low = p.stock <= 0 ? 'bad' : (p.stock <= p.low_stock_threshold ? 'warn' : 'ok');
            return h('tr', null,
              h('td', null, h('strong', { text: p.name }), h('br'), h('small', { class: 'muted', text: p.pack_size + ' · ' + p.sku })),
              h('td', { text: rupees(p.sale_price_paise != null ? p.sale_price_paise : p.price_paise) }),
              h('td', null, h('span', { class: 'pill ' + low, text: String(p.stock) })),
              h('td', null, h('span', { class: 'pill' + (p.status === 'active' ? ' ok' : ''), text: p.status })),
              h('td', null, h('button', { class: 'btn a-mini', type: 'button', onclick: function () { editProduct(main, p.id); }, text: 'Edit' })));
          })))));
      }).catch(fail);
    }
    load();
  }

  function editProduct(main, id) {
    clear(main);
    main.appendChild(h('h1', { text: id ? 'Edit product' : 'New product' }));
    var holder = h('div'); main.appendChild(holder);
    (id ? api('GET', '/products/' + id).then(function (d) { return d.product; }) : Promise.resolve({
      name: '', slug: '', short_description: '', description: '', price_paise: 0, sale_price_paise: null, sku: '', pack_size: '', weight_g: 0, stock: 0, low_stock_threshold: 5,
      category: '', origin: { place: '', note: '' }, specs: [], images: [], storage_guidance: '', seo_title: '', seo_description: '', status: 'draft'
    })).then(function (p) { renderProductForm(main, holder, p, id); }).catch(fail);
  }

  function renderProductForm(main, holder, p, id) {
    var F = {};
    var T = function (key, lbl, opts) { opts = opts || {}; F[key] = h('input', { type: opts.type || 'text', value: opts.val != null ? opts.val : (p[key] || ''), step: opts.step, min: opts.min }); return lblField('f-' + key, lbl, F[key], opts.help); };
    var A = function (key, lbl, help, tall) { F[key] = h('textarea', { value: p[key] || '' }); return lblField('f-' + key, lbl, F[key], help); };
    F.status = h('select', null, ['active', 'draft', 'archived'].map(function (s) { return h('option', { value: s, text: label(s) + (s === 'draft' ? ' (hidden)' : s === 'archived' ? ' (hidden)' : ' (visible)'), selected: p.status === s }); }));
    var specs = (p.specs || []).map(function (s) { return { label: s.label, value: s.value }; });
    var images = (p.images || []).map(function (s) { return { src: s.src, alt: s.alt }; });
    var specBox = h('div', { class: 'a-rows' }), imgBox = h('div', { class: 'a-img-list' });
    function drawSpecs() {
      clear(specBox);
      specs.forEach(function (s, i) {
        specBox.appendChild(h('div', { class: 'a-row' },
          h('input', { type: 'text', value: s.label, 'aria-label': 'Specification name', placeholder: 'Name', oninput: function (e) { s.label = e.target.value; } }),
          h('input', { type: 'text', value: s.value, 'aria-label': 'Specification value', placeholder: 'Value', oninput: function (e) { s.value = e.target.value; } }),
          h('button', { class: 'btn a-mini', type: 'button', onclick: function () { specs.splice(i, 1); drawSpecs(); }, text: 'Remove' })));
      });
      specBox.appendChild(h('div', null, h('button', { class: 'btn a-mini', type: 'button', onclick: function () { specs.push({ label: '', value: '' }); drawSpecs(); }, text: 'Add specification' })));
    }
    function drawImgs() {
      clear(imgBox);
      images.forEach(function (im, i) {
        imgBox.appendChild(h('div', { class: 'a-img' }, h('img', { src: im.src, alt: '' }),
          h('input', { type: 'text', value: im.alt, 'aria-label': 'Image description (alt text)', placeholder: 'Describe the image', oninput: function (e) { im.alt = e.target.value; } }),
          h('div', { class: 'a-actions' },
            i > 0 ? h('button', { class: 'btn a-mini', type: 'button', onclick: function () { images.splice(i - 1, 0, images.splice(i, 1)[0]); drawImgs(); }, text: 'Move up', 'aria-label': 'Move image earlier' }) : null,
            h('button', { class: 'btn a-mini', type: 'button', onclick: function () { images.splice(i, 1); drawImgs(); }, text: 'Remove' }))));
      });
    }
    var file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', id: 'f-upload', onchange: function () {
      var f = file.files[0]; if (!f) return;
      if (f.size > 3 * 1024 * 1024) { toast('Image is too large (max 3 MB).', true); file.value = ''; return; }
      var rd = new FileReader();
      rd.onload = function () { api('POST', '/upload', { data: rd.result }).then(function (r) { images.push({ src: r.path, alt: '' }); drawImgs(); toast('Image uploaded. Add a description before saving.'); }).catch(fail); file.value = ''; };
      rd.readAsDataURL(f);
    } });
    drawSpecs(); drawImgs();
    var err = h('p', { class: 'a-err', role: 'alert', hidden: true });
    F.price = h('input', { type: 'number', step: '0.01', min: '0', value: fromPaise(p.price_paise) });
    F.sale = h('input', { type: 'number', step: '0.01', min: '0', value: fromPaise(p.sale_price_paise) });
    F.place = h('input', { type: 'text', value: (p.origin && p.origin.place) || '' });
    F.onote = h('textarea', { value: (p.origin && p.origin.note) || '' });
    F.stock = h('input', { type: 'number', min: '0', step: '1', value: p.stock || 0, disabled: !!id });

    var form = h('form', { class: 'a-form', onsubmit: function (e) {
      e.preventDefault(); err.hidden = true;
      var price = toPaise(F.price.value), sale = toPaise(F.sale.value);
      if (price === null || isNaN(price) || (sale !== null && isNaN(sale))) { err.textContent = 'Enter valid prices.'; err.hidden = false; return; }
      var body = {
        name: F.name.value, slug: F.slug.value, short_description: F.short_description.value, description: F.description.value,
        price_paise: price, sale_price_paise: sale, sku: F.sku.value, pack_size: F.pack_size.value, weight_g: Number(F.weight_g.value || 0),
        low_stock_threshold: Number(F.low_stock_threshold.value || 0), category: F.category.value, storage_guidance: F.storage_guidance.value,
        seo_title: F.seo_title.value, seo_description: F.seo_description.value, status: F.status.value,
        origin: { place: F.place.value, note: F.onote.value }, specs: specs, images: images
      };
      var req = id ? api('PUT', '/products/' + id, body) : api('POST', '/products', Object.assign(body, { stock: Number(F.stock.value || 0) }));
      req.then(function () { toast('Product saved.'); state.tab = 'products'; shell(); }).catch(function (x) { err.textContent = x.message; err.hidden = false; err.scrollIntoView({ block: 'center' }); });
    } },
      h('fieldset', { class: 'a-fieldset' }, h('legend', { text: 'Basics' }),
        h('div', { class: 'a-grid' }, T('name', 'Name'), T('slug', 'URL slug', { help: 'Lowercase letters, numbers, hyphens. Appears in /product/…' }), T('sku', 'SKU'), T('category', 'Category')),
        h('div', { class: 'a-grid' }, T('pack_size', 'Pack size', { help: 'e.g. 500 g' }), T('weight_g', 'Weight (grams)', { type: 'number', min: '0' }), lblField('f-status', 'Status', F.status, 'Only Active products appear on the website.')),
        A('short_description', 'Short description', 'One or two sentences, shown in listings.'), A('description', 'Description', 'Separate paragraphs with a blank line.')),
      h('fieldset', { class: 'a-fieldset' }, h('legend', { text: 'Price and stock' }),
        h('div', { class: 'a-grid' }, lblField('f-price', 'Price (₹)', F.price), lblField('f-sale', 'Sale price (₹, optional)', F.sale, 'Leave empty for no sale. Must be lower than the price.'),
          lblField('f-stock', id ? 'Stock (change below)' : 'Opening stock', F.stock, id ? 'Use the stock adjustment box so every change is logged.' : null), T('low_stock_threshold', 'Low-stock alert at', { type: 'number', min: '0' }))),
      h('fieldset', { class: 'a-fieldset' }, h('legend', { text: 'Origin, storage and specifications' }),
        lblField('f-place', 'Origin place', F.place, 'Only enter an origin you can verify.'), lblField('f-onote', 'Origin note', F.onote, 'Internal reminder: e.g. GI or certification details to add once verified. Not shown on the product page.'),
        A('storage_guidance', 'Storage guidance'), h('div', { class: 'a-field' }, h('span', { class: 'lbl', text: 'Specifications' }), specBox)),
      h('fieldset', { class: 'a-fieldset' }, h('legend', { text: 'Images' }), imgBox,
        h('div', { class: 'a-field' }, h('label', { for: 'f-upload', text: 'Upload image' }), file, h('small', { text: 'JPEG, PNG or WebP, up to 3 MB. The first image is the main product image.' }))),
      h('fieldset', { class: 'a-fieldset' }, h('legend', { text: 'SEO' }),
        T('seo_title', 'SEO title'), A('seo_description', 'SEO description')),
      err,
      h('div', { class: 'a-actions' }, h('button', { class: 'btn btn-burgundy', type: 'submit', text: 'Save product' }),
        h('button', { class: 'btn', type: 'button', onclick: function () { state.tab = 'products'; shell(); }, text: 'Cancel' })));
    holder.appendChild(form);

    if (id) {
      var delta = h('input', { type: 'number', step: '1', id: 'st-delta', placeholder: 'e.g. 10 or -2' }), setTo = h('input', { type: 'number', min: '0', step: '1', id: 'st-set', placeholder: 'Exact count' }), reason = h('input', { type: 'text', id: 'st-reason', placeholder: 'e.g. New batch received / stock count' });
      var logBox = h('div');
      function loadLog() { api('GET', '/products/' + id + '/log').then(function (d) {
        clear(logBox);
        logBox.appendChild(h('div', { class: 'a-table-wrap' }, h('table', { class: 'a-table' }, h('thead', null, h('tr', null, ['When', 'Change', 'Stock after', 'Reason', 'By'].map(function (t) { return h('th', { scope: 'col', text: t }); }))),
          h('tbody', null, d.log.map(function (l) { return h('tr', null, h('td', { text: fmtDate(l.created_at) }), h('td', { text: (l.delta > 0 ? '+' : '') + l.delta }), h('td', { text: String(l.stock_after) }), h('td', { text: l.reason }), h('td', { text: l.admin_email })); })))));
      }).catch(fail); }
      var stErr = h('p', { class: 'a-err', role: 'alert', hidden: true });
      holder.appendChild(h('section', { class: 'a-panel', style: 'margin-top:1.6rem' }, h('h2', { text: 'Stock adjustment' }),
        h('p', { class: 'small muted', text: 'Current stock: ' + p.stock + '. Stock never goes below zero. Every change is recorded below.' }),
        h('div', { class: 'a-form' }, h('div', { class: 'a-grid' }, field('Add / remove units', delta), field('…or set exact count', setTo), field('Reason (required)', reason)), stErr,
          h('div', { class: 'a-actions' }, h('button', { class: 'btn btn-ink', type: 'button', text: 'Apply stock change', onclick: function () {
            stErr.hidden = true;
            var body = { reason: reason.value }; if (setTo.value !== '') body.set = Number(setTo.value); else body.delta = Number(delta.value);
            api('POST', '/products/' + id + '/stock', body).then(function () { toast('Stock updated.'); editProduct(main, id); }).catch(function (x) { stErr.textContent = x.message; stErr.hidden = false; });
          } }))),
        h('h2', { text: 'Stock history', style: 'margin-top:1.4rem' }), logBox));
      loadLog();
    }
  }

  /* ---------- orders ---------- */
  function viewOrders(main) {
    main.appendChild(h('h1', { text: 'Order enquiries' }));
    main.appendChild(h('p', { class: 'small muted', text: 'Records are created when a customer presses the WhatsApp button. Nothing is paid or accepted until you verify it here. Stock is only deducted when you choose to, for a payment-confirmed order.' }));
    var box = h('div'); main.appendChild(box);
    api('GET', '/enquiries').then(function (d) {
      if (!d.enquiries.length) { box.appendChild(h('p', { class: 'muted', text: 'No enquiries yet.' })); return; }
      box.appendChild(h('div', { class: 'a-table-wrap' }, h('table', { class: 'a-table' },
        h('thead', null, h('tr', null, ['Reference', 'When', 'Items', 'Total', 'Status', 'Payment', ''].map(function (t) { return h('th', { scope: 'col', text: t }); }))),
        h('tbody', null, d.enquiries.map(function (r) {
          return h('tr', null, h('td', { text: r.ref }), h('td', { text: fmtDate(r.created_at) }), h('td', { text: r.items.map(function (i) { return i.qty + ' × ' + i.name; }).join(', ') }), h('td', { text: rupees(r.total_paise) }),
            h('td', null, h('span', { class: 'pill', text: label(r.status) })), h('td', null, h('span', { class: 'pill ' + (r.payment_status === 'verified' ? 'ok' : 'warn'), text: label(r.payment_status) })),
            h('td', null, h('button', { class: 'btn a-mini', type: 'button', text: 'Manage', onclick: function () { editEnquiry(main, r); } })));
        })))));
    }).catch(fail);
  }
  function editEnquiry(main, r) {
    clear(main);
    main.appendChild(h('h1', { text: 'Enquiry ' + r.ref }));
    var st = h('select', { id: 'e-status' }, state.meta.statuses.map(function (s) { return h('option', { value: s, text: label(s), selected: r.status === s }); }));
    var pay = h('select', { id: 'e-pay' }, state.meta.paymentStatuses.map(function (s) { return h('option', { value: s, text: label(s), selected: r.payment_status === s }); }));
    var tx = function (id, v, tag) { return h(tag || 'input', { type: tag ? null : 'text', id: id, value: v || '' }); };
    var payNote = tx('e-pn', r.payment_note), name = tx('e-n', r.customer_name), phone = tx('e-p', r.customer_phone), addr = tx('e-a', r.customer_address, 'textarea'), track = tx('e-t', r.tracking), refund = tx('e-r', r.refund_note), notes = tx('e-no', r.notes, 'textarea');
    var deduct = h('input', { type: 'checkbox', id: 'e-d' }), restock = h('input', { type: 'checkbox', id: 'e-rs' });
    var err = h('p', { class: 'a-err', role: 'alert', hidden: true });
    main.appendChild(h('section', { class: 'a-panel' }, h('h2', { text: 'Enquiry details' }),
      h('p', { text: r.items.map(function (i) { return i.qty + ' × ' + i.name + ' (' + i.pack + ') at ' + rupees(i.unitPaise); }).join('; ') }),
      h('p', { text: 'Subtotal ' + rupees(r.subtotal_paise) + ' · Shipping ' + (r.shipping_paise ? rupees(r.shipping_paise) : 'FREE') + ' · Total ' + rupees(r.total_paise) }),
      h('p', { class: 'small muted', text: 'Created ' + fmtDate(r.created_at) + '. Stock ' + (r.stock_deducted ? 'has been deducted for this order.' : 'has not been deducted.') })));
    main.appendChild(h('form', { class: 'a-form', onsubmit: function (e) {
      e.preventDefault(); err.hidden = true;
      api('PUT', '/enquiries/' + r.id, { status: st.value, payment_status: pay.value, payment_note: payNote.value, customer_name: name.value, customer_phone: phone.value, customer_address: addr.value, tracking: track.value, refund_note: refund.value, notes: notes.value, deduct_stock: deduct.checked, restock: restock.checked })
        .then(function () { toast('Saved.'); state.tab = 'orders'; shell(); }).catch(function (x) { err.textContent = x.message; err.hidden = false; });
    } },
      h('fieldset', { class: 'a-fieldset' }, h('legend', { text: 'Status' }), h('div', { class: 'a-grid' }, lblField('e-status', 'Order status', st), lblField('e-pay', 'Payment', pay, 'Only mark verified after you have confirmed the money in your account.'), lblField('e-pn', 'Payment verification note', payNote, 'Required to mark verified: UPI / bank reference.'))),
      h('fieldset', { class: 'a-fieldset' }, h('legend', { text: 'Fulfilment details (from your WhatsApp chat)' }), h('div', { class: 'a-grid' }, lblField('e-n', 'Customer name', name), lblField('e-p', 'Phone', phone), lblField('e-t', 'Tracking', track)), lblField('e-a', 'Delivery address', addr), lblField('e-r', 'Cancellation / refund record', refund), lblField('e-no', 'Internal notes', notes)),
      h('fieldset', { class: 'a-fieldset' }, h('legend', { text: 'Stock' }),
        r.stock_deducted ? h('label', { class: 'a-check' }, restock, 'Return the units to stock (e.g. cancelled before dispatch)') : h('label', { class: 'a-check' }, deduct, 'Deduct these units from stock now (only for payment-confirmed orders)')),
      err, h('div', { class: 'a-actions' }, h('button', { class: 'btn btn-burgundy', type: 'submit', text: 'Save' }), h('button', { class: 'btn', type: 'button', text: 'Back', onclick: function () { state.tab = 'orders'; shell(); } }))));
  }

  /* ---------- settings ---------- */
  function viewSettings(main) {
    main.appendChild(h('h1', { text: 'Website settings' }));
    api('GET', '/settings').then(function (d) {
      var s = d.settings, F = {};
      var T = function (k, lbl, help, type) { F[k] = h('input', { type: type || 'text', value: s[k] == null ? '' : s[k] }); return lblField('s-' + k, lbl, F[k], help); };
      F.ship = h('input', { type: 'number', step: '0.01', min: '0', value: fromPaise(s.shipping_fee_paise) });
      F.free = h('input', { type: 'number', step: '0.01', min: '0', value: fromPaise(s.free_shipping_threshold_paise) });
      var err = h('p', { class: 'a-err', role: 'alert', hidden: true });
      var logoIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', id: 's-logo', onchange: function () {
        var f = logoIn.files[0]; if (!f) return; var rd = new FileReader();
        rd.onload = function () { api('POST', '/upload', { data: rd.result }).then(function (r) { F.logo_path.value = r.path; toast('Uploaded. Save settings to use it as the logo.'); }).catch(fail); }; rd.readAsDataURL(f);
      } });
      F.logo_path = h('input', { type: 'text', value: s.logo_path });
      main.appendChild(h('form', { class: 'a-form', onsubmit: function (e) {
        e.preventDefault(); err.hidden = true;
        var ship = toPaise(F.ship.value), free = toPaise(F.free.value);
        if (ship === null || isNaN(ship) || free === null || isNaN(free)) { err.textContent = 'Enter valid shipping amounts.'; err.hidden = false; return; }
        var body = { shipping_fee_paise: ship, free_shipping_threshold_paise: free, logo_path: F.logo_path.value };
        ['business_legal_name', 'whatsapp', 'whatsapp_display', 'email', 'address', 'fssai_number', 'grievance_officer', 'instagram_handle', 'instagram_url', 'x_handle', 'x_url', 'site_url', 'report_window_hours', 'refund_initiation_days'].forEach(function (k) { body[k] = F[k].value; });
        body.report_window_hours = Number(body.report_window_hours);
        api('PUT', '/settings', body).then(function () { toast('Settings saved. Policies update automatically.'); }).catch(function (x) { err.textContent = x.message; err.hidden = false; });
      } },
        h('fieldset', { class: 'a-fieldset' }, h('legend', { text: 'Shipping' }),
          h('div', { class: 'a-grid' }, lblField('s-ship', 'Shipping charge (₹)', F.ship, 'Charged when the subtotal is below the threshold.'), lblField('s-free', 'Free shipping from (₹)', F.free, 'Exactly this amount qualifies for free shipping.')),
          h('p', { class: 'small muted', text: 'The storefront, cart, WhatsApp message, server checks and the Shipping policy all read these two values.' })),
        h('fieldset', { class: 'a-fieldset' }, h('legend', { text: 'Contact' }),
          h('div', { class: 'a-grid' }, T('whatsapp', 'WhatsApp number (digits with country code)', 'e.g. 919103409968. Used for wa.me links.'), T('whatsapp_display', 'WhatsApp number (as displayed)'), T('email', 'Email', null, 'email')),
          T('address', 'Business address', 'Leave empty until you have a verified address to publish.'),
          h('div', { class: 'a-grid' }, T('instagram_handle', 'Instagram handle'), T('instagram_url', 'Instagram URL', 'https://…', 'url'), T('x_handle', 'X handle'), T('x_url', 'X URL', 'https://…', 'url'))),
        h('fieldset', { class: 'a-fieldset' }, h('legend', { text: 'Business and legal details' }),
          h('div', { class: 'a-grid' }, T('business_legal_name', 'Registered business name', 'Leave empty if not registered; the policies then say ARSARA.'), T('fssai_number', 'FSSAI number', 'Shown in the footer and Terms when set.')),
          T('grievance_officer', 'Grievance contact', 'Name and details of a grievance officer, if required for your business.'),
          h('div', { class: 'a-grid' }, T('report_window_hours', 'Preferred problem-reporting window (hours)', null, 'number'), T('refund_initiation_days', 'Refund initiation target (business days)', 'e.g. 5–7'))),
        h('fieldset', { class: 'a-fieldset' }, h('legend', { text: 'Site' }),
          T('site_url', 'Public website address', 'e.g. https://www.arsara.in. Used for canonical links, sitemap and social previews.'),
          lblField('s-logo-path', 'Logo path', F.logo_path, 'The original ARSARA logo is the default. Replace only with an approved version.'), h('div', { class: 'a-field' }, h('label', { for: 's-logo', text: 'Upload a replacement logo' }), logoIn)),
        err, h('div', { class: 'a-actions' }, h('button', { class: 'btn btn-burgundy', type: 'submit', text: 'Save settings' }))));
      var cur = h('input', { type: 'password', autocomplete: 'current-password' }), nxt = h('input', { type: 'password', autocomplete: 'new-password' }), perr = h('p', { class: 'a-err', role: 'alert', hidden: true });
      main.appendChild(h('form', { class: 'a-form', style: 'margin-top:2rem', onsubmit: function (e) {
        e.preventDefault(); perr.hidden = true;
        api('POST', '/password', { current: cur.value, next: nxt.value }).then(function () { cur.value = ''; nxt.value = ''; toast('Password changed. Other sessions were signed out.'); }).catch(function (x) { perr.textContent = x.message; perr.hidden = false; });
      } }, h('fieldset', { class: 'a-fieldset' }, h('legend', { text: 'Change admin password' }),
        h('div', { class: 'a-grid' }, lblField('pw-cur', 'Current password', cur), lblField('pw-new', 'New password (12+ characters)', nxt)), perr,
        h('div', { class: 'a-actions' }, h('button', { class: 'btn btn-ink', type: 'submit', text: 'Change password' })))));
    }).catch(fail);
  }

  /* ---------- homepage content ---------- */
  function viewHomepage(main) {
    main.appendChild(h('h1', { text: 'Homepage' }));
    main.appendChild(h('p', { class: 'small muted', text: 'Edit the story sections, change their order, and show or hide them. The Shop link is always available in the header.' }));
    api('GET', '/settings').then(function (d) {
      var home = d.settings.home.map(function (x) { return JSON.parse(JSON.stringify(x)); });
      var recipe = JSON.parse(JSON.stringify(d.settings.recipe));
      var box = h('div'), err = h('p', { class: 'a-err', role: 'alert', hidden: true });
      var NAMES = { hero: 'A · Entrance', origin: 'B · Origin', bean: 'C · The bean', product: 'D · Product', kitchen: 'E · Kitchen', philosophy: 'F · Philosophy', final: 'G · Final invitation' };
      var TEXTK = function (k) { return !(k === 'id' || k === 'visible' || k === 'items'); };
      function draw() {
        clear(box);
        home.forEach(function (sec, i) {
          var fs = h('fieldset', { class: 'a-fieldset', style: 'margin-bottom:1rem' }, h('legend', { text: NAMES[sec.id] || sec.id }));
          fs.appendChild(h('div', { class: 'a-actions' },
            h('label', { class: 'a-check' }, h('input', { type: 'checkbox', checked: sec.visible, onchange: function (e) { sec.visible = e.target.checked; } }), 'Visible'),
            h('button', { class: 'btn a-mini', type: 'button', disabled: i === 0, text: 'Move up', 'aria-label': 'Move ' + sec.id + ' section up', onclick: function () { home.splice(i - 1, 0, home.splice(i, 1)[0]); draw(); } }),
            h('button', { class: 'btn a-mini', type: 'button', disabled: i === home.length - 1, text: 'Move down', 'aria-label': 'Move ' + sec.id + ' section down', onclick: function () { home.splice(i + 1, 0, home.splice(i, 1)[0]); draw(); } })));
          Object.keys(sec).filter(TEXTK).forEach(function (k) {
            var long = k === 'body';
            var inp = h(long ? 'textarea' : 'input', { type: long ? null : 'text', value: sec[k], oninput: function (e) { sec[k] = e.target.value; } });
            var id = 'h-' + sec.id + '-' + k; fs.appendChild(lblField(id, label(k), inp));
          });
          if (sec.items) sec.items.forEach(function (it, j) {
            fs.appendChild(h('div', { class: 'a-grid' }, lblField('h-' + sec.id + '-t' + j, 'Principle ' + (j + 1) + ' title', h('input', { type: 'text', value: it.title, oninput: function (e) { it.title = e.target.value; } })),
              lblField('h-' + sec.id + '-x' + j, 'Principle ' + (j + 1) + ' text', h('textarea', { value: it.text, oninput: function (e) { it.text = e.target.value; } }))));
          });
          box.appendChild(fs);
        });
        var lines = function (arr) { return arr.join('\n'); };
        var ri = h('input', { type: 'text', value: recipe.title, oninput: function (e) { recipe.title = e.target.value; } });
        box.appendChild(h('fieldset', { class: 'a-fieldset' }, h('legend', { text: 'Recipe (Himalayan kitchen)' }),
          lblField('r-title', 'Title', ri),
          lblField('r-intro', 'Intro', h('textarea', { value: recipe.intro, oninput: function (e) { recipe.intro = e.target.value; } })),
          h('div', { class: 'a-grid' }, ['serves', 'soak', 'cook'].map(function (k) { return lblField('r-' + k, label(k), h('input', { type: 'text', value: recipe[k], oninput: function (e) { recipe[k] = e.target.value; } })); })),
          lblField('r-ing', 'Ingredients (one per line)', h('textarea', { value: lines(recipe.ingredients), oninput: function (e) { recipe.ingredients = e.target.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); } }), 'Only include tested quantities. Do not add nutrition or health claims.'),
          lblField('r-steps', 'Method steps (one per line)', h('textarea', { value: lines(recipe.steps), oninput: function (e) { recipe.steps = e.target.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); } })),
          lblField('r-note', 'Note', h('input', { type: 'text', value: recipe.note, oninput: function (e) { recipe.note = e.target.value; } }))));
      }
      draw();
      main.appendChild(h('form', { class: 'a-form', onsubmit: function (e) { e.preventDefault(); err.hidden = true;
        api('PUT', '/settings', { home: home, recipe: recipe }).then(function () { toast('Homepage saved.'); }).catch(function (x) { err.textContent = x.message; err.hidden = false; }); } }, box, err,
        h('div', { class: 'a-actions' }, h('button', { class: 'btn btn-burgundy', type: 'submit', text: 'Save homepage' }), h('a', { class: 'btn', href: '/', target: '_blank', rel: 'noopener', text: 'Preview' }))));
    }).catch(fail);
  }

  /* ---------- pages ---------- */
  var PAGE_PATH = { about: '/story', terms: '/terms', privacy: '/privacy', shipping: '/shipping-policy', returns: '/returns', cancellation: '/cancellation', grievance: '/grievance' };
  function viewPages(main) {
    main.appendChild(h('h1', { text: 'Policies & pages' }));
    main.appendChild(h('p', { class: 'small muted', text: 'Edit using simple Markdown: ## headings, - bullet lists, **bold**, [link](/path). Placeholders such as {{email}}, {{whatsapp}}, {{shipping_fee}}, {{free_threshold}}, {{report_hours}} and {{refund_days}} are filled automatically from your settings, so the policies always match your shipping rules. Saving updates the “last updated” date.' }));
    var holder = h('div'); main.appendChild(holder);
    api('GET', '/pages').then(function (d) {
      var sel = h('select', { id: 'pg-sel' }, d.pages.map(function (p) { return h('option', { value: p.slug, text: p.title }); }));
      var title = h('input', { type: 'text', id: 'pg-title' }), body = h('textarea', { class: 'tall', id: 'pg-body' }), err = h('p', { class: 'a-err', role: 'alert', hidden: true });
      var link = h('a', { class: 'btn', target: '_blank', rel: 'noopener', text: 'View page' });
      function fill() { var p = d.pages.filter(function (x) { return x.slug === sel.value; })[0]; title.value = p.title; body.value = p.body; link.href = PAGE_PATH[p.slug]; }
      sel.addEventListener('change', fill); fill();
      holder.appendChild(h('form', { class: 'a-form', onsubmit: function (e) { e.preventDefault(); err.hidden = true;
        api('PUT', '/pages/' + sel.value, { title: title.value, body: body.value }).then(function (r) { var p = d.pages.filter(function (x) { return x.slug === sel.value; })[0]; p.title = r.page.title; p.body = r.page.body; toast('Page saved.'); }).catch(function (x) { err.textContent = x.message; err.hidden = false; }); } },
        lblField('pg-sel', 'Page', sel), lblField('pg-title', 'Title', title), lblField('pg-body', 'Content', body), err,
        h('div', { class: 'a-actions' }, h('button', { class: 'btn btn-burgundy', type: 'submit', text: 'Save page' }), link)));
    }).catch(fail);
  }

  /* ---------- boot ---------- */
  function boot() {
    api('GET', '/me').then(function (me) { state.me = me; state.meta = me; shell(); }).catch(function () { showLogin(); });
  }
  boot();
})();

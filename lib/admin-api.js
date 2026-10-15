'use strict';
// Protected admin API. Every route except login requires a valid server-side session.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./db');
const { db, now } = store;
const defaults = require('./defaults');

const COOKIE = 'arsara_admin';
const SESSION_MS = 12 * 60 * 60 * 1000;
const STATUSES = ['enquiry_received', 'awaiting_payment', 'payment_confirmed', 'processing', 'dispatched', 'delivered', 'cancelled', 'refund_initiated', 'refunded'];
const PAID_STATES = ['payment_confirmed', 'processing', 'dispatched', 'delivered', 'refund_initiated', 'refunded'];
const PAYMENT_STATUSES = ['unverified', 'verified'];
const PAGE_SLUGS = ['about', 'terms', 'privacy', 'shipping', 'returns', 'cancellation', 'grievance'];

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const str = (v, max, name, { required = false } = {}) => {
  if (v == null) v = '';
  if (typeof v !== 'string') throw bad(`${name} must be text`);
  v = v.trim();
  if (required && !v) throw bad(`${name} is required`);
  if (v.length > max) throw bad(`${name} is too long (max ${max} characters)`);
  return v;
};
const int = (v, min, max, name) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${name} must be a whole number between ${min} and ${max}`);
  return n;
};
const safeAssetPath = (v, name) => {
  v = str(v, 300, name);
  if (!/^\/(img|uploads)\/[A-Za-z0-9._-]+$/.test(v)) throw bad(`${name} must be an image from this site`);
  return v;
};
const safeHref = (v, name) => {
  v = str(v, 300, name);
  if (v && !/^(\/[A-Za-z0-9\-._~/#?=&%]*|https:\/\/[^\s]+)$/.test(v)) throw bad(`${name} must start with / or https://`);
  return v;
};

/* ---------------------------------------------------------------- sessions */
function currentAdmin(req, h) {
  const tok = h.parseCookies(req)[COOKIE];
  if (!tok) return null;
  const row = db.prepare('SELECT s.token_hash, s.expires_at, a.id, a.email FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ?').get(sha(tok));
  if (!row) return null;
  if (row.expires_at < Date.now()) { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(row.token_hash); return null; }
  return row;
}
function cookieHeader(req, h, value, maxAgeSec) {
  const secure = h.isHttps(req) || h.PROD ? '; Secure' : '';
  return `${COOKIE}=${encodeURIComponent(value)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAgeSec}${secure}`;
}
const DUMMY_HASH = store.hashPassword('not-a-real-password-for-timing');

/* ---------------------------------------------------------------- validators */
function validateProduct(b, existing) {
  const out = {};
  out.name = str(b.name, 160, 'Name', { required: true });
  out.slug = str(b.slug || '', 80, 'URL slug', { required: true }).toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(out.slug)) throw bad('URL slug may only contain lowercase letters, numbers and hyphens');
  const dup = db.prepare('SELECT id FROM products WHERE slug = ?').get(out.slug);
  if (dup && (!existing || dup.id !== existing.id)) throw bad('That URL slug is already used by another product');
  out.short_description = str(b.short_description, 300, 'Short description');
  out.description = str(b.description, 4000, 'Description');
  out.price_paise = int(b.price_paise, 0, 100000000, 'Price');
  out.sale_price_paise = (b.sale_price_paise === null || b.sale_price_paise === '' || b.sale_price_paise === undefined) ? null : int(b.sale_price_paise, 0, 100000000, 'Sale price');
  if (out.sale_price_paise !== null && out.sale_price_paise >= out.price_paise) throw bad('Sale price must be lower than the regular price');
  out.sku = str(b.sku, 60, 'SKU');
  out.pack_size = str(b.pack_size, 40, 'Pack size');
  out.weight_g = int(b.weight_g || 0, 0, 1000000, 'Weight (g)');
  out.low_stock_threshold = int(b.low_stock_threshold ?? 5, 0, 100000, 'Low-stock threshold');
  out.category = str(b.category, 80, 'Category');
  out.storage_guidance = str(b.storage_guidance, 600, 'Storage guidance');
  out.seo_title = str(b.seo_title, 120, 'SEO title');
  out.seo_description = str(b.seo_description, 300, 'SEO description');
  if (!['active', 'draft', 'archived'].includes(b.status)) throw bad('Status must be active, draft or archived');
  out.status = b.status;
  const o = b.origin || {};
  out.origin = { place: str(o.place, 160, 'Origin place'), note: str(o.note, 500, 'Origin note') };
  if (!Array.isArray(b.specs) || b.specs.length > 20) throw bad('Specifications must be a list (max 20)');
  out.specs = b.specs.map((x) => ({ label: str(x && x.label, 60, 'Spec label', { required: true }), value: str(x && x.value, 200, 'Spec value', { required: true }) }));
  if (!Array.isArray(b.images) || b.images.length > 12) throw bad('Images must be a list (max 12)');
  out.images = b.images.map((x) => ({ src: safeAssetPath(x && x.src, 'Image'), alt: str(x && x.alt, 200, 'Image description', { required: true }) }));
  if (out.status === 'active' && !out.images.length) throw bad('Add at least one image before publishing');
  return out;
}

function validateSettings(b) {
  const cur = store.getSettings();
  const out = {};
  const S = (k, max, label, opts) => { if (k in b) out[k] = str(b[k], max, label, opts); };
  S('site_name', 60, 'Site name', { required: true });
  S('tagline', 120, 'Tagline');
  S('business_legal_name', 160, 'Legal business name');
  S('whatsapp_display', 30, 'WhatsApp display number');
  S('address', 400, 'Business address');
  S('fssai_number', 40, 'FSSAI number');
  S('grievance_officer', 300, 'Grievance contact');
  S('instagram_handle', 60, 'Instagram handle');
  S('x_handle', 60, 'X handle');
  S('refund_initiation_days', 20, 'Refund initiation days', { required: true });
  if ('whatsapp' in b) {
    const digits = String(b.whatsapp).replace(/[^\d]/g, '');
    if (digits.length < 10 || digits.length > 15) throw bad('WhatsApp number must include the country code, e.g. 919103409968');
    out.whatsapp = digits;
  }
  if ('email' in b) {
    const e = str(b.email, 160, 'Email', { required: true });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw bad('Email address is not valid');
    out.email = e;
  }
  for (const k of ['instagram_url', 'x_url']) if (k in b) {
    const v = str(b[k], 300, k);
    if (v && !/^https:\/\/[^\s]+$/.test(v)) throw bad('Social links must start with https://');
    out[k] = v;
  }
  if ('site_url' in b) {
    const v = str(b.site_url, 200, 'Site URL');
    if (v && !/^https?:\/\/[^\s/]+$/.test(v.replace(/\/+$/, ''))) throw bad('Site URL must look like https://example.com');
    out.site_url = v.replace(/\/+$/, '');
  }
  if ('logo_path' in b) out.logo_path = safeAssetPath(b.logo_path, 'Logo');
  if ('emblem_path' in b) out.emblem_path = safeAssetPath(b.emblem_path, 'Emblem');
  if ('shipping_fee_paise' in b) out.shipping_fee_paise = int(b.shipping_fee_paise, 0, 1000000, 'Shipping charge');
  if ('free_shipping_threshold_paise' in b) out.free_shipping_threshold_paise = int(b.free_shipping_threshold_paise, 0, 100000000, 'Free-shipping threshold');
  if ('report_window_hours' in b) out.report_window_hours = int(b.report_window_hours, 1, 720, 'Reporting window (hours)');

  if ('home' in b) {
    if (!Array.isArray(b.home)) throw bad('Homepage sections must be a list');
    const defs = new Map(defaults.settings.home.map((s) => [s.id, s]));
    const seen = new Set(); const home = [];
    for (const sec of b.home) {
      const def = defs.get(sec && sec.id);
      if (!def || seen.has(sec.id)) continue;
      seen.add(sec.id);
      const o = { id: sec.id, visible: !!sec.visible };
      for (const [k, v] of Object.entries(def)) {
        if (k === 'id' || k === 'visible') continue;
        if (k === 'items') {
          const items = Array.isArray(sec.items) ? sec.items.slice(0, 3) : v;
          o.items = items.map((it) => ({ title: str(it.title, 80, 'Title', { required: true }), text: str(it.text, 300, 'Text', { required: true }) }));
        } else if (/_href$/.test(k)) o[k] = safeHref(k in sec ? sec[k] : v, 'Link');
        else o[k] = str(k in sec ? sec[k] : v, 2000, k);
      }
      home.push(o);
    }
    for (const [id, def] of defs) if (!seen.has(id)) home.push(Object.assign({}, def, { visible: false }));
    out.home = home;
  }
  if ('recipe' in b) {
    const r = b.recipe || {};
    const list = (a, max, name) => {
      if (!Array.isArray(a) || a.length > max) throw bad(`${name} must be a list (max ${max})`);
      return a.map((x) => str(x, 600, name, { required: true }));
    };
    out.recipe = {
      title: str(r.title, 120, 'Recipe title', { required: true }), intro: str(r.intro, 500, 'Recipe intro'),
      serves: str(r.serves, 60, 'Serves'), soak: str(r.soak, 60, 'Soak time'), cook: str(r.cook, 60, 'Cook time'),
      ingredients: list(r.ingredients, 30, 'Ingredients'), steps: list(r.steps, 20, 'Steps'), note: str(r.note, 400, 'Recipe note')
    };
  }
  void cur;
  return out;
}

function imageKind(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

/* ---------------------------------------------------------------- order helpers */
function deductStock(enq, adminEmail) {
  const items = store.safeJson(enq.items, []);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const it of items) {
      const p = db.prepare('SELECT id, stock, name FROM products WHERE slug = ?').get(it.slug);
      if (!p) throw bad(`Product ${it.slug} no longer exists`);
      if (p.stock < it.qty) throw bad(`Not enough stock of ${p.name} (have ${p.stock}, need ${it.qty})`);
    }
    for (const it of items) {
      const p = db.prepare('SELECT id, stock FROM products WHERE slug = ?').get(it.slug);
      const after = p.stock - it.qty;
      db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(after, now(), p.id);
      db.prepare('INSERT INTO inventory_log (product_id, delta, stock_after, reason, admin_email, created_at) VALUES (?,?,?,?,?,?)').run(p.id, -it.qty, after, `Order ${enq.ref} confirmed`, adminEmail, now());
    }
    db.prepare('UPDATE enquiries SET stock_deducted = 1 WHERE id = ?').run(enq.id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
function restock(enq, adminEmail) {
  const items = store.safeJson(enq.items, []);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const it of items) {
      const p = db.prepare('SELECT id, stock FROM products WHERE slug = ?').get(it.slug);
      if (!p) continue;
      const after = p.stock + it.qty;
      db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(after, now(), p.id);
      db.prepare('INSERT INTO inventory_log (product_id, delta, stock_after, reason, admin_email, created_at) VALUES (?,?,?,?,?,?)').run(p.id, it.qty, after, `Order ${enq.ref} stock returned`, adminEmail, now());
    }
    db.prepare('UPDATE enquiries SET stock_deducted = 0 WHERE id = ?').run(enq.id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}
const enqOut = (r) => Object.assign({}, r, { items: store.safeJson(r.items, []) });

/* ---------------------------------------------------------------- main handler */
async function handle(req, res, h) {
  const { pathname, method } = h;
  const sub = pathname.replace(/^\/api\/admin/, '') || '/';

  // CSRF defence in depth (cookie is SameSite=Strict): state-changing calls need a custom header and a same-host Origin.
  if (method !== 'GET' && method !== 'HEAD') {
    if (req.headers['x-arsara-csrf'] !== '1') throw bad('Missing request header', 403);
    const origin = req.headers.origin;
    if (origin) {
      let oh = ''; try { oh = new URL(origin).host; } catch (_) { /* invalid */ }
      if (oh !== req.headers.host) throw bad('Cross-origin request blocked', 403);
    }
  }

  /* ----- login / logout (no session needed for login) ----- */
  if (sub === '/login' && method === 'POST') {
    const ip = h.clientIp(req);
    const b = await h.readJson(req, 10 * 1024);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
    const key = `login:${ip}`;
    if (!h.rateLimit(key, 8, 15 * 60 * 1000)) return h.sendJson(req, res, 429, { error: 'Too many sign-in attempts. Try again in 15 minutes.' });
    const row = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
    const ok = store.verifyPassword(String(b.password || '').slice(0, 200), row ? row.pass_hash : DUMMY_HASH);
    if (!row || !ok) return h.sendJson(req, res, 401, { error: 'Email or password is incorrect.' });
    const tok = crypto.randomBytes(32).toString('base64url');
    db.prepare('INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES (?,?,?)').run(sha(tok), row.id, Date.now() + SESSION_MS);
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    return h.sendJson(req, res, 200, { ok: true, email: row.email }, { 'Set-Cookie': cookieHeader(req, h, tok, SESSION_MS / 1000) });
  }

  const me = currentAdmin(req, h);
  if (!me) return h.sendJson(req, res, 401, { error: 'Not signed in.' });

  if (sub === '/logout' && method === 'POST') {
    db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(me.id);
    return h.sendJson(req, res, 200, { ok: true }, { 'Set-Cookie': cookieHeader(req, h, '', 0) });
  }
  if (sub === '/me' && method === 'GET') return h.sendJson(req, res, 200, { email: me.email, statuses: STATUSES, paymentStatuses: PAYMENT_STATUSES, pageSlugs: PAGE_SLUGS });

  if (sub === '/password' && method === 'POST') {
    const b = await h.readJson(req, 10 * 1024);
    const row = db.prepare('SELECT * FROM admins WHERE id = ?').get(me.id);
    if (!store.verifyPassword(String(b.current || ''), row.pass_hash)) throw bad('Current password is incorrect', 403);
    const np = String(b.next || '');
    if (np.length < 12) throw bad('New password must be at least 12 characters');
    db.prepare('UPDATE admins SET pass_hash = ? WHERE id = ?').run(store.hashPassword(np), me.id);
    db.prepare('DELETE FROM sessions WHERE admin_id = ? AND token_hash != ?').run(me.id, me.token_hash);
    return h.sendJson(req, res, 200, { ok: true });
  }

  /* ----- dashboard ----- */
  if (sub === '/dashboard' && method === 'GET') {
    const products = store.listProducts({ includeAll: true });
    const active = products.filter((p) => p.status === 'active');
    const byStatus = db.prepare('SELECT status, COUNT(*) AS n FROM enquiries GROUP BY status').all();
    const byPay = db.prepare('SELECT payment_status, COUNT(*) AS n FROM enquiries GROUP BY payment_status').all();
    const recent = db.prepare('SELECT * FROM enquiries ORDER BY id DESC LIMIT 8').all().map(enqOut);
    const s = store.getSettings();
    const launch = [];
    if (!s.business_legal_name) launch.push('Legal business name is not set (shown in Terms, Privacy and footer).');
    if (!s.address) launch.push('Business address is not set. Add a verified address if you want it published.');
    if (!s.fssai_number) launch.push('FSSAI number is not set. Add it so it appears in the footer and Terms.');
    if (!s.grievance_officer) launch.push('Grievance contact is not set. Check whether e-commerce rules require a named grievance officer for your business.');
    const seeded = db.prepare("SELECT COUNT(*) AS n FROM inventory_log WHERE reason LIKE 'Opening stock (seed%'").get().n;
    if (seeded) launch.push('Stock count is still the starting value. Set the real quantity under Products.');
    return h.sendJson(req, res, 200, {
      activeProducts: active.length, totalProducts: products.length,
      availableUnits: active.reduce((a, p) => a + p.stock, 0),
      low: active.filter((p) => p.stock > 0 && p.stock <= p.low_stock_threshold).map((p) => ({ id: p.id, name: p.name, stock: p.stock, threshold: p.low_stock_threshold })),
      out: active.filter((p) => p.stock <= 0).map((p) => ({ id: p.id, name: p.name })),
      byStatus, byPay, recent, launch
    });
  }

  /* ----- products ----- */
  if (sub === '/products' && method === 'GET') return h.sendJson(req, res, 200, { products: store.listProducts({ includeAll: true }) });
  if (sub === '/products' && method === 'POST') {
    const b = await h.readJson(req);
    const v = validateProduct(Object.assign({ status: 'draft', images: [], specs: [], origin: {} }, b), null);
    const stock = int(b.stock ?? 0, 0, 10000000, 'Stock');
    const t = now();
    db.prepare(`INSERT INTO products (slug,name,short_description,description,price_paise,sale_price_paise,sku,pack_size,weight_g,stock,low_stock_threshold,category,origin,specs,images,storage_guidance,seo_title,seo_description,status,sort_order,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(v.slug, v.name, v.short_description, v.description, v.price_paise, v.sale_price_paise, v.sku, v.pack_size, v.weight_g, v.low_stock_threshold, v.category,
        JSON.stringify(v.origin), JSON.stringify(v.specs), JSON.stringify(v.images), v.storage_guidance, v.seo_title, v.seo_description, v.status, 99, t, t);
    const p = store.getProductBySlug(v.slug, { includeAll: true });
    if (stock > 0) store.adjustStock(p.id, stock, 'Opening stock', me.email);
    return h.sendJson(req, res, 201, { product: store.getProductById(p.id) });
  }
  let m = sub.match(/^\/products\/(\d+)$/);
  if (m) {
    const existing = store.getProductById(Number(m[1]));
    if (!existing) throw bad('Product not found', 404);
    if (method === 'GET') return h.sendJson(req, res, 200, { product: existing });
    if (method === 'PUT') {
      const v = validateProduct(await h.readJson(req), existing);
      db.prepare(`UPDATE products SET slug=?,name=?,short_description=?,description=?,price_paise=?,sale_price_paise=?,sku=?,pack_size=?,weight_g=?,low_stock_threshold=?,category=?,origin=?,specs=?,images=?,storage_guidance=?,seo_title=?,seo_description=?,status=?,updated_at=? WHERE id=?`)
        .run(v.slug, v.name, v.short_description, v.description, v.price_paise, v.sale_price_paise, v.sku, v.pack_size, v.weight_g, v.low_stock_threshold, v.category,
          JSON.stringify(v.origin), JSON.stringify(v.specs), JSON.stringify(v.images), v.storage_guidance, v.seo_title, v.seo_description, v.status, now(), existing.id);
      return h.sendJson(req, res, 200, { product: store.getProductById(existing.id) });
    }
  }
  m = sub.match(/^\/products\/(\d+)\/stock$/);
  if (m && method === 'POST') {
    const p = store.getProductById(Number(m[1]));
    if (!p) throw bad('Product not found', 404);
    const b = await h.readJson(req, 10 * 1024);
    const reason = str(b.reason, 200, 'Reason', { required: true });
    let delta;
    if (b.set !== undefined && b.set !== null && b.set !== '') delta = int(b.set, 0, 10000000, 'New stock level') - p.stock;
    else delta = int(b.delta, -10000000, 10000000, 'Adjustment');
    if (delta === 0) throw bad('That does not change the stock level');
    try { store.adjustStock(p.id, delta, reason, me.email); } catch (e) { throw bad(e.message); }
    return h.sendJson(req, res, 200, { product: store.getProductById(p.id) });
  }
  m = sub.match(/^\/products\/(\d+)\/log$/);
  if (m && method === 'GET') {
    return h.sendJson(req, res, 200, { log: db.prepare('SELECT * FROM inventory_log WHERE product_id = ? ORDER BY id DESC LIMIT 50').all(Number(m[1])) });
  }

  /* ----- image upload (JSON base64; JPEG/PNG/WebP only, 3 MB, magic-byte checked) ----- */
  if (sub === '/upload' && method === 'POST') {
    const b = await h.readJson(req, 5 * 1024 * 1024);
    const data = String(b.data || '').replace(/^data:[^,]*,/, '');
    if (!data) throw bad('No file received');
    const buf = Buffer.from(data, 'base64');
    if (buf.length > 3 * 1024 * 1024) throw bad('Image is too large (max 3 MB)', 413);
    const kind = imageKind(buf);
    if (!kind) throw bad('Only JPEG, PNG or WebP images are allowed');
    const name = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.${kind}`;
    fs.writeFileSync(path.join(store.DATA_DIR, 'uploads', name), buf, { mode: 0o644 });
    return h.sendJson(req, res, 201, { path: '/uploads/' + name });
  }

  /* ----- enquiries / orders ----- */
  if (sub === '/enquiries' && method === 'GET') {
    return h.sendJson(req, res, 200, { enquiries: db.prepare('SELECT * FROM enquiries ORDER BY id DESC LIMIT 200').all().map(enqOut) });
  }
  m = sub.match(/^\/enquiries\/(\d+)$/);
  if (m && method === 'PUT') {
    const enq = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(Number(m[1]));
    if (!enq) throw bad('Enquiry not found', 404);
    const b = await h.readJson(req, 20 * 1024);
    const status = STATUSES.includes(b.status) ? b.status : (() => { throw bad('Invalid status'); })();
    const pay = PAYMENT_STATUSES.includes(b.payment_status) ? b.payment_status : (() => { throw bad('Invalid payment status'); })();
    const payNote = str(b.payment_note, 300, 'Payment verification note');
    // Never mark paid without verification.
    if (pay === 'verified' && !payNote) throw bad('Enter how the payment was verified (e.g. bank/UPI reference) before marking it verified');
    if (PAID_STATES.includes(status) && pay !== 'verified') throw bad('This status requires the payment to be verified first');
    db.prepare(`UPDATE enquiries SET status=?, payment_status=?, payment_note=?, customer_name=?, customer_phone=?, customer_address=?, tracking=?, refund_note=?, notes=?, updated_at=? WHERE id=?`)
      .run(status, pay, payNote, str(b.customer_name, 120, 'Customer name'), str(b.customer_phone, 30, 'Customer phone'), str(b.customer_address, 400, 'Delivery address'),
        str(b.tracking, 200, 'Tracking'), str(b.refund_note, 300, 'Refund note'), str(b.notes, 1000, 'Notes'), now(), enq.id);
    const fresh = db.prepare('SELECT * FROM enquiries WHERE id = ?').get(enq.id);
    // Stock changes only on an explicit admin choice, never because WhatsApp was opened.
    if (b.deduct_stock && !fresh.stock_deducted) {
      if (!['payment_confirmed', 'processing', 'dispatched', 'delivered'].includes(status)) throw bad('Stock can only be deducted for a payment-confirmed order');
      deductStock(fresh, me.email);
    }
    if (b.restock && fresh.stock_deducted) restock(fresh, me.email);
    return h.sendJson(req, res, 200, { enquiry: enqOut(db.prepare('SELECT * FROM enquiries WHERE id = ?').get(enq.id)) });
  }

  /* ----- settings ----- */
  if (sub === '/settings' && method === 'GET') return h.sendJson(req, res, 200, { settings: store.getSettings() });
  if (sub === '/settings' && method === 'PUT') {
    const v = validateSettings(await h.readJson(req, 200 * 1024));
    db.exec('BEGIN');
    try { for (const [k, val] of Object.entries(v)) store.setSetting(k, val); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    return h.sendJson(req, res, 200, { settings: store.getSettings() });
  }

  /* ----- pages (legal + about) ----- */
  if (sub === '/pages' && method === 'GET') {
    return h.sendJson(req, res, 200, { pages: PAGE_SLUGS.map((s) => store.getPage(s)).filter(Boolean) });
  }
  m = sub.match(/^\/pages\/([a-z]+)$/);
  if (m && method === 'PUT') {
    if (!PAGE_SLUGS.includes(m[1])) throw bad('Unknown page', 404);
    const b = await h.readJson(req, 100 * 1024);
    store.savePage(m[1], str(b.title, 120, 'Title', { required: true }), str(b.body, 40000, 'Body', { required: true }));
    return h.sendJson(req, res, 200, { page: store.getPage(m[1]) });
  }

  return h.sendJson(req, res, 404, { error: 'Not found' });
}

module.exports = { handle };

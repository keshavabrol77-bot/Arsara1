'use strict';
// ARSARA storefront + admin. Zero third-party dependencies (Node >= 22.13 for built-in SQLite).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

// Optional .env loader (no dependency): KEY=VALUE lines, never overrides real environment variables.
try {
  const envFile = path.join(__dirname, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch (_) { /* ignore */ }

const store = require('./lib/db');
const { db, now } = store;
const money = require('./public/js/money');
const R = require('./lib/render');
const admin = require('./lib/admin-api');

store.seed();
store.bootstrapAdmin();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const PROD = process.env.NODE_ENV === 'production';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(store.DATA_DIR, 'uploads');
const VER = String(Date.now()).slice(-8);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8'
};
const COMPRESSIBLE = /^(text\/|application\/(javascript|json|xml)|image\/svg)/;

/* ---------------------------------------------------------------- helpers */
function clientIp(req) {
  if (TRUST_PROXY) {
    const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xf) return xf;
  }
  return req.socket.remoteAddress || 'unknown';
}
function isHttps(req) { return TRUST_PROXY ? req.headers['x-forwarded-proto'] === 'https' : !!req.socket.encrypted; }

const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const t = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < t) { b = { n: 0, reset: t + windowMs }; buckets.set(key, b); }
  b.n++;
  return b.n <= max;
}
setInterval(() => { const t = Date.now(); for (const [k, b] of buckets) if (b.reset < t) buckets.delete(k); }, 60000).unref();

function securityHeaders(res, isAdminPage) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'"
  ].join('; '));
  if (PROD) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
}

function send(req, res, status, body, headers = {}) {
  const ct = headers['Content-Type'] || 'text/html; charset=utf-8';
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const h = Object.assign({ 'Content-Type': ct }, headers);
  if (COMPRESSIBLE.test(ct) && buf.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    buf = zlib.gzipSync(buf); h['Content-Encoding'] = 'gzip'; h['Vary'] = 'Accept-Encoding';
  }
  h['Content-Length'] = buf.length;
  res.writeHead(status, h);
  res.end(req.method === 'HEAD' ? undefined : buf);
}
const sendJson = (req, res, status, obj, extra = {}) =>
  send(req, res, status, JSON.stringify(obj), Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra));
const sendHtml = (req, res, status, html) => send(req, res, status, html, { 'Cache-Control': 'no-cache' });

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('Payload too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, limit = 100 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch (_) { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function baseUrl(req, settings) {
  const env = process.env.SITE_URL || settings.site_url;
  if (env) return env.replace(/\/+$/, '');
  const proto = isHttps(req) ? 'https' : 'http';
  return `${proto}://${req.headers.host || 'localhost:' + PORT}`;
}

/* ---------------------------------------------------------------- static files */
function serveStatic(req, res, root, rel, opts = {}) {
  let p;
  try { p = decodeURIComponent(rel); } catch (_) { return false; }
  if (p.includes('\0') || p.split('/').some((seg) => seg.startsWith('.'))) return false;
  const full = path.join(root, p);
  if (!full.startsWith(root + path.sep)) return false;
  let st;
  try { st = fs.statSync(full); } catch (_) { return false; }
  if (!st.isFile()) return false;
  const ext = path.extname(full).toLowerCase();
  if (!MIME[ext]) return false;
  const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
  const cache = opts.immutable ? 'public, max-age=31536000, immutable' : (ext === '.html' ? 'no-cache' : 'public, max-age=3600');
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag, 'Cache-Control': cache }); res.end(); return true; }
  send(req, res, 200, fs.readFileSync(full), { 'Content-Type': MIME[ext], 'Cache-Control': cache, ETag: etag });
  return true;
}

/* ---------------------------------------------------------------- public API */
function catalogPayload() {
  const s = store.getSettings();
  return {
    config: { shippingFeePaise: s.shipping_fee_paise, freeThresholdPaise: s.free_shipping_threshold_paise, currency: 'INR' },
    products: store.listProducts().map((p) => ({
      slug: p.slug, name: p.name, pack: p.pack_size, unitPaise: store.unitPrice(p), stock: p.stock,
      image: (p.images[0] && p.images[0].src) || '/img/pouch.jpg', url: '/product/' + p.slug
    }))
  };
}

function newRef() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let tries = 0; tries < 10; tries++) {
    const b = crypto.randomBytes(6);
    let r = 'ARS-';
    for (let i = 0; i < 6; i++) r += alphabet[b[i] % alphabet.length];
    if (!db.prepare('SELECT 1 FROM enquiries WHERE ref = ?').get(r)) return r;
  }
  throw new Error('Could not allocate reference');
}

function buildWhatsAppMessage(ref, lines, totals) {
  const L = ['Hello ARSARA, I would like to place an order.', '', `Enquiry ref: ${ref}`, ''];
  for (const l of lines) {
    L.push(`Product: ${l.name}`, `Pack size: ${l.pack}`, `Quantity: ${l.qty}`, `Unit price: ${money.formatPaise(l.unitPaise)}`, '');
  }
  L.push(`Subtotal: ${money.formatPaise(totals.merchandisePaise)}`,
    `Shipping: ${totals.shippingPaise === 0 ? 'FREE' : money.formatPaise(totals.shippingPaise)}`,
    `Total payable: ${money.formatPaise(totals.totalPaise)}`, '',
    'Please confirm availability, delivery details and the secure online payment process.');
  return L.join('\n');
}

async function handleEnquiry(req, res) {
  if (!rateLimit('enq:' + clientIp(req), 20, 10 * 60 * 1000)) return sendJson(req, res, 429, { error: 'Too many requests. Please try again in a few minutes.' });
  const body = await readJson(req);
  const items = Array.isArray(body.items) ? body.items : null;
  if (!items || !items.length || items.length > 20) return sendJson(req, res, 400, { error: 'Your cart is empty.' });
  const merged = new Map();
  for (const it of items) {
    const slug = String(it && it.slug || '');
    const qty = Number(it && it.qty);
    if (!/^[a-z0-9-]{1,80}$/.test(slug) || !Number.isInteger(qty) || qty < 1 || qty > 99) return sendJson(req, res, 400, { error: 'Invalid cart item.' });
    merged.set(slug, (merged.get(slug) || 0) + qty);
  }
  const s = store.getSettings();
  const lines = [];
  for (const [slug, qty] of merged) {
    const p = store.getProductBySlug(slug);
    if (!p) return sendJson(req, res, 409, { error: 'One of the products in your cart is no longer available.', slug });
    if (p.stock <= 0) return sendJson(req, res, 409, { error: `${p.name} is out of stock.`, slug, stock: 0 });
    if (qty > p.stock) return sendJson(req, res, 409, { error: `Only ${p.stock} of ${p.name} ${p.stock === 1 ? 'is' : 'are'} available.`, slug, stock: p.stock });
    lines.push({ slug, name: p.name, pack: p.pack_size, qty, unitPaise: store.unitPrice(p) });
  }
  const totals = money.calculate(lines, { shippingFeePaise: s.shipping_fee_paise, freeThresholdPaise: s.free_shipping_threshold_paise });
  const ref = newRef();
  // An enquiry record only: no personal data, no stock deduction, never marked paid.
  db.prepare('INSERT INTO enquiries (ref, items, subtotal_paise, shipping_paise, total_paise, status, payment_status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(ref, JSON.stringify(lines), totals.merchandisePaise, totals.shippingPaise, totals.totalPaise, 'enquiry_received', 'unverified', now(), now());
  const message = buildWhatsAppMessage(ref, lines, totals);
  sendJson(req, res, 201, {
    ref, totals,
    whatsappUrl: `https://wa.me/${s.whatsapp}?text=${encodeURIComponent(message)}`,
    notice: 'Opening WhatsApp does not complete an order. Orders are subject to availability and ARSARA\'s confirmation. Payment is online only; no cash on delivery.'
  });
}

/* ---------------------------------------------------------------- router */
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  let pathname = url.pathname.replace(/\/{2,}/g, '/');
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
  const method = req.method;
  securityHeaders(res);

  if (!['GET', 'HEAD', 'POST', 'PUT', 'DELETE'].includes(method)) return send(req, res, 405, 'Method not allowed', { Allow: 'GET, HEAD, POST, PUT, DELETE' });

  /* ----- API ----- */
  if (pathname.startsWith('/api/')) {
    try {
      if (pathname === '/api/catalog' && (method === 'GET' || method === 'HEAD')) return sendJson(req, res, 200, catalogPayload());
      if (pathname === '/api/enquiries' && method === 'POST') return await handleEnquiry(req, res);
      if (pathname.startsWith('/api/admin/')) {
        return await admin.handle(req, res, { pathname, method, readJson, readBody, sendJson, parseCookies, clientIp, isHttps, rateLimit, PROD });
      }
      return sendJson(req, res, 404, { error: 'Not found' });
    } catch (e) {
      const status = e.status || (e.expose ? 400 : 500);
      if (status >= 500) console.error('[api]', e);
      return sendJson(req, res, status, { error: status >= 500 ? 'Something went wrong.' : e.message });
    }
  }

  /* ----- static ----- */
  if (method === 'GET' || method === 'HEAD') {
    if (pathname.startsWith('/uploads/')) { if (serveStatic(req, res, UPLOAD_DIR, pathname.slice(9), { immutable: true })) return; return sendHtml(req, res, 404, R.notFoundPage(await ctxFor(req))); }
    if (/^\/(css|js|img)\//.test(pathname)) { if (serveStatic(req, res, PUBLIC_DIR, pathname.slice(1))) return; return send(req, res, 404, 'Not found', { 'Content-Type': 'text/plain' }); }
    if (pathname === '/admin') return sendAdminShell(req, res);
  }
  if (method !== 'GET' && method !== 'HEAD') return send(req, res, 405, 'Method not allowed');

  /* ----- pages ----- */
  const ctx = await ctxFor(req);
  const s = ctx.settings;
  const products = store.listProducts();
  switch (pathname) {
    case '/': return sendHtml(req, res, 200, R.homePage(ctx, products));
    case '/shop': return sendHtml(req, res, 200, R.shopPage(ctx, products));
    case '/cart': return sendHtml(req, res, 200, R.cartPage(ctx));
    case '/story': case '/about': return sendHtml(req, res, 200, R.storyPage(ctx, store.getPage('about')));
    case '/contact': return sendHtml(req, res, 200, R.contactPage(ctx));
    case '/terms': case '/privacy': case '/returns': case '/cancellation': case '/grievance':
      return sendHtml(req, res, 200, R.policyPage(ctx, pathname.slice(1), store.getPage(pathname.slice(1)), pathname));
    case '/shipping-policy': return sendHtml(req, res, 200, R.policyPage(ctx, 'shipping', store.getPage('shipping'), pathname));
    case '/robots.txt':
      return send(req, res, 200, `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nDisallow: /cart\n\nSitemap: ${ctx.base}/sitemap.xml\n`, { 'Content-Type': 'text/plain; charset=utf-8' });
    case '/sitemap.xml': {
      const urls = ['/', '/shop', '/story', '/contact', '/terms', '/privacy', '/shipping-policy', '/returns', '/cancellation', '/grievance']
        .concat(products.map((p) => '/product/' + p.slug));
      return send(req, res, 200, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${R.esc(ctx.base + u)}</loc></url>`).join('\n')}\n</urlset>\n`, { 'Content-Type': 'application/xml; charset=utf-8' });
    }
  }
  const pm = pathname.match(/^\/product\/([a-z0-9-]+)$/);
  if (pm) {
    const p = store.getProductBySlug(pm[1]);
    if (p) return sendHtml(req, res, 200, R.productPage(ctx, p));
  }
  void s;
  return sendHtml(req, res, 404, R.notFoundPage(ctx));
}

async function ctxFor(req) {
  const settings = store.getSettings();
  return { settings, base: baseUrl(req, settings), ver: VER };
}

function sendAdminShell(req, res) {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, 'admin', 'index.html'), 'utf8').replace(/__VER__/g, VER);
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  send(req, res, 200, html, { 'Cache-Control': 'no-store' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error('[server]', e);
    if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' }); }
    res.end('Something went wrong.');
  });
});
server.requestTimeout = 30000;
server.headersTimeout = 15000;

if (require.main === module) {
  server.listen(PORT, HOST, () => console.log(`[arsara] listening on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`));
}
module.exports = { server };

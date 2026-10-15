'use strict';
// Integration tests. Boots the real server on a temp database, then exercises it over HTTP.
// Run: node --disable-warning=ExperimentalWarning test/run.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'arsara-test-'));
process.env.DATA_DIR = tmp;
process.env.ADMIN_EMAIL = 'test@example.com';
process.env.ADMIN_PASSWORD = 'correct-horse-battery';
process.env.SITE_URL = 'http://localhost';

const money = require('../public/js/money');
const { server } = require('../server');

let pass = 0, fail = 0;
const results = [];
async function t(name, fn) {
  try { await fn(); pass++; results.push('PASS  ' + name); }
  catch (e) { fail++; results.push('FAIL  ' + name + '\n        ' + (e.message || e).toString().split('\n')[0]); }
}

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  let cookie = '';
  const call = async (method, p, body, { auth = false, headers = {} } = {}) => {
    const h = Object.assign({}, headers);
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (auth) { h.Cookie = cookie; }
    if (method !== 'GET' && p.startsWith('/api/admin') && h['X-Arsara-Csrf'] === undefined) h['X-Arsara-Csrf'] = '1';
    const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    const text = await r.text(); let json; try { json = JSON.parse(text); } catch (_) { /* html */ }
    return { status: r.status, json, text, headers: r.headers };
  };

  /* ---------- shipping maths (spec examples) ---------- */
  const cfg = { shippingFeePaise: 6000, freeThresholdPaise: 99900 };
  const calc = (qty, unit = 39900, extra = {}) => money.calculate([{ unitPaise: unit, qty }], Object.assign({}, cfg, extra));
  await t('1 pack = Rs399 + Rs60 = Rs459', () => { const c = calc(1); assert.deepStrictEqual([c.subtotalPaise, c.shippingPaise, c.totalPaise], [39900, 6000, 45900]); });
  await t('2 packs = Rs798 + Rs60 = Rs858', () => { const c = calc(2); assert.deepStrictEqual([c.subtotalPaise, c.shippingPaise, c.totalPaise], [79800, 6000, 85800]); });
  await t('3 packs = Rs1,197, free shipping, total Rs1,197', () => { const c = calc(3); assert.deepStrictEqual([c.subtotalPaise, c.shippingPaise, c.totalPaise, c.freeShipping], [119700, 0, 119700, true]); });
  await t('exactly Rs999 qualifies for free shipping', () => { const c = money.calculate([{ unitPaise: 99900, qty: 1 }], cfg); assert.strictEqual(c.shippingPaise, 0); assert.strictEqual(c.freeShipping, true); });
  await t('Rs998.99 does not qualify', () => { const c = money.calculate([{ unitPaise: 99899, qty: 1 }], cfg); assert.strictEqual(c.shippingPaise, 6000); });
  await t('threshold is tested after discount, before shipping', () => { const c = calc(3, 39900, { discountPaise: 30000 }); assert.strictEqual(c.merchandisePaise, 89700); assert.strictEqual(c.shippingPaise, 6000); assert.strictEqual(c.totalPaise, 95700); });
  await t('remaining-to-free message value: 1 pack needs Rs600', () => { assert.strictEqual(calc(1).remainingForFreePaise, 60000); });
  await t('empty cart has no shipping charge', () => { const c = money.calculate([], cfg); assert.strictEqual(c.shippingPaise, 0); assert.strictEqual(c.totalPaise, 0); });
  await t('currency formatting (Indian grouping)', () => { assert.strictEqual(money.formatPaise(119700), '₹1,197'); assert.strictEqual(money.formatPaise(39900), '₹399'); assert.strictEqual(money.formatPaise(12345600), '₹1,23,456'); });

  /* ---------- public pages ---------- */
  const pages = ['/', '/shop', '/cart', '/story', '/contact', '/terms', '/privacy', '/shipping-policy', '/returns', '/cancellation', '/grievance', '/product/bhaderwahi-rajma-500g', '/robots.txt', '/sitemap.xml', '/admin'];
  for (const p of pages) await t('GET ' + p + ' -> 200', async () => { const r = await call('GET', p); assert.strictEqual(r.status, 200); });
  await t('unknown page -> 404', async () => assert.strictEqual((await call('GET', '/nope')).status, 404));
  await t('draft/unknown product -> 404', async () => assert.strictEqual((await call('GET', '/product/does-not-exist')).status, 404));
  await t('path traversal blocked', async () => { const r = await call('GET', '/img/..%2f..%2fserver.js'); assert.notStrictEqual(r.status, 200); const r2 = await call('GET', '/js/../server.js'); assert.notStrictEqual(r2.text.includes('createServer'), true); });
  await t('security headers present', async () => { const r = await call('GET', '/'); assert.ok(r.headers.get('content-security-policy')); assert.strictEqual(r.headers.get('x-content-type-options'), 'nosniff'); });

  const home = (await call('GET', '/')).text;
  await t('homepage: hero says "Born of the Himalayas." and has both CTAs', () => { assert.ok(home.includes('Born of')); assert.ok(home.includes('Discover Our Story')); assert.ok(home.includes('Explore the Pantry')); });
  await t('homepage hero has no Add to Cart or quantity selector', () => { const hero = home.slice(home.indexOf('class="hero"'), home.indexOf('</section>', home.indexOf('class="hero"'))); assert.ok(!/add to cart/i.test(hero)); assert.ok(!hero.includes('data-qty')); });
  await t('homepage section order A..G', () => { const ids = ['hero-h', 'origin-h', 'bean-h', 'disc-h', 'kit-h', 'phil-h', 'final-h'].map((i) => home.indexOf('id="' + i + '"')); assert.ok(ids.every((x) => x > 0), 'missing ' + ids); assert.deepStrictEqual(ids.slice().sort((a, b) => a - b), ids); });
  await t('homepage shows 500 g and ₹399 and stock', () => { assert.ok(home.includes('500 g')); assert.ok(home.includes('₹399')); assert.ok(home.includes('In stock')); });
  const footer = home.slice(home.indexOf('<footer'));
  for (const l of ['/terms', '/privacy', '/shipping-policy', '/returns', '/cancellation', '/grievance']) await t('footer links to ' + l, () => assert.ok(footer.includes('href="' + l + '"')));
  await t('footer has WhatsApp number, email, Instagram, X', () => { assert.ok(footer.includes('+91 91034 09968')); assert.ok(footer.includes('arsarafoods@gmail.com')); assert.ok(footer.includes('instagram.com/arsara.in')); assert.ok(footer.includes('x.com/arsarafoods')); });
  const ship = (await call('GET', '/shipping-policy')).text;
  await t('shipping policy states the exact rules from settings', () => { assert.ok(ship.includes('₹60')); assert.ok(ship.includes('₹999')); });
  const ret = (await call('GET', '/returns')).text;
  await t('returns policy: 48h preferred window, video not absolute', () => { assert.ok(ret.includes('48 hours')); assert.ok(/not an absolute condition/i.test(ret)); assert.ok(/preferred reporting period/i.test(ret)); });
  const canc = (await call('GET', '/cancellation')).text;
  await t('cancellation policy: 5–7 business days, original payment method', () => { assert.ok(canc.includes('5–7 business days')); assert.ok(canc.includes('original payment method')); });
  await t('terms/cart state: COD unavailable, WhatsApp is not an order', async () => { const terms = (await call('GET', '/terms')).text; assert.ok(/Cash on delivery is not available/.test(terms)); assert.ok(/does not place or complete an order/.test(terms)); const cart = (await call('GET', '/cart')).text; assert.ok(/does not complete an order/.test(cart)); assert.ok(/No cash on delivery|Cash on delivery is unavailable/.test(cart)); });
  await t('no unreplaced {{placeholders}} on any policy page', async () => { for (const p of ['/terms', '/privacy', '/shipping-policy', '/returns', '/cancellation', '/grievance', '/story']) assert.ok(!(await call('GET', p)).text.includes('{{'), p); });
  await t('product JSON-LD has price 399.00 INR, no ratings', async () => { const r = (await call('GET', '/product/bhaderwahi-rajma-500g')).text; assert.ok(r.includes('"price":"399.00"')); assert.ok(r.includes('"priceCurrency":"INR"')); assert.ok(!r.includes('aggregateRating')); });
  await t('every <img> has an alt attribute', async () => { for (const p of ['/', '/shop', '/product/bhaderwahi-rajma-500g', '/story']) { const html = (await call('GET', p)).text; const imgs = html.match(/<img\b[^>]*>/g) || []; for (const i of imgs) assert.ok(/\balt=/.test(i), p + ' ' + i); } });

  /* ---------- catalogue + enquiry (trusted server maths) ---------- */
  await t('catalog API returns price and config in paise', async () => { const r = await call('GET', '/api/catalog'); assert.strictEqual(r.json.products[0].unitPaise, 39900); assert.strictEqual(r.json.config.shippingFeePaise, 6000); assert.strictEqual(r.json.config.freeThresholdPaise, 99900); });
  const enq = async (items) => call('POST', '/api/enquiries', { items });
  let ref1;
  await t('enquiry for 1 pack: message has Rs399, Rs60, Rs459 and the configured number', async () => {
    const r = await enq([{ slug: 'bhaderwahi-rajma-500g', qty: 1 }]);
    assert.strictEqual(r.status, 201); ref1 = r.json.ref;
    assert.deepStrictEqual([r.json.totals.merchandisePaise, r.json.totals.shippingPaise, r.json.totals.totalPaise], [39900, 6000, 45900]);
    assert.ok(r.json.whatsappUrl.startsWith('https://wa.me/919103409968?text='));
    const msg = decodeURIComponent(r.json.whatsappUrl.split('text=')[1]);
    for (const s of ['Product: ARSARA Bhaderwahi Rajma', 'Pack size: 500 g', 'Quantity: 1', 'Unit price: ₹399', 'Subtotal: ₹399', 'Shipping: ₹60', 'Total payable: ₹459', 'Enquiry ref: ' + ref1, 'Please confirm availability, delivery details and the secure online payment process.']) assert.ok(msg.includes(s), 'missing: ' + s);
  });
  await t('enquiry for 2 packs totals Rs858', async () => { const r = await enq([{ slug: 'bhaderwahi-rajma-500g', qty: 2 }]); assert.strictEqual(r.json.totals.totalPaise, 85800); });
  await t('enquiry for 3 packs: free shipping, Rs1,197', async () => { const r = await enq([{ slug: 'bhaderwahi-rajma-500g', qty: 3 }]); assert.deepStrictEqual([r.json.totals.shippingPaise, r.json.totals.totalPaise], [0, 119700]); assert.ok(decodeURIComponent(r.json.whatsappUrl).includes('Shipping: FREE')); });
  await t('client cannot spoof price (server ignores it)', async () => { const r = await enq([{ slug: 'bhaderwahi-rajma-500g', qty: 1, unitPaise: 1 }]); assert.strictEqual(r.json.totals.merchandisePaise, 39900); });
  await t('invalid quantity / slug rejected', async () => { for (const bad of [[{ slug: 'bhaderwahi-rajma-500g', qty: 0 }], [{ slug: 'bhaderwahi-rajma-500g', qty: -1 }], [{ slug: 'bhaderwahi-rajma-500g', qty: 1.5 }], [{ slug: '../x', qty: 1 }], []]) assert.strictEqual((await enq(bad)).status, 400); });
  await t('unknown product -> 409', async () => assert.strictEqual((await enq([{ slug: 'nope', qty: 1 }])).status, 409));
  await t('opening WhatsApp does not deduct stock or mark paid', async () => { assert.strictEqual((await call('GET', '/api/catalog')).json.products[0].stock, 25); });

  /* ---------- admin auth ---------- */
  const adminGets = ['/api/admin/me', '/api/admin/dashboard', '/api/admin/products', '/api/admin/enquiries', '/api/admin/settings', '/api/admin/pages'];
  for (const p of adminGets) await t('unauthenticated GET ' + p + ' -> 401', async () => assert.strictEqual((await call('GET', p)).status, 401));
  await t('unauthenticated product edit -> 401', async () => assert.strictEqual((await call('PUT', '/api/admin/products/1', { name: 'x' })).status, 401));
  await t('unauthenticated upload -> 401', async () => assert.strictEqual((await call('POST', '/api/admin/upload', { data: 'AAAA' })).status, 401));
  await t('forged cookie rejected', async () => assert.strictEqual((await call('GET', '/api/admin/me', undefined, { headers: { Cookie: 'arsara_admin=forged' } })).status, 401));
  await t('wrong password -> 401', async () => assert.strictEqual((await call('POST', '/api/admin/login', { email: 'test@example.com', password: 'wrong-password-123' })).status, 401));
  await t('login without CSRF header -> 403', async () => { const r = await fetch(base + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@example.com', password: 'correct-horse-battery' }) }); assert.strictEqual(r.status, 403); });
  await t('cross-origin admin request blocked', async () => { const r = await call('POST', '/api/admin/login', { email: 'test@example.com', password: 'correct-horse-battery' }, { headers: { Origin: 'https://evil.example' } }); assert.strictEqual(r.status, 403); });
  await t('login succeeds, cookie is HttpOnly + SameSite=Strict', async () => {
    const r = await call('POST', '/api/admin/login', { email: 'test@example.com', password: 'correct-horse-battery' });
    assert.strictEqual(r.status, 200);
    const sc = r.headers.get('set-cookie'); assert.ok(/HttpOnly/i.test(sc) && /SameSite=Strict/i.test(sc)); cookie = sc.split(';')[0];
  });
  await t('authenticated /me works', async () => assert.strictEqual((await call('GET', '/api/admin/me', undefined, { auth: true })).json.email, 'test@example.com'));

  /* ---------- admin: products, inventory, persistence ---------- */
  let prod;
  await t('admin lists products', async () => { const r = await call('GET', '/api/admin/products', undefined, { auth: true }); prod = r.json.products[0]; assert.strictEqual(prod.price_paise, 39900); });
  await t('admin price + description edit persists and shows on the site', async () => {
    const body = Object.assign({}, prod, { price_paise: 41900, description: 'Edited description for test.' });
    const r = await call('PUT', '/api/admin/products/' + prod.id, body, { auth: true }); assert.strictEqual(r.status, 200);
    const page = (await call('GET', '/product/bhaderwahi-rajma-500g')).text; assert.ok(page.includes('₹419')); assert.ok(page.includes('Edited description for test.'));
    assert.strictEqual((await call('GET', '/api/catalog')).json.products[0].unitPaise, 41900);
    await call('PUT', '/api/admin/products/' + prod.id, Object.assign({}, prod), { auth: true });
  });
  await t('negative / invalid price rejected', async () => { const r = await call('PUT', '/api/admin/products/' + prod.id, Object.assign({}, prod, { price_paise: -5 }), { auth: true }); assert.strictEqual(r.status, 400); });
  await t('sale price must be lower than price', async () => { const r = await call('PUT', '/api/admin/products/' + prod.id, Object.assign({}, prod, { sale_price_paise: 50000 }), { auth: true }); assert.strictEqual(r.status, 400); });
  await t('stock adjustment persists and is logged', async () => {
    const r = await call('POST', `/api/admin/products/${prod.id}/stock`, { set: 4, reason: 'test count' }, { auth: true }); assert.strictEqual(r.status, 200);
    assert.strictEqual((await call('GET', '/api/catalog')).json.products[0].stock, 4);
    const log = await call('GET', `/api/admin/products/${prod.id}/log`, undefined, { auth: true }); assert.strictEqual(log.json.log[0].reason, 'test count');
  });
  await t('stock cannot go negative', async () => { const r = await call('POST', `/api/admin/products/${prod.id}/stock`, { delta: -99, reason: 'oops' }, { auth: true }); assert.strictEqual(r.status, 400); assert.strictEqual((await call('GET', '/api/catalog')).json.products[0].stock, 4); });
  await t('cannot order beyond available stock (stock=4, ask 5)', async () => { const r = await enq([{ slug: 'bhaderwahi-rajma-500g', qty: 5 }]); assert.strictEqual(r.status, 409); assert.ok(/Only 4/.test(r.json.error)); });
  await t('ordering exactly available stock works (4)', async () => assert.strictEqual((await enq([{ slug: 'bhaderwahi-rajma-500g', qty: 4 }])).status, 201));
  await t('out of stock cannot be purchased', async () => {
    await call('POST', `/api/admin/products/${prod.id}/stock`, { set: 0, reason: 'sold out test' }, { auth: true });
    const r = await enq([{ slug: 'bhaderwahi-rajma-500g', qty: 1 }]); assert.strictEqual(r.status, 409);
    const pg = (await call('GET', '/product/bhaderwahi-rajma-500g')).text; assert.ok(pg.includes('Out of stock')); assert.ok(/data-add="bhaderwahi-rajma-500g"[^>]*disabled/.test(pg));
    await call('POST', `/api/admin/products/${prod.id}/stock`, { set: 25, reason: 'restore' }, { auth: true });
  });
  await t('draft product is hidden from the public site and API', async () => {
    await call('PUT', '/api/admin/products/' + prod.id, Object.assign({}, prod, { status: 'draft' }), { auth: true });
    assert.strictEqual((await call('GET', '/product/bhaderwahi-rajma-500g')).status, 404); assert.strictEqual((await call('GET', '/api/catalog')).json.products.length, 0);
    await call('PUT', '/api/admin/products/' + prod.id, Object.assign({}, prod, { status: 'active' }), { auth: true });
  });

  /* ---------- admin: orders never auto-paid ---------- */
  const list = await call('GET', '/api/admin/enquiries', undefined, { auth: true });
  const e1 = list.json.enquiries.find((e) => e.ref === ref1);
  await t('new enquiry is enquiry_received + unverified (never paid)', () => { assert.strictEqual(e1.status, 'enquiry_received'); assert.strictEqual(e1.payment_status, 'unverified'); assert.strictEqual(e1.stock_deducted, 0); });
  const upd = (o) => call('PUT', '/api/admin/enquiries/' + e1.id, Object.assign({ status: 'enquiry_received', payment_status: 'unverified', payment_note: '' }, o), { auth: true });
  await t('cannot mark payment confirmed while unverified', async () => assert.strictEqual((await upd({ status: 'payment_confirmed' })).status, 400));
  await t('cannot mark verified without a verification note', async () => assert.strictEqual((await upd({ payment_status: 'verified', status: 'payment_confirmed' })).status, 400));
  await t('verified payment + confirm + deduct stock works once', async () => {
    const r = await upd({ payment_status: 'verified', payment_note: 'UPI ref TEST123', status: 'payment_confirmed', deduct_stock: true }); assert.strictEqual(r.status, 200);
    assert.strictEqual((await call('GET', '/api/catalog')).json.products[0].stock, 24);
    await upd({ payment_status: 'verified', payment_note: 'UPI ref TEST123', status: 'processing', deduct_stock: true });
    assert.strictEqual((await call('GET', '/api/catalog')).json.products[0].stock, 24, 'must not deduct twice');
  });
  await t('restock returns units', async () => { await upd({ payment_status: 'verified', payment_note: 'UPI ref TEST123', status: 'cancelled', restock: true }); assert.strictEqual((await call('GET', '/api/catalog')).json.products[0].stock, 25); });

  /* ---------- admin: settings drive storefront + policies ---------- */
  await t('invalid settings rejected (bad WhatsApp, bad URL, negative shipping)', async () => {
    for (const b of [{ whatsapp: '123' }, { instagram_url: 'javascript:alert(1)' }, { shipping_fee_paise: -1 }, { email: 'nope' }]) assert.strictEqual((await call('PUT', '/api/admin/settings', b, { auth: true })).status, 400);
  });
  await t('changing shipping settings updates catalog, policy page and enquiry maths', async () => {
    const r = await call('PUT', '/api/admin/settings', { shipping_fee_paise: 8000, free_shipping_threshold_paise: 50000 }, { auth: true }); assert.strictEqual(r.status, 200);
    const cat = (await call('GET', '/api/catalog')).json.config; assert.deepStrictEqual([cat.shippingFeePaise, cat.freeThresholdPaise], [8000, 50000]);
    const pol = (await call('GET', '/shipping-policy')).text; assert.ok(pol.includes('₹80') && pol.includes('₹500'));
    const e = await enq([{ slug: 'bhaderwahi-rajma-500g', qty: 2 }]); assert.strictEqual(e.json.totals.shippingPaise, 0);
    await call('PUT', '/api/admin/settings', { shipping_fee_paise: 6000, free_shipping_threshold_paise: 99900 }, { auth: true });
  });
  await t('changing WhatsApp number changes the checkout link', async () => {
    await call('PUT', '/api/admin/settings', { whatsapp: '919000000001' }, { auth: true });
    assert.ok((await enq([{ slug: 'bhaderwahi-rajma-500g', qty: 1 }])).json.whatsappUrl.startsWith('https://wa.me/919000000001?'));
    await call('PUT', '/api/admin/settings', { whatsapp: '919103409968' }, { auth: true });
  });
  await t('homepage section hide/reorder persists', async () => {
    const s = (await call('GET', '/api/admin/settings', undefined, { auth: true })).json.settings;
    const home = s.home.map((x) => Object.assign({}, x, x.id === 'kitchen' ? { visible: false } : {}));
    await call('PUT', '/api/admin/settings', { home }, { auth: true });
    assert.ok(!(await call('GET', '/')).text.includes('id="kit-h"'));
    await call('PUT', '/api/admin/settings', { home: s.home }, { auth: true });
    assert.ok((await call('GET', '/')).text.includes('id="kit-h"'));
  });
  await t('editing a legal page persists and cannot inject script', async () => {
    const p = (await call('GET', '/api/admin/pages', undefined, { auth: true })).json.pages.find((x) => x.slug === 'cancellation');
    await call('PUT', '/api/admin/pages/cancellation', { title: p.title, body: p.body + '\n\n<script>alert(1)</script> [x](javascript:alert(1))' }, { auth: true });
    const html = (await call('GET', '/cancellation')).text; assert.ok(!html.includes('<script>alert(1)')); assert.ok(!html.includes('href="javascript:'));
    await call('PUT', '/api/admin/pages/cancellation', { title: p.title, body: p.body }, { auth: true });
  });
  await t('upload rejects non-images and accepts a real PNG', async () => {
    assert.strictEqual((await call('POST', '/api/admin/upload', { data: Buffer.from('<?php echo 1;').toString('base64') }, { auth: true })).status, 400);
    const png = fs.readFileSync(path.join(__dirname, '..', 'public', 'img', 'beans-wide.jpg')).toString('base64');
    const r = await call('POST', '/api/admin/upload', { data: png }, { auth: true }); assert.strictEqual(r.status, 201);
    const img = await fetch(base + r.json.path); assert.strictEqual(img.status, 200); assert.strictEqual(img.headers.get('content-type'), 'image/jpeg');
  });
  await t('password change: wrong current rejected, short new rejected, valid works', async () => {
    assert.strictEqual((await call('POST', '/api/admin/password', { current: 'nope-nope-nope', next: 'a-long-new-password' }, { auth: true })).status, 403);
    assert.strictEqual((await call('POST', '/api/admin/password', { current: 'correct-horse-battery', next: 'short' }, { auth: true })).status, 400);
    assert.strictEqual((await call('POST', '/api/admin/password', { current: 'correct-horse-battery', next: 'a-long-new-password' }, { auth: true })).status, 200);
  });
  await t('logout invalidates the session', async () => { await call('POST', '/api/admin/logout', {}, { auth: true }); assert.strictEqual((await call('GET', '/api/admin/me', undefined, { auth: true })).status, 401); });
  await t('login is rate limited after repeated failures', async () => { let last; for (let i = 0; i < 10; i++) last = await call('POST', '/api/admin/login', { email: 'test@example.com', password: 'bad-bad-bad-bad' }); assert.strictEqual(last.status, 429); });

  server.close();
  console.log(results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed`);
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

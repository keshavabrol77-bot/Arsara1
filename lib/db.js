'use strict';
// Persistent storage using Node's built-in SQLite (node:sqlite). No third-party dependencies.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });
const db = new DatabaseSync(path.join(DATA_DIR, 'arsara.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  price_paise INTEGER NOT NULL CHECK (price_paise >= 0),
  sale_price_paise INTEGER CHECK (sale_price_paise IS NULL OR sale_price_paise >= 0),
  sku TEXT NOT NULL DEFAULT '',
  pack_size TEXT NOT NULL DEFAULT '',
  weight_g INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  category TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT '{}',
  specs TEXT NOT NULL DEFAULT '[]',
  images TEXT NOT NULL DEFAULT '[]',
  storage_guidance TEXT NOT NULL DEFAULT '',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('active','draft','archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS inventory_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  delta INTEGER NOT NULL,
  stock_after INTEGER NOT NULL,
  reason TEXT NOT NULL,
  admin_email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL UNIQUE,
  items TEXT NOT NULL,
  subtotal_paise INTEGER NOT NULL,
  shipping_paise INTEGER NOT NULL,
  total_paise INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'enquiry_received',
  payment_status TEXT NOT NULL DEFAULT 'unverified',
  payment_note TEXT NOT NULL DEFAULT '',
  customer_name TEXT NOT NULL DEFAULT '',
  customer_phone TEXT NOT NULL DEFAULT '',
  customer_address TEXT NOT NULL DEFAULT '',
  tracking TEXT NOT NULL DEFAULT '',
  refund_note TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  stock_deducted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pages (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
`);

const now = () => new Date().toISOString();

/* ---------- settings ---------- */
const SETTING_DEFAULTS = require('./defaults').settings;

function getSettings() {
  const out = Object.assign({}, SETTING_DEFAULTS);
  for (const r of db.prepare('SELECT key, value FROM settings').all()) {
    try { out[r.key] = JSON.parse(r.value); } catch (_) { /* ignore corrupt row */ }
  }
  return out;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, JSON.stringify(value));
}

/* ---------- products ---------- */
function parseProduct(r) {
  if (!r) return null;
  return Object.assign({}, r, {
    origin: safeJson(r.origin, {}),
    specs: safeJson(r.specs, []),
    images: safeJson(r.images, [])
  });
}
function safeJson(s, fb) { try { return JSON.parse(s); } catch (_) { return fb; } }

function listProducts({ includeAll = false } = {}) {
  const rows = includeAll
    ? db.prepare('SELECT * FROM products ORDER BY sort_order, id').all()
    : db.prepare("SELECT * FROM products WHERE status = 'active' ORDER BY sort_order, id").all();
  return rows.map(parseProduct);
}
function getProductBySlug(slug, { includeAll = false } = {}) {
  const r = db.prepare('SELECT * FROM products WHERE slug = ?').get(slug);
  if (!r || (!includeAll && r.status !== 'active')) return null;
  return parseProduct(r);
}
function getProductById(id) { return parseProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(id)); }

/** Price actually charged per unit, in paise. */
function unitPrice(p) {
  return (p.sale_price_paise != null && p.sale_price_paise < p.price_paise) ? p.sale_price_paise : p.price_paise;
}

function adjustStock(productId, delta, reason, adminEmail) {
  // Atomic: never allows negative stock.
  db.exec('BEGIN IMMEDIATE');
  try {
    const p = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId);
    if (!p) throw new Error('Product not found');
    const after = p.stock + delta;
    if (after < 0) throw new Error('Stock cannot go below zero');
    db.prepare('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?').run(after, now(), productId);
    db.prepare('INSERT INTO inventory_log (product_id, delta, stock_after, reason, admin_email, created_at) VALUES (?,?,?,?,?,?)')
      .run(productId, delta, after, String(reason || '').slice(0, 200), adminEmail || '', now());
    db.exec('COMMIT');
    return after;
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

/* ---------- pages (legal + about + recipe etc.) ---------- */
function getPage(slug) { return db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug) || null; }
function savePage(slug, title, body) {
  db.prepare(`INSERT INTO pages (slug, title, body, updated_at) VALUES (?,?,?,?)
              ON CONFLICT(slug) DO UPDATE SET title = excluded.title, body = excluded.body, updated_at = excluded.updated_at`)
    .run(slug, title, body, now());
}

/* ---------- auth ---------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return 's1$' + salt.toString('hex') + '$' + hash.toString('hex');
}
function verifyPassword(pw, stored) {
  const [v, saltHex, hashHex] = String(stored).split('$');
  if (v !== 's1' || !saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(hashHex, 'hex');
  return expected.length === hash.length && crypto.timingSafeEqual(hash, expected);
}

/* ---------- first-run seed ---------- */
function seed() {
  const defaults = require('./defaults');
  const t = now();
  if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n === 0) {
    const p = defaults.rajma;
    db.prepare(`INSERT INTO products (slug,name,short_description,description,price_paise,sale_price_paise,sku,pack_size,weight_g,stock,low_stock_threshold,category,origin,specs,images,storage_guidance,seo_title,seo_description,status,sort_order,created_at,updated_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(p.slug, p.name, p.short_description, p.description, p.price_paise, null, p.sku, p.pack_size, p.weight_g,
        p.stock, p.low_stock_threshold, p.category, JSON.stringify(p.origin), JSON.stringify(p.specs), JSON.stringify(p.images),
        p.storage_guidance, p.seo_title, p.seo_description, 'active', 0, t, t);
    const id = db.prepare('SELECT id FROM products WHERE slug = ?').get(p.slug).id;
    db.prepare('INSERT INTO inventory_log (product_id, delta, stock_after, reason, admin_email, created_at) VALUES (?,?,?,?,?,?)')
      .run(id, p.stock, p.stock, 'Opening stock (seed value — update to your real count)', 'system', t);
  }
  for (const [slug, pg] of Object.entries(defaults.pages)) {
    if (!getPage(slug)) {
      db.prepare('INSERT INTO pages (slug,title,body,updated_at) VALUES (?,?,?,?)').run(slug, pg.title, pg.body, defaults.CONTENT_DATE);
    }
  }
}

/** Create the first admin from env vars, or generate a one-time password and print it. */
function bootstrapAdmin() {
  if (db.prepare('SELECT COUNT(*) AS n FROM admins').get().n > 0) return null;
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  let pw = process.env.ADMIN_PASSWORD || '';
  let generated = false;
  if (!email) {
    console.warn('[arsara] No admin exists. Set ADMIN_EMAIL (and ADMIN_PASSWORD) and restart to create one.');
    return null;
  }
  if (pw.length < 12) {
    pw = crypto.randomBytes(12).toString('base64url');
    generated = true;
  }
  db.prepare('INSERT INTO admins (email, pass_hash, created_at) VALUES (?,?,?)').run(email, hashPassword(pw), now());
  if (generated) console.log(`[arsara] Admin created: ${email}  one-time password: ${pw}   (change it after first login)`);
  else console.log(`[arsara] Admin created: ${email}`);
  return email;
}

module.exports = {
  db, now, DATA_DIR, getSettings, setSetting, listProducts, getProductBySlug, getProductById, unitPrice,
  adjustStock, getPage, savePage, hashPassword, verifyPassword, seed, bootstrapAdmin, safeJson
};

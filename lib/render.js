'use strict';
// Server-side rendering: layout, icon system, brand SVGs and every public page.
const { formatPaise } = require('../public/js/money');
const { render: md, fill, esc } = require('./md');
const { unitPrice } = require('./db');

/* ------------------------------------------------------------------ icons (Lucide-style, 24px grid, 1.75 stroke) */
const ICONS = {
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  check: '<path d="M21.8 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>',
  whatsapp: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.2 8.6c-.3.5-.3 1.300.3 2.400.8 1.500 1.900 2.400 3.300 3 .9.4 1.500.2 1.900-.3l.3-.6-1.600-.9-.7.6c-.9-.4-1.700-1.200-2.100-2l.6-.7-.8-1.700Z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  instagram: '<rect width="20" height="20" x="2" y="2" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><path d="M17.5 6.5h.01"/>',
  xsocial: '<path d="M4 4l7.2 9.6L4 20h2l6.1-5.5L16.6 20H20l-7.5-10L19.4 4h-2l-5.3 4.9L8 4H4z"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  arrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6M14 11v6"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
  dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>'
};
function icon(name, { size = 20, cls = '', label = '' } = {}) {
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${ICONS[name] || ''}</svg>`;
}

/* ------------------------------------------------------------------ brand SVGs */
function ridgeSvg() {
  const far = 'M0 330 L110 280 L205 318 L330 214 L430 292 L560 178 L690 270 L800 206 L930 300 L1050 226 L1180 308 L1300 246 L1440 316';
  const mid = 'M0 410 L140 340 L260 392 L400 296 L520 384 L660 274 L780 372 L920 306 L1060 392 L1200 318 L1320 380 L1440 336';
  const near = 'M0 486 L160 442 L300 474 L470 410 L640 470 L820 422 L1000 480 L1180 432 L1300 466 L1440 440 V520 H0Z';
  let contours = '';
  for (let k = 1; k <= 5; k++) contours += `<path class="draw" pathLength="1" style="--d:${0.5 + k * 0.12}s" d="${mid}" transform="translate(0 ${k * 15})" opacity="${(0.55 - k * 0.09).toFixed(2)}"/>`;
  return `<svg class="ridge" viewBox="0 0 1440 520" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
    <path class="draw gold" pathLength="1" d="${far}" />
    <path class="ridge-mid" d="${mid} V520 H0Z"/>
    <g class="contours" fill="none">${contours}</g>
    <path class="ridge-near" d="${near}"/>
  </svg>`;
}

/** Deterministic topographic contour illustration (decorative, not a real map). */
function contourSvg(cls = '') {
  let g = '';
  const cx = 300, cy = 290;
  for (let k = 0; k < 9; k++) {
    const R = 28 + k * 27;
    const pts = [];
    const N = 40;
    for (let n = 0; n < N; n++) {
      const a = (n / N) * Math.PI * 2;
      const r = R * (1 + 0.14 * Math.sin(3 * a + 0.6 + k * 0.07) + 0.07 * Math.sin(5 * a + k * 0.35) + 0.04 * Math.sin(8 * a));
      pts.push([cx + Math.cos(a) * r * 1.08 + k * 1.5, cy + Math.sin(a) * r * 0.92]);
    }
    let d = '';
    for (let n = 0; n < N; n++) {
      const p0 = pts[n], p1 = pts[(n + 1) % N];
      const m = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      d += (n === 0 ? `M${m[0].toFixed(1)} ${m[1].toFixed(1)}` : '') + ` Q${p1[0].toFixed(1)} ${p1[1].toFixed(1)} ${(((p1[0] + pts[(n + 2) % N][0]) / 2)).toFixed(1)} ${(((p1[1] + pts[(n + 2) % N][1]) / 2)).toFixed(1)}`;
    }
    g += `<path class="draw" pathLength="1" style="--d:${(k * 0.08).toFixed(2)}s" d="${d}Z" ${k % 4 === 0 ? 'stroke-width="2.4"' : ''}/>`;
  }
  return `<svg class="contour ${cls}" viewBox="-30 -10 700 600" overflow="visible" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.25">${g}</svg>`;
}

function marker(kind) {
  // Small editorial section markers
  const m = {
    peak: '<path d="m3 20 6-11 4 6 3-4 5 9z"/>',
    grain: '<path d="M12 21V8M12 8c-2-1-3-3-3-5 2 0 3 2 3 5ZM12 8c2-1 3-3 3-5-2 0-3 2-3 5ZM12 13c-2-1-4-1-5-3 2-.3 4 .8 5 3ZM12 13c2-1 4-1 5-3-2-.3-4 .8-5 3Z"/>',
    contour: '<path d="M3 17c3-1 4-5 8-5s4 4 10 3M3 12c3-1 4-5 8-5s4 4 10 3"/>'
  }[kind];
  return `<svg class="marker" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${m}</svg>`;
}

/* ------------------------------------------------------------------ helpers */
function stockInfo(p) {
  if (p.stock <= 0) return { state: 'out', label: 'Out of stock' };
  if (p.stock <= p.low_stock_threshold) return { state: 'low', label: `Low stock: only ${p.stock} left` };
  return { state: 'in', label: 'In stock' };
}
const priceHtml = (p) => {
  const u = unitPrice(p);
  return u < p.price_paise
    ? `<span class="price"><s>${formatPaise(p.price_paise)}</s> <strong>${formatPaise(u)}</strong></span>`
    : `<span class="price"><strong>${formatPaise(u)}</strong></span>`;
};
const paras = (t) => String(t || '').split(/\n{2,}/).map((x) => `<p>${esc(x.trim())}</p>`).join('');
const waLink = (s, text) => `https://wa.me/${esc(s.whatsapp)}?text=${encodeURIComponent(text)}`;

/* ------------------------------------------------------------------ layout */
const POLICY_LINKS = [
  ['/terms', 'Terms of Service'],
  ['/privacy', 'Privacy Policy'],
  ['/shipping-policy', 'Shipping & Delivery'],
  ['/returns', 'Returns, Refunds & Replacements'],
  ['/cancellation', 'Cancellation'],
  ['/grievance', 'Contact & Grievance']
];

function layout(ctx, o) {
  const s = ctx.settings;
  const title = o.title ? `${o.title}` : `${s.site_name} | ${s.tagline}`;
  const url = ctx.base + (o.path || '/');
  const desc = o.description || 'ARSARA, premium Himalayan food from Jammu & Kashmir. Born of the Himalayas.';
  const ogImg = ctx.base + (o.ogImage || '/img/og.jpg');
  const nav = [['/shop', 'Shop'], ['/story', 'Our Story'], ['/contact', 'Contact']];
  const cur = o.path || '/';
  const navLinks = (cls) => nav.map(([h, l]) => `<a class="${cls}" href="${h}"${cur === h || (h === '/shop' && cur.startsWith('/product')) ? ' aria-current="page"' : ''}>${l}</a>`).join('');
  const social = [
    s.instagram_url && `<a href="${esc(s.instagram_url)}" rel="noopener noreferrer" target="_blank" aria-label="ARSARA on Instagram ${esc(s.instagram_handle)}">${icon('instagram')}<span>${esc(s.instagram_handle)}</span></a>`,
    s.x_url && `<a href="${esc(s.x_url)}" rel="noopener noreferrer" target="_blank" aria-label="ARSARA on X ${esc(s.x_handle)}">${icon('xsocial')}<span>${esc(s.x_handle)}</span></a>`
  ].filter(Boolean).join('');
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta name="theme-color" content="#612229">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:site_name" content="ARSARA">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(ogImg)}">
<meta name="twitter:card" content="summary_large_image">
${o.noindex ? '<meta name="robots" content="noindex">' : ''}
<link rel="icon" href="${esc(s.emblem_path)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Manrope:wght@400;500;600;700;800&display=swap">
<link rel="stylesheet" href="/css/site.css?v=${ctx.ver}">
<script src="/js/boot.js"></script>
${o.jsonld ? `<script type="application/ld+json">${JSON.stringify(o.jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="${o.bodyClass || ''}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-header" id="top">
  <div class="wrap header-in">
    <a class="brand" href="/" aria-label="ARSARA home"><img src="${esc(s.logo_path)}" alt="ARSARA" width="64" height="63"></a>
    <nav class="nav-desktop" aria-label="Primary">${navLinks('nav-link')}</nav>
    <div class="header-actions">
      <a class="cart-link" href="/cart" aria-label="Cart" data-cart-link>${icon('bag', { size: 22 })}<span class="cart-count" data-cart-count aria-hidden="true">0</span></a>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="mobile-nav" data-menu-open>${icon('menu', { size: 24 })}<span class="sr">Open menu</span></button>
    </div>
  </div>
</header>
<div class="mobile-nav" id="mobile-nav" role="dialog" aria-modal="true" aria-label="Menu" hidden>
  <div class="mobile-nav-in">
    <button class="menu-close" type="button" data-menu-close>${icon('x', { size: 26 })}<span class="sr">Close menu</span></button>
    <nav aria-label="Mobile">${nav.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}<a href="/cart">Cart <span class="cart-count inline" data-cart-count>0</span></a></nav>
    <p class="mobile-nav-note">Born of the Himalayas.</p>
  </div>
</div>
<main id="main" tabindex="-1">
${o.body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <div class="foot-grid">
      <div class="foot-brand">
        <span class="foot-logo"><img src="${esc(s.logo_path)}" alt="ARSARA logo" width="150" height="148" loading="lazy"></span>
        <p>Premium Himalayan food from Jammu &amp; Kashmir. Named honestly, packed simply.</p>
      </div>
      <nav aria-label="Shop and company">
        <h2>Explore</h2>
        <ul><li><a href="/shop">Shop</a></li><li><a href="/product/bhaderwahi-rajma-500g">Bhaderwahi Rajma</a></li><li><a href="/story">Our Story</a></li><li><a href="/contact">Contact</a></li></ul>
      </nav>
      <nav aria-label="Policies">
        <h2>Policies</h2>
        <ul>${POLICY_LINKS.map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join('')}</ul>
      </nav>
      <div>
        <h2>Reach us</h2>
        <ul class="contact-list">
          <li>${icon('whatsapp', { size: 18 })}<a href="${waLink(s, 'Hello ARSARA, I have a question.')}" rel="noopener noreferrer" target="_blank">${esc(s.whatsapp_display)}</a></li>
          <li>${icon('mail', { size: 18 })}<a href="mailto:${esc(s.email)}">${esc(s.email)}</a></li>
          ${s.address ? `<li>${icon('pin', { size: 18 })}<span>${esc(s.address)}</span></li>` : ''}
        </ul>
        <div class="social">${social}</div>
      </div>
    </div>
    <div class="foot-base">
      <p>&copy; ${new Date().getFullYear()} ${esc(s.business_legal_name || 'ARSARA')}. All rights reserved.${s.fssai_number ? ` FSSAI no. ${esc(s.fssai_number)}.` : ''}</p>
      <p class="pay-note">Payment is online only. No cash on delivery.</p>
    </div>
  </div>
</footer>
<div class="toast-region" role="status" aria-live="polite" id="toast-region"></div>
<script src="/js/money.js?v=${ctx.ver}"></script>
<script src="/js/site.js?v=${ctx.ver}" defer></script>
</body>
</html>`;
}

/* ------------------------------------------------------------------ HOME */
function sectionHero(c, s) {
  const lines = String(c.headline || '').replace(/\.$/, '').split(/\s+(?=the\b)/i);
  const l1 = lines[0] || '', l2 = lines.slice(1).join(' ');
  const hl = l2
    ? `<span class="line"><span>${esc(l1)}</span></span><span class="line"><span><em>${esc(l2)}</em>.</span></span>`
    : `<span class="line"><span>${esc(c.headline)}</span></span>`;
  return `<section class="hero" aria-labelledby="hero-h">
  ${ridgeSvg()}
  <div class="wrap hero-grid">
    <div class="hero-copy">
      <p class="eyebrow on-dark" data-reveal>${esc(c.eyebrow)}</p>
      <h1 id="hero-h" class="hero-title">${hl}</h1>
      <p class="hero-lede" data-reveal>${esc(c.body)}</p>
      <div class="cta-row" data-reveal>
        <a class="btn btn-cream" href="${esc(c.cta1_href)}">${esc(c.cta1_label)}${icon('arrow', { size: 18 })}</a>
        <a class="btn btn-ghost-light" href="${esc(c.cta2_href)}">${esc(c.cta2_label)}</a>
      </div>
    </div>
    <div class="hero-plate" aria-hidden="false">
      <div class="logo-plate"><img src="${esc(s.logo_path)}" alt="ARSARA emblem: a mountain above a stalk of grain inside a circle" width="360" height="354" fetchpriority="high"></div>
    </div>
  </div>
</section>`;
}
function sectionOrigin(c) {
  return `<section class="origin" id="origin" aria-labelledby="origin-h">
  <div class="wrap origin-grid">
    <div class="origin-head" data-reveal>
      <p class="eyebrow">${marker('contour')}${esc(c.eyebrow)}</p>
      <h2 id="origin-h" class="display">${esc(c.headline)}</h2>
    </div>
    <div class="origin-art" data-reveal>${contourSvg('c-green')}<span class="place-tag">Bhaderwah<br><small>Jammu &amp; Kashmir</small></span></div>
    <div class="origin-body" data-reveal>
      ${paras(c.body)}
      <figure class="label-strip">
        <img src="/img/label-strip.jpg" alt="Printed on the ARSARA pouch: Bhaderwah Rajma, Authentic Himalayan Origin" width="780" height="160" loading="lazy">
        <figcaption>As printed on the pack</figcaption>
      </figure>
      <a class="btn btn-ink" href="${esc(c.cta_href)}">${esc(c.cta_label)}${icon('arrow', { size: 18 })}</a>
    </div>
  </div>
</section>`;
}
function sectionBean(c) {
  return `<section class="bean" aria-labelledby="bean-h">
  <div class="bean-grid">
    <div class="bean-img" data-mask><img src="/img/beans-macro.jpg" alt="Close view of ARSARA Bhaderwahi Rajma beans: deep burgundy skin, smooth kidney-shaped bodies and pale eyes" width="1020" height="720" loading="lazy"></div>
    <div class="bean-copy">
      <p class="eyebrow on-dark" data-reveal>${esc(c.eyebrow)}</p>
      <h2 id="bean-h" class="display on-dark" data-reveal>${esc(c.headline)}</h2>
      <p class="bean-lede" data-reveal>${esc(c.body)}</p>
      <dl class="traits" data-reveal>
        <div><dt>Colour</dt><dd>Deep burgundy</dd></div>
        <div><dt>Shape</dt><dd>Smooth, kidney-shaped</dd></div>
        <div><dt>Eye</dt><dd>Pale, on the curve</dd></div>
      </dl>
    </div>
  </div>
</section>`;
}
function sectionProduct(c, p) {
  if (!p) return '';
  const st = stockInfo(p);
  const img = (p.images[0] || { src: '/img/pouch.jpg', alt: p.name });
  return `<section class="discover" aria-labelledby="disc-h">
  <div class="wrap discover-grid">
    <a class="discover-img" href="/product/${esc(p.slug)}" data-reveal aria-label="View ${esc(p.name)}">
      <img src="/img/pouch-cut.webp" alt="${esc(img.alt)}" width="700" height="1097" loading="lazy">
    </a>
    <div class="discover-copy" data-reveal>
      <p class="eyebrow">${marker('grain')}${esc(c.eyebrow)}</p>
      <h2 id="disc-h" class="display">${esc(c.headline)}</h2>
      <p class="lede">${esc(c.body)}</p>
      <dl class="spec-ledger">
        <div><dt>Product</dt><dd>${esc(p.name)}</dd></div>
        <div><dt>Pack size</dt><dd>${esc(p.pack_size)}</dd></div>
        <div><dt>Price</dt><dd>${priceHtml(p)}</dd></div>
        <div><dt>Availability</dt><dd><span class="stock stock-${st.state}">${icon(st.state === 'out' ? 'alert' : 'check', { size: 16 })}${esc(st.label)}</span></dd></div>
      </dl>
      <p class="muted small">${esc(p.short_description)}</p>
      <a class="btn btn-burgundy" href="/product/${esc(p.slug)}">${esc(c.cta_label)}${icon('arrow', { size: 18 })}</a>
    </div>
  </div>
</section>`;
}
function sectionKitchen(c, s) {
  const r = s.recipe;
  return `<section class="kitchen" id="kitchen" aria-labelledby="kit-h">
  <div class="wrap">
    <div class="kitchen-head" data-reveal>
      <p class="eyebrow">${marker('peak')}${esc(c.eyebrow)}</p>
      <h2 id="kit-h" class="display">${esc(c.headline)}</h2>
    </div>
    <div class="kitchen-grid">
      <div class="kitchen-aside" data-reveal>
        <div class="recipe-banner" data-mask><img src="/img/beans-wide.jpg" alt="ARSARA rajma beans, ready to soak" width="780" height="265" loading="lazy"></div>
        <h3 class="recipe-title">${esc(r.title)}</h3>
        <p>${esc(r.intro)}</p>
        <ul class="facts"><li>${esc(r.serves)}</li><li>${esc(r.soak)}</li><li>${esc(r.cook)}</li></ul>
        <div class="ingredients">
          <h4>Ingredients</h4>
          <ul>${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
        </div>
      </div>
      <ol class="method" data-reveal>
        ${r.steps.map((st) => `<li><p>${esc(st)}</p></li>`).join('')}
        ${r.note ? `<li class="method-note"><p>${esc(r.note)}</p></li>` : ''}
      </ol>
    </div>
  </div>
</section>`;
}
function sectionPhilosophy(c) {
  const icons = ['peak', 'contour', 'grain'];
  return `<section class="philosophy" aria-labelledby="phil-h">
  <div class="wrap">
    <p class="eyebrow" data-reveal>${esc(c.eyebrow)}</p>
    <h2 id="phil-h" class="display" data-reveal>${esc(c.headline)}</h2>
    <ol class="principles">
      ${c.items.map((it, i) => `<li data-reveal><span class="num">0${i + 1}</span>${marker(icons[i % 3])}<h3>${esc(it.title)}</h3><p>${esc(it.text)}</p></li>`).join('')}
    </ol>
  </div>
</section>`;
}
function sectionFinal(c) {
  return `<section class="final" aria-labelledby="final-h">
  <svg class="final-peaks" viewBox="0 0 1440 200" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path class="draw gold" pathLength="1" d="M0 190 L180 110 L300 160 L520 40 L700 150 L860 70 L1040 160 L1220 90 L1440 170" fill="none"/></svg>
  <div class="wrap final-in">
    <h2 id="final-h" class="display on-dark" data-reveal>${esc(c.headline)}</h2>
    <a class="btn btn-cream" href="${esc(c.cta_href)}" data-reveal>${esc(c.cta_label)}${icon('arrow', { size: 18 })}</a>
  </div>
</section>`;
}

function homePage(ctx, products) {
  const s = ctx.settings;
  const p = products[0];
  const map = { hero: () => sectionHero, origin: () => sectionOrigin, bean: () => sectionBean, product: () => sectionProduct, kitchen: () => sectionKitchen, philosophy: () => sectionPhilosophy, final: () => sectionFinal };
  const body = s.home.filter((c) => c.visible && map[c.id]).map((c) => {
    if (c.id === 'hero') return sectionHero(c, s);
    if (c.id === 'product') return sectionProduct(c, p);
    if (c.id === 'kitchen') return sectionKitchen(c, s);
    return map[c.id]()(c, s);
  }).join('\n');
  return layout(ctx, {
    title: 'ARSARA | Born of the Himalayas',
    description: 'Discover the distinctive character of Bhaderwahi Rajma, rooted in the mountain heritage of Jammu & Kashmir.',
    path: '/', bodyClass: 'home', body,
    jsonld: { '@context': 'https://schema.org', '@type': 'Organization', name: 'ARSARA', url: ctx.base, logo: ctx.base + s.logo_path, email: s.email, sameAs: [s.instagram_url, s.x_url].filter(Boolean) }
  });
}

/* ------------------------------------------------------------------ SHOP / PRODUCT */
function calcWidget(p, s) {
  return `<section class="calc" aria-labelledby="calc-h" data-shipcalc data-unit="${unitPrice(p)}" data-max="${Math.max(0, p.stock)}">
  <h2 id="calc-h">${icon('truck', { size: 20 })} Shipping calculator</h2>
  <div class="calc-row"><label for="calc-qty">Packs</label>
    <div class="qty" role="group" aria-label="Number of packs">
      <button type="button" class="qty-btn" data-calc-dec aria-label="Fewer packs">${icon('minus', { size: 16 })}</button>
      <input id="calc-qty" type="number" min="1" max="${Math.max(1, p.stock)}" value="1" inputmode="numeric" data-calc-qty>
      <button type="button" class="qty-btn" data-calc-inc aria-label="More packs">${icon('plus', { size: 16 })}</button>
    </div>
  </div>
  <dl class="totals">
    <div><dt>Subtotal</dt><dd data-calc-sub>${formatPaise(unitPrice(p))}</dd></div>
    <div><dt>Shipping</dt><dd data-calc-ship>${formatPaise(s.shipping_fee_paise)}</dd></div>
    <div class="grand"><dt>Total payable</dt><dd data-calc-total>${formatPaise(unitPrice(p) + s.shipping_fee_paise)}</dd></div>
  </dl>
  <p class="ship-msg" data-calc-msg></p>
  <p class="small muted">No personal details needed. Free shipping from ${formatPaise(s.free_shipping_threshold_paise)}; otherwise ${formatPaise(s.shipping_fee_paise)}.</p>
</section>`;
}

function shopPage(ctx, products) {
  const s = ctx.settings;
  const items = products.map((p, i) => {
    const st = stockInfo(p);
    const img = p.images[0] || { src: '/img/pouch.jpg', alt: p.name };
    return `<article class="pantry-item ${i % 2 ? 'flip' : ''}" data-reveal>
      <a class="pantry-img" href="/product/${esc(p.slug)}"><img src="${esc(img.src)}" alt="${esc(img.alt)}" width="1000" height="1462" ${i ? 'loading="lazy"' : ''}></a>
      <div class="pantry-info">
        <p class="eyebrow">${esc(p.category)}</p>
        <h2 class="display sm"><a href="/product/${esc(p.slug)}">${esc(p.name)}</a></h2>
        <p>${esc(p.short_description)}</p>
        <p class="pantry-meta"><span>${esc(p.pack_size)}</span>${priceHtml(p)}<span class="stock stock-${st.state}">${icon(st.state === 'out' ? 'alert' : 'check', { size: 16 })}${esc(st.label)}</span></p>
        <div class="cta-row">
          <a class="btn btn-burgundy" href="/product/${esc(p.slug)}">View details${icon('arrow', { size: 18 })}</a>
          <button class="btn btn-ink" type="button" data-add="${esc(p.slug)}" ${p.stock <= 0 ? 'disabled' : ''}>${icon('bag', { size: 18 })}${p.stock <= 0 ? 'Out of stock' : 'Add to cart'}</button>
        </div>
      </div>
    </article>`;
  }).join('');
  const body = `<section class="page-head shop-head"><div class="wrap"><p class="eyebrow">${marker('grain')}The pantry</p><h1 class="display">Shop the Himalayan pantry</h1><p class="lede">One product today. More regional foods from Jammu &amp; Kashmir will join as each is ready.</p></div></section>
<section class="wrap pantry">${items || '<p>No products are available right now.</p>'}</section>
<section class="wrap shop-foot">${products[0] ? calcWidget(products[0], s) : ''}
  <aside class="notice-card"><h2>${icon('shield', { size: 20 })} How ordering works</h2>
  <ul><li>Checkout opens WhatsApp with your order enquiry. That does not complete an order.</li><li>Orders are subject to stock and ARSARA's confirmation.</li><li><strong>Payment is online only. No cash on delivery.</strong></li></ul>
  <p class="small"><a href="/shipping-policy">Shipping</a> · <a href="/returns">Returns</a> · <a href="/privacy">Privacy</a></p></aside>
</section>`;
  return layout(ctx, { title: 'Shop | ARSARA', description: 'Shop ARSARA Bhaderwahi Rajma, 500 g. Shipping flat rate with free shipping above the threshold.', path: '/shop', body });
}

function productPage(ctx, p) {
  const s = ctx.settings;
  const st = stockInfo(p);
  const u = unitPrice(p);
  const imgs = p.images.length ? p.images : [{ src: '/img/pouch.jpg', alt: p.name }];
  const body = `<section class="wrap product" data-product="${esc(p.slug)}" data-stock="${p.stock}">
  <nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/shop">Shop</a><span aria-hidden="true">/</span><span aria-current="page">${esc(p.name)}</span></nav>
  <div class="product-grid">
    <div class="gallery" data-gallery>
      <div class="gallery-main"><img src="${esc(imgs[0].src)}" alt="${esc(imgs[0].alt)}" width="1000" height="1462" data-gallery-main fetchpriority="high"></div>
      ${imgs.length > 1 ? `<div class="thumbs" role="group" aria-label="Product images">${imgs.map((im, i) => `<button type="button" class="thumb" aria-label="Show image ${i + 1} of ${imgs.length}" aria-pressed="${i === 0}" data-thumb data-src="${esc(im.src)}" data-alt="${esc(im.alt)}"><img src="${esc(im.src)}" alt="" width="96" height="96" loading="lazy"></button>`).join('')}</div>` : ''}
    </div>
    <div class="product-info">
      <p class="eyebrow">${esc(p.category)}</p>
      <h1 class="display md">${esc(p.name)}</h1>
      <p class="weight">${esc(p.pack_size)}</p>
      <p class="price-big">${priceHtml(p)} <span class="tax-note">Inclusive of applicable taxes where charged</span></p>
      <p class="stock stock-${st.state}" data-stock-status>${icon(st.state === 'out' ? 'alert' : 'check', { size: 18 })}${esc(st.label)}</p>
      <div class="buy">
        <div class="qty" role="group" aria-label="Quantity">
          <button type="button" class="qty-btn" data-qty-dec aria-label="Decrease quantity" ${p.stock <= 0 ? 'disabled' : ''}>${icon('minus', { size: 16 })}</button>
          <input type="number" min="1" max="${Math.max(1, p.stock)}" value="1" inputmode="numeric" aria-label="Quantity" data-qty ${p.stock <= 0 ? 'disabled' : ''}>
          <button type="button" class="qty-btn" data-qty-inc aria-label="Increase quantity" ${p.stock <= 0 ? 'disabled' : ''}>${icon('plus', { size: 16 })}</button>
        </div>
        <button class="btn btn-burgundy grow" type="button" data-add="${esc(p.slug)}" data-use-qty ${p.stock <= 0 ? 'disabled' : ''}>${icon('bag', { size: 18 })}${p.stock <= 0 ? 'Out of stock' : 'Add to cart'}</button>
      </div>
      <p class="small muted" data-qty-msg role="status"></p>
      <div class="ship-note">${icon('truck', { size: 20 })}<p>Shipping is <strong>${formatPaise(s.shipping_fee_paise)}</strong> on orders below ${formatPaise(s.free_shipping_threshold_paise)}, and <strong>free</strong> from ${formatPaise(s.free_shipping_threshold_paise)}.</p></div>
      <div class="ship-note">${icon('shield', { size: 20 })}<p>Checkout opens WhatsApp. Payment is online only; cash on delivery is not available. Orders are confirmed by ARSARA.</p></div>
      <p class="policy-links small"><a href="/shipping-policy">Shipping</a> · <a href="/returns">Returns &amp; refunds</a> · <a href="/cancellation">Cancellation</a> · <a href="/contact">Support</a></p>
    </div>
  </div>
  <div class="product-detail">
    <section class="pd-col"><h2>About this product</h2>${paras(p.description)}</section>
    <section class="pd-col"><h2>Details</h2><dl class="spec-table">${p.specs.map((x) => `<div><dt>${esc(x.label)}</dt><dd>${esc(x.value)}</dd></div>`).join('')}${p.sku ? `<div><dt>SKU</dt><dd>${esc(p.sku)}</dd></div>` : ''}</dl></section>
    <section class="pd-col"><h2>Origin</h2><p>${esc(p.origin.place || '')}</p><p class="small muted">Origin as marked on the pack.</p>${p.storage_guidance ? `<h2 class="mt">Storage</h2><p>${esc(p.storage_guidance)}</p>` : ''}<p><a class="link-arrow" href="/#kitchen">Cooking guide ${icon('arrow', { size: 16 })}</a></p></section>
  </div>
  <div class="calc-wrap">${calcWidget(p, s)}</div>
</section>`;
  const abs = (x) => (x.startsWith('http') ? x : ctx.base + x);
  return layout(ctx, {
    title: p.seo_title || `${p.name} | ARSARA`,
    description: p.seo_description || p.short_description,
    path: `/product/${p.slug}`, ogType: 'product', ogImage: imgs[0].src, body,
    jsonld: {
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.short_description, sku: p.sku || undefined,
      image: imgs.map((i) => abs(i.src)), brand: { '@type': 'Brand', name: 'ARSARA' },
      offers: { '@type': 'Offer', url: ctx.base + '/product/' + p.slug, priceCurrency: 'INR', price: (u / 100).toFixed(2), availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', itemCondition: 'https://schema.org/NewCondition' }
    }
  });
}

/* ------------------------------------------------------------------ CART */
function cartPage(ctx) {
  const s = ctx.settings;
  const body = `<section class="page-head"><div class="wrap"><p class="eyebrow">${marker('grain')}Your cart</p><h1 class="display md">Cart</h1></div></section>
<section class="wrap cart" data-cart-root>
  <noscript><p class="notice">The cart needs JavaScript. To order without it, message us on <a href="${waLink(s, 'Hello ARSARA, I would like to place an order.')}">WhatsApp</a>.</p></noscript>
  <div class="cart-grid">
    <div class="cart-lines" data-cart-lines aria-live="polite"><p class="muted">Loading your cart…</p></div>
    <aside class="cart-summary" aria-labelledby="sum-h" data-cart-summary hidden>
      <h2 id="sum-h">${icon('truck', { size: 20 })} Order summary</h2>
      <div class="progress" aria-hidden="true"><span data-ship-bar></span></div>
      <p class="ship-msg" data-ship-msg role="status"></p>
      <dl class="totals">
        <div><dt>Merchandise subtotal</dt><dd data-sum-sub>-</dd></div>
        <div><dt>Shipping</dt><dd data-sum-ship>-</dd></div>
        <div class="grand"><dt>Total payable</dt><dd data-sum-total>-</dd></div>
      </dl>
      <div class="pay-box">
        <p><strong>Before you continue</strong></p>
        <ul>
          <li>Opening WhatsApp <strong>does not complete an order</strong>.</li>
          <li>Orders are subject to stock availability and ARSARA's confirmation.</li>
          <li><strong>Payment is online only. Cash on delivery is unavailable.</strong></li>
          <li>Pay only through a payment channel ARSARA confirms to you on this WhatsApp number or email.</li>
        </ul>
      </div>
      <button class="btn btn-whatsapp full" type="button" data-checkout>${icon('whatsapp', { size: 20 })}Send order enquiry on WhatsApp</button>
      <p class="small muted" data-checkout-msg role="alert"></p>
      <p class="small muted privacy-line">Your cart stays in your browser. When you press the button, we record an enquiry reference with your items and amounts only. No name, phone number or address. WhatsApp handles what you send there; see our <a href="/privacy">Privacy Policy</a>.</p>
      <p class="small policy-links"><a href="/shipping-policy">Shipping</a> · <a href="/returns">Returns</a> · <a href="/cancellation">Cancellation</a> · <a href="/terms">Terms</a></p>
    </aside>
  </div>
</section>`;
  return layout(ctx, { title: 'Cart | ARSARA', description: 'Your ARSARA cart.', path: '/cart', noindex: true, body });
}

/* ------------------------------------------------------------------ STORY / CONTACT / POLICY / 404 */
function storyPage(ctx, page) {
  const s = ctx.settings;
  const body = `<section class="story-hero"><svg class="story-ridge" viewBox="0 0 1440 260" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M0 260V190L160 120 280 170 460 70 620 160 800 90 980 170 1160 100 1300 160 1440 120V260Z"/></svg>
  <div class="wrap"><p class="eyebrow on-dark">Our story</p><h1 class="display on-dark">A pantry rooted in the Himalayas.</h1></div></section>
<section class="wrap prose-wrap story-body">
  <div class="story-side"><img src="${esc(s.emblem_path)}" alt="ARSARA emblem" width="220" height="172" loading="lazy"></div>
  <div class="prose">${md(fill(page.body, s))}</div>
</section>
<section class="final small-final"><div class="wrap final-in"><h2 class="display on-dark">Bring a little of the Himalayas home.</h2><a class="btn btn-cream" href="/shop">Explore the Pantry${icon('arrow', { size: 18 })}</a></div></section>`;
  return layout(ctx, { title: 'Our Story | ARSARA', description: 'ARSARA is a food brand inspired by the Himalayan food heritage of Jammu & Kashmir, starting with Bhaderwahi Rajma.', path: '/story', body });
}

function contactPage(ctx) {
  const s = ctx.settings;
  const faqs = [
    ['How do I place an order?', `Add the product to your cart and press the WhatsApp button. Your order enquiry opens in WhatsApp with the items and amounts. We then confirm availability and delivery details, and share a verified payment method. Opening WhatsApp does not complete an order.`],
    ['What does shipping cost?', `${formatPaise(s.shipping_fee_paise)} on orders below ${formatPaise(s.free_shipping_threshold_paise)}, and free from ${formatPaise(s.free_shipping_threshold_paise)} (merchandise subtotal, after discounts and before shipping).`],
    ['Can I pay cash on delivery?', 'No. Payment is online only, through a verified ARSARA payment channel that we confirm to you directly.'],
    ['What if my parcel arrives damaged or incorrect?', `Contact us as soon as you can, ideally within ${s.report_window_hours} hours of delivery, with photos and, if you have one, an unboxing video. See our Returns, Refunds and Replacements Policy.`],
    ['Can I cancel an order?', 'Yes, before dispatch. After dispatch cancellation is not guaranteed. See our Cancellation Policy.']
  ];
  const body = `<section class="page-head"><div class="wrap"><p class="eyebrow">${marker('contour')}Contact</p><h1 class="display md">Talk to ARSARA</h1><p class="lede">The quickest way to reach us is WhatsApp. Email works too.</p></div></section>
<section class="wrap contact-grid">
  <div class="contact-cards">
    <a class="contact-card wa" href="${waLink(s, 'Hello ARSARA, I have a question.')}" rel="noopener noreferrer" target="_blank">${icon('whatsapp', { size: 28 })}<div><h2>WhatsApp</h2><p>${esc(s.whatsapp_display)}</p></div>${icon('arrowUpRight', { size: 20 })}</a>
    <a class="contact-card" href="mailto:${esc(s.email)}">${icon('mail', { size: 28 })}<div><h2>Email</h2><p>${esc(s.email)}</p></div>${icon('arrowUpRight', { size: 20 })}</a>
    ${s.address ? `<div class="contact-card static">${icon('pin', { size: 28 })}<div><h2>Address</h2><p>${esc(s.address)}</p></div></div>` : ''}
    <div class="contact-social">${[s.instagram_url && `<a href="${esc(s.instagram_url)}" rel="noopener noreferrer" target="_blank">${icon('instagram')} ${esc(s.instagram_handle)}</a>`, s.x_url && `<a href="${esc(s.x_url)}" rel="noopener noreferrer" target="_blank">${icon('xsocial')} ${esc(s.x_handle)}</a>`].filter(Boolean).join('')}</div>
    <p class="small muted">For complaints about orders, delivery, payments, refunds or privacy, see <a href="/grievance">Contact &amp; Grievance Information</a>.</p>
  </div>
  <div class="faq">
    <h2>Frequently asked questions</h2>
    ${faqs.map(([q, a]) => `<details><summary>${esc(q)}${icon('plus', { size: 18, cls: 'faq-ico' })}</summary><p>${esc(a)}</p></details>`).join('')}
    <p class="policy-links small"><a href="/shipping-policy">Shipping policy</a> · <a href="/returns">Returns &amp; refunds</a> · <a href="/privacy">Privacy policy</a></p>
  </div>
</section>`;
  return layout(ctx, { title: 'Contact | ARSARA', description: 'Contact ARSARA on WhatsApp or email.', path: '/contact', body });
}

function policyPage(ctx, slug, page, path) {
  const s = ctx.settings;
  const d = new Date(page.updated_at);
  const date = isNaN(d) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
  const body = `<section class="page-head policy-head"><div class="wrap"><p class="eyebrow">${marker('contour')}Policies</p><h1 class="display md">${esc(page.title)}</h1><p class="small muted">Last updated: <time datetime="${esc(page.updated_at.slice(0, 10))}">${esc(date)}</time></p></div></section>
<section class="wrap policy-layout">
  <nav class="policy-nav" aria-label="Policies"><ul>${POLICY_LINKS.map(([h, l]) => `<li><a href="${h}"${h === path ? ' aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul></nav>
  <article class="prose">${md(fill(page.body, s))}</article>
</section>`;
  return layout(ctx, { title: `${page.title} | ARSARA`, description: `${page.title} for ARSARA.`, path, body });
}

function notFoundPage(ctx) {
  return layout(ctx, {
    title: 'Page not found | ARSARA', path: '/404', noindex: true,
    body: `<section class="page-head"><div class="wrap"><p class="eyebrow">404</p><h1 class="display md">This path leads nowhere.</h1><p class="lede">The page you were looking for isn't here.</p><div class="cta-row"><a class="btn btn-burgundy" href="/">Back home</a><a class="btn btn-ink" href="/shop">Shop</a></div></div></section>`
  });
}

module.exports = { layout, homePage, shopPage, productPage, cartPage, storyPage, contactPage, policyPage, notFoundPage, icon, esc, POLICY_LINKS, stockInfo };

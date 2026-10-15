'use strict';
// Minimal, safe Markdown renderer for admin-editable pages (headings, paragraphs, lists, tables, links, emphasis).
// All input is HTML-escaped first, so admin content can never inject markup or script.
const { formatPaise } = require('../public/js/money');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function safeHref(url) {
  const u = String(url).trim();
  if (/^(https?:\/\/|mailto:|tel:)/i.test(u) || u.startsWith('/') || u.startsWith('#')) return u;
  return '#';
}

function inline(text) {
  let t = esc(text);
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const href = safeHref(url.replace(/&amp;/g, '&'));
    const ext = /^https?:/i.test(href) ? ' rel="noopener noreferrer" target="_blank"' : '';
    return `<a href="${esc(href)}"${ext}>${label}</a>`;
  });
  return t;
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function render(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{2,3})\s+(.*?)(?:\s+\{#([a-z0-9-]+)\})?\s*$/))) {
      const lvl = m[1].length;
      const id = m[3] || slugify(m[2]);
      out.push(`<h${lvl} id="${esc(id)}">${inline(m[2])}</h${lvl}>`);
      i++; continue;
    }
    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    if (/^\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push('<div class="table-wrap"><table><thead><tr>' + head.map((h) => `<th scope="col">${inline(h)}</th>`).join('') +
        '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, '')); i++; }
      out.push('<ul>' + items.map((x) => `<li>${inline(x)}</li>`).join('') + '</ul>');
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      out.push('<ol>' + items.map((x) => `<li>${inline(x)}</li>`).join('') + '</ol>');
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,3}\s|---+\s*$|\s*[-*]\s+|\s*\d+\.\s+|\|.*\|\s*$)/.test(lines[i])) { para.push(lines[i]); i++; }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

/** Fill {{placeholders}} from admin settings so policies always match the live shipping and contact values. */
function fill(text, s) {
  const map = {
    business: s.business_legal_name || 'ARSARA',
    email: s.email,
    whatsapp: s.whatsapp_display,
    shipping_fee: formatPaise(s.shipping_fee_paise),
    free_threshold: formatPaise(s.free_shipping_threshold_paise),
    report_hours: String(s.report_window_hours),
    refund_days: s.refund_initiation_days,
    address_line: s.address ? `Business address: ${s.address}. ` : '',
    address_line_list: s.address ? `- **Address:** ${s.address}\n` : '',
    fssai_line: s.fssai_number ? `FSSAI registration/licence no.: ${s.fssai_number}. ` : '',
    grievance_line: s.grievance_officer ? `- **Grievance contact:** ${s.grievance_officer}\n` : ''
  };
  return String(text).replace(/\{\{(\w+)\}\}/g, (m, k) => (k in map ? map[k] : m));
}

module.exports = { render, fill, esc, inline };

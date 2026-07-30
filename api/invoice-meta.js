/**
 * Link-preview shell for shared invoice URLs.
 *
 * The app is a client-rendered SPA, so preview crawlers (WhatsApp, Slack,
 * LinkedIn, iMessage, Telegram) never execute the JS that could set a
 * per-invoice title. They read whatever static index.html returns, which is the
 * generic site card — so every shared invoice previewed identically.
 *
 * vercel.json routes /invoice/:token here ONLY for known crawler user-agents.
 * Real recipients are never served by this function, so the invoice page they
 * open is untouched by it and cannot be broken by it.
 *
 * The preview carries the invoice number and nothing else. A share link gets
 * forwarded into group chats and email threads, and the card is rendered by a
 * third party, so client name, billing details and amounts stay out of it.
 */

const API_BASE = 'https://foxportal.in/api/v1';
const SITE = 'https://foxportal.in';
const OG_IMAGE = `${SITE}/og-image.jpg`;

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

async function fetchInvoiceNumber(token) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const r = await fetch(
      `${API_BASE}/invoices/public/${encodeURIComponent(token)}/meta`,
      { signal: controller.signal }
    );
    if (!r.ok) return null;
    const body = await r.json();
    return body && body.invoice_number ? String(body.invoice_number) : null;
  } catch {
    // Backend slow or down — still return a valid card, just without the number.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ESM export — package.json sets "type": "module", so a CommonJS
// `module.exports` here fails at load with FUNCTION_INVOCATION_FAILED.
export default async function handler(req, res) {
  const token = String((req.query && req.query.token) || '').trim();
  const number = token ? await fetchInvoiceNumber(token) : null;

  const title = number ? `Foxportal Invoice ${number}` : 'Foxportal Invoice';
  const description = number ? `Invoice ${number}` : 'Invoice';
  const canonical = `${SITE}/invoice/${encodeURIComponent(token)}`;

  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const u = escapeHtml(canonical);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // An invoice number never changes once issued, but keep it short so a card
  // built during a backend blip (number omitted) refreshes reasonably soon.
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${u}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${u}" />
    <meta property="og:site_name" content="Fox Portal" />
    <meta property="og:image" content="${OG_IMAGE}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${OG_IMAGE}" />
  </head>
  <body>
    <h1>${t}</h1>
    <p><a href="${u}">Open invoice</a></p>
  </body>
</html>`);
}

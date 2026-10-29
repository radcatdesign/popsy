// Piece inquiries from the site's popup form.
// Sends an email to Brandon through Resend when RESEND_API_KEY is set in the Vercel project.
// Optional: INQUIRY_TO (defaults to brandonmkaufer@gmail.com), INQUIRY_CC (defaults to
// andre@radcat.design; comma-separated for more) and INQUIRY_FROM
// (a sender on a domain verified in Resend, e.g. "Popsy Loves You <hello@popsylovesyou.com>").
// Without a key it answers 501 and the site falls back to opening the visitor's email app.

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const clip = (s, n) => String(s == null ? '' : s).trim().slice(0, n);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  // honeypot: real people never fill this hidden field
  if (body.website) return res.status(200).json({ ok: true });

  const name = clip(body.name, 120);
  const email = clip(body.email, 200);
  const message = clip(body.message, 5000);
  const piece = clip(body.piece, 200) || 'a piece';
  const url = clip(body.url, 300);
  if (!name || !isEmail(email) || !message) {
    return res.status(400).json({ ok: false, error: 'Add your name, a valid email and a message.' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(501).json({ ok: false, error: 'not_configured' });

  const to = process.env.INQUIRY_TO || 'brandonmkaufer@gmail.com';
  const cc = (process.env.INQUIRY_CC || 'andre@radcat.design').split(',').map(x => x.trim()).filter(Boolean);
  const from = process.env.INQUIRY_FROM || 'Popsy Loves You <onboarding@resend.dev>';
  const text = `${message}\n\nFrom: ${name} <${email}>\nPiece: ${piece}${url ? `\nPage: ${url}` : ''}`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], cc, reply_to: email, subject: `Inquiry: ${piece}`, text }),
    });
    if (!r.ok) return res.status(502).json({ ok: false, error: 'send_failed' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'send_failed' });
  }
};

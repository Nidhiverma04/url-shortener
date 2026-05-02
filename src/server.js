const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { initDB, getDB } = require('./database');
const { nanoid } = require('nanoid');
const validUrl = require('valid-url');

const app = express();
const PORT = process.env.PORT || 3000;

function getBaseUrl(req) {
  if (process.env.BASE_URL) return process.env.BASE_URL.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${proto}://${host}`;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Health check — platforms ping this to verify the app is up
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// POST /api/shorten
app.post('/api/shorten', (req, res) => {
  const db = getDB();
  const { url, customAlias } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required.' });
  if (!validUrl.isWebUri(url)) return res.status(400).json({ error: 'Invalid URL. Make sure it starts with http:// or https://' });

  const alias = customAlias ? customAlias.trim().toLowerCase() : nanoid(6);

  if (customAlias) {
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(alias))
      return res.status(400).json({ error: 'Alias must be 3–20 characters: letters, numbers, - or _' });
    const existing = db.prepare('SELECT id FROM links WHERE alias = ?').get(alias);
    if (existing) return res.status(409).json({ error: 'That alias is already taken.' });
  }

  const shortUrl = `${getBaseUrl(req)}/${alias}`.replace(/([^:])\/\//g, '$1/');
  const createdAt = new Date().toISOString();
  db.prepare('INSERT INTO links (alias, original_url, short_url, created_at, clicks) VALUES (?, ?, ?, ?, 0)')
    .run(alias, url, shortUrl, createdAt);
  const link = db.prepare('SELECT * FROM links WHERE alias = ?').get(alias);
  res.json({ alias, shortUrl, originalUrl: url, createdAt, clicks: 0, id: link.id });
});

// GET /api/links
app.get('/api/links', (req, res) => {
  const db = getDB();
  const links = db.prepare('SELECT * FROM links ORDER BY created_at DESC').all();
  res.json(links);
});

// GET /api/links/:alias/stats
app.get('/api/links/:alias/stats', (req, res) => {
  const db = getDB();
  const link = db.prepare('SELECT * FROM links WHERE alias = ?').get(req.params.alias);
  if (!link) return res.status(404).json({ error: 'Link not found.' });
  const clicks = db.prepare('SELECT * FROM clicks WHERE link_id = ? ORDER BY clicked_at DESC LIMIT 100').all(link.id);
  res.json({ ...link, clickDetails: clicks });
});

// DELETE /api/links/:alias
app.delete('/api/links/:alias', (req, res) => {
  const db = getDB();
  const link = db.prepare('SELECT id FROM links WHERE alias = ?').get(req.params.alias);
  if (!link) return res.status(404).json({ error: 'Link not found.' });
  db.prepare('DELETE FROM clicks WHERE link_id = ?').run(link.id);
  db.prepare('DELETE FROM links WHERE alias = ?').run(req.params.alias);
  res.json({ success: true });
});

// Redirect
app.get('/:alias', (req, res) => {
  const db = getDB();
  const { alias } = req.params;
  if (alias === 'favicon.ico') return res.status(404).end();
  const link = db.prepare('SELECT * FROM links WHERE alias = ?').get(alias);
  if (!link) return res.redirect('/?error=not_found');

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  db.prepare('INSERT INTO clicks (link_id, ip, user_agent, referer, clicked_at) VALUES (?, ?, ?, ?, ?)')
    .run(link.id, ip, req.headers['user-agent'] || '', req.headers['referer'] || '', new Date().toISOString());
  db.prepare('UPDATE links SET clicks = clicks + 1 WHERE id = ?').run(link.id);
  res.redirect(301, link.original_url);
});

initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🔗 URL Shortener running`);
    console.log(`   Local: http://localhost:${PORT}`);
    console.log(`   BASE_URL env: ${process.env.BASE_URL || '(auto-detect from request)'}\n`);
  });
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });

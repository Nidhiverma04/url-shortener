# Snip — URL Shortener

A fully deployable URL shortener with click analytics, custom aliases, and a clean dashboard.

## Features

- Shorten any URL with a random or custom alias
- Click tracking with IP, user agent, and referrer logging
- Dashboard with total links, clicks, and per-link stats
- Rate limiting (50 requests / 15 min per IP)
- SQLite database — zero config, no external dependencies
- Deployable to Railway, Render, Fly.io, or any Node.js host

---

## Local Setup

### 1. Install dependencies

```bash
cd url-shortener
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=3000
BASE_URL=http://localhost:3000
```

### 3. Start the server

```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deploy to Railway (recommended — free tier available)

1. Push your project to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Add environment variables in the Railway dashboard:
   - `PORT` → `3000`
   - `BASE_URL` → `https://your-app.railway.app` (Railway gives you a domain)
5. Deploy — Railway auto-detects Node.js and runs `npm start`

> **Important**: Set `BASE_URL` to your Railway domain, or short links will point to localhost.

---

## Deploy to Render

1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service → Connect repo
3. Build command: `npm install`
4. Start command: `node src/server.js`
5. Add env vars: `PORT=10000`, `BASE_URL=https://your-app.onrender.com`

---

## Deploy to Fly.io

```bash
npm install -g flyctl
flyctl auth login
flyctl launch
flyctl secrets set BASE_URL=https://your-app.fly.dev
flyctl deploy
```

---

## Project Structure

```
url-shortener/
├── src/
│   ├── server.js       # Express app, routes, redirect logic
│   └── database.js     # SQLite setup and schema
├── public/
│   ├── index.html      # Single-page frontend
│   ├── css/style.css   # Styles
│   └── js/app.js       # Frontend JS (fetch API calls)
├── data/               # Auto-created — holds links.db
├── .env.example
├── .gitignore
├── Procfile
└── package.json
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shorten` | Create a short link |
| GET | `/api/links` | List all links |
| GET | `/api/links/:alias/stats` | Get click details for a link |
| DELETE | `/api/links/:alias` | Delete a link |
| GET | `/:alias` | Redirect to original URL |

### POST /api/shorten

```json
{
  "url": "https://example.com/very/long/url",
  "customAlias": "my-link"   // optional
}
```

Response:
```json
{
  "alias": "abc123",
  "shortUrl": "https://your-domain.com/abc123",
  "originalUrl": "https://example.com/very/long/url",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "clicks": 0
}
```

---

## Extending the Project

- **Password protection**: Add `express-session` + a simple admin password
- **QR codes**: Use `qrcode` npm package to generate QR on shorten
- **Link expiry**: Add an `expires_at` column and check it on redirect
- **Charts**: Add Chart.js to the dashboard for click-over-time graphs
- **PostgreSQL**: Swap `better-sqlite3` for `pg` for production-scale storage

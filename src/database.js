const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

process.on('unhandledRejection', (err) => {
  console.error('DB init error:', err);
  process.exit(1);
});

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../data/links.db');
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let db;

class SyncDB {
  constructor(sqlDb) { this._db = sqlDb; }

  exec(sql) { this._db.run(sql); this._save(); }

  prepare(sql) {
    const _db = this._db;
    const _save = () => this._save();
    return {
      run(...params) { _db.run(sql, params.flat()); _save(); },
      get(...params) {
        const stmt = _db.prepare(sql);
        stmt.bind(params.flat());
        if (stmt.step()) { const r = stmt.getAsObject(); stmt.free(); return r; }
        stmt.free(); return undefined;
      },
      all(...params) {
        const stmt = _db.prepare(sql);
        stmt.bind(params.flat());
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      }
    };
  }

  pragma(s) { this._db.run(`PRAGMA ${s}`); }

  _save() {
    const data = this._db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }
}

async function initDB() {
  const SQL = await initSqlJs({
    locateFile: file => path.join(__dirname, '../node_modules/sql.js/dist/', file)
  });

  let sqlDb;
  if (fs.existsSync(DB_PATH)) {
    sqlDb = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    sqlDb = new SQL.Database();
  }

  db = new SyncDB(sqlDb);

  db.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alias TEXT UNIQUE NOT NULL,
      original_url TEXT NOT NULL,
      short_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      clicks INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER NOT NULL,
      ip TEXT,
      user_agent TEXT,
      referer TEXT,
      clicked_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_links_alias ON links(alias);
    CREATE INDEX IF NOT EXISTS idx_clicks_link_id ON clicks(link_id);
  `);

  return db;
}

function getDB() { return db; }

module.exports = { initDB, getDB };

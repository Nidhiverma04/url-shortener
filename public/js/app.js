// Update alias prefix to match current host
document.getElementById('aliasPrefix').textContent = window.location.host + '/';

// Tab switching
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  if (tab === 'dashboard') loadDashboard();
}
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Check for error param
const params = new URLSearchParams(window.location.search);
if (params.get('error') === 'not_found') {
  document.getElementById('errorMsg').textContent = 'Short link not found.';
}

// Shorten
document.getElementById('shortenBtn').addEventListener('click', shorten);
document.getElementById('urlInput').addEventListener('keydown', e => { if (e.key === 'Enter') shorten(); });

async function shorten() {
  const url = document.getElementById('urlInput').value.trim();
  const alias = document.getElementById('aliasInput').value.trim();
  const err = document.getElementById('errorMsg');
  const btn = document.getElementById('shortenBtn');
  err.textContent = '';

  if (!url) { err.textContent = 'Please enter a URL.'; return; }

  btn.disabled = true;
  btn.textContent = 'Shortening...';

  try {
    const res = await fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, customAlias: alias || undefined })
    });
    const data = await res.json();
    if (!res.ok) { err.textContent = data.error; return; }
    showResult(data);
  } catch (e) {
    err.textContent = 'Server error. Is the server running?';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Shorten URL →';
  }
}

function showResult(data) {
  document.getElementById('resultUrl').textContent = data.shortUrl;
  document.getElementById('resultUrl').href = data.shortUrl;
  document.getElementById('resultOrig').textContent = '→ ' + data.originalUrl;
  document.getElementById('resultSection').classList.remove('hidden');
  document.getElementById('resultSection').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function resetForm() {
  document.getElementById('urlInput').value = '';
  document.getElementById('aliasInput').value = '';
  document.getElementById('resultSection').classList.add('hidden');
  document.getElementById('errorMsg').textContent = '';
  document.getElementById('urlInput').focus();
}

// Copy button
document.getElementById('copyBtn').addEventListener('click', function() {
  const url = document.getElementById('resultUrl').textContent;
  navigator.clipboard.writeText(url).then(() => {
    this.textContent = 'Copied!';
    this.classList.add('copied');
    setTimeout(() => { this.textContent = 'Copy'; this.classList.remove('copied'); }, 2000);
  });
});

// Dashboard
async function loadDashboard() {
  const list = document.getElementById('linksList');
  list.innerHTML = '<div style="text-align:center;padding:2rem;color:#9A9890;">Loading...</div>';
  try {
    const res = await fetch('/api/links');
    const links = await res.json();

    const total = links.length;
    const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
    const avg = total ? Math.round(totalClicks / total * 10) / 10 : 0;
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statClicks').textContent = totalClicks;
    document.getElementById('statAvg').textContent = avg;

    if (!links.length) {
      list.innerHTML = '<div class="empty-state">No links yet. <button class="link-btn" onclick="switchTab(\'shorten\')">Create your first →</button></div>';
      return;
    }

    list.innerHTML = links.map(l => `
      <div class="link-item" id="item-${l.alias}">
        <div class="link-icon">🔗</div>
        <div class="link-info">
          <a class="link-short" href="${l.short_url}" target="_blank">${l.short_url}</a>
          <div class="link-orig" title="${l.original_url}">${l.original_url}</div>
          <div class="link-meta">${formatDate(l.created_at)}</div>
        </div>
        <div class="link-actions">
          <span class="clicks-badge ${l.clicks > 0 ? 'active' : ''}">${l.clicks} click${l.clicks !== 1 ? 's' : ''}</span>
          <button class="btn-sm" onclick="copyShort('${l.short_url}', this)">Copy</button>
          <button class="btn-sm del" onclick="deleteLink('${l.alias}')">✕</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = '<div class="empty-state" style="color:#D85A30;">Failed to load. Is the server running?</div>';
  }
}

function copyShort(url, btn) {
  navigator.clipboard.writeText(url).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => btn.textContent = 'Copy', 1800);
  });
}

async function deleteLink(alias) {
  if (!confirm(`Delete /${alias}?`)) return;
  await fetch(`/api/links/${alias}`, { method: 'DELETE' });
  document.getElementById('item-' + alias)?.remove();
  loadDashboard();
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

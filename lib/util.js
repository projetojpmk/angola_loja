const crypto = require('crypto');

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kz = (n) => String(Math.floor(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Kz';
const orderCode = () => crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
const token = () => crypto.randomBytes(24).toString('hex');

// limitador simples em memória: máx. `max` pedidos por `windowMs` por chave
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  return list.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();

// Extrai o ID de um link do YouTube (watch?v=, youtu.be/, embed/, shorts/) ou aceita o ID diretamente
function youtubeId(input) {
  const t = String(input || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  const m = t.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#\/]|$)/);
  return m ? m[1] : null;
}

const when = (d) => new Date(d).toLocaleString('pt-PT', { timeZone: 'Africa/Luanda', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
// Data de hoje (AAAA-MM-DD) em Luanda (UTC+1, sem hora de verão)
const todayLuanda = (offsetDays = 0) => new Date(Date.now() + 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);

const STATUS = {
  pending: ['Por pagar', 'warn'], awaiting_review: ['Em análise', 'info'], paid: ['Pago', 'ok'],
  delivered: ['Entregue', 'ok'], failed: ['Falhou a entrega', 'bad'], cancelled: ['Cancelada', 'mute'], expired: ['Expirada', 'mute'],
};

module.exports = { esc, kz, orderCode, token, limited, youtubeId, when, todayLuanda, STATUS };

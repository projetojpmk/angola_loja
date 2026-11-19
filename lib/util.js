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

const STATUS = {
  pending: ['Por pagar', 'warn'], awaiting_review: ['Em análise', 'info'], paid: ['Pago', 'ok'],
  delivered: ['Entregue', 'ok'], failed: ['Falhou a entrega', 'bad'], cancelled: ['Cancelada', 'mute'], expired: ['Expirada', 'mute'],
};

module.exports = { esc, kz, orderCode, token, limited, STATUS };

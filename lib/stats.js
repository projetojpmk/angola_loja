// Números do painel de administração. O dinheiro vem sempre do livro de caixa (store_ledger).
const { q } = require('./db');
const { todayLuanda } = require('./util');

async function sums(from, to) {
  const rows = await q("SELECT kind, COALESCE(SUM(amount_kz),0) AS s, COUNT(*) AS n FROM store_ledger WHERE entry_date BETWEEN ? AND ? GROUP BY kind", [from, to]);
  const r = { in: 0, out: 0, nIn: 0, nOut: 0 };
  for (const x of rows) { if (x.kind === 'in') { r.in = Number(x.s); r.nIn = x.n; } else { r.out = Number(x.s); r.nOut = x.n; } }
  r.net = r.in - r.out;
  return r;
}

async function dashboard() {
  const today = todayLuanda(), d7 = todayLuanda(-6), d30 = todayLuanda(-29);
  const [t, w, m] = await Promise.all([sums(today, today), sums(d7, today), sums(d30, today)]);

  const byDay = await q("SELECT DATE_FORMAT(entry_date, '%Y-%m-%d') AS d, SUM(amount_kz) AS s FROM store_ledger WHERE kind = 'in' AND entry_date >= ? GROUP BY entry_date", [d30]);
  const map = new Map(byDay.map((r) => [r.d, Number(r.s)]));
  const series = [];
  for (let i = 29; i >= 0; i--) { const d = todayLuanda(-i); series.push({ d, v: map.get(d) || 0 }); }

  const top = await q(`SELECT product_name, COUNT(*) AS n, SUM(price_kz) AS s FROM store_orders
                       WHERE status IN ('paid','delivered','failed') AND paid_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                       GROUP BY product_name ORDER BY s DESC LIMIT 5`);
  const st = await q('SELECT status, COUNT(*) AS n FROM store_orders GROUP BY status');
  const status = Object.fromEntries(st.map((r) => [r.status, r.n]));
  const recent = await q('SELECT code, product_name, price_kz, status, created_at FROM store_orders ORDER BY id DESC LIMIT 8');
  return { t, w, m, series, top, status, recent };
}

module.exports = { sums, dashboard };

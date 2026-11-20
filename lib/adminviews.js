// Vistas da área de administração (menu lateral, dashboard, financeiro, logs)
const { esc, kz, when, todayLuanda, STATUS } = require('./util');

const NAV = [
  ['dash', '/admin', 'Dashboard'],
  ['orders', '/admin/encomendas', 'Encomendas'],
  ['products', '/admin/produtos', 'Produtos'],
  ['finance', '/admin/financeiro', 'Financeiro'],
  ['logs', '/admin/logs', 'Logs'],
  ['tutorial', '/admin/tutorial', 'Tutorial'],
];

function shell(active, body, { finance = true, pending = 0 } = {}) {
  const links = NAV.filter(([k]) => finance || k !== 'finance').map(([k, href, label]) =>
    `<a class="${k === active ? 'on' : ''}" href="${href}">${label}${k === 'orders' && pending ? `<b class="dot">${pending}</b>` : ''}</a>`).join('');
  return `<div class="adm"><nav class="side" aria-label="Administração">${links}<a class="out" href="/">← Voltar à loja</a></nav><section class="adm-main">${body}</section></div>`;
}

const badge = (s) => { const [t, c] = STATUS[s] || [s, 'mute']; return `<span class="badge ${c}">${esc(t)}</span>`; };
const kzs = (n) => kz(Math.abs(n));
const sign = (n) => (n < 0 ? '−' : '') + kzs(n);

function chart(series) {
  const W = 720, H = 190, pad = 24, max = Math.max(...series.map((s) => s.v), 1);
  const bw = W / series.length;
  const bars = series.map((s, i) => {
    const h = Math.round((s.v / max) * (H - pad - 8));
    return `<rect x="${(i * bw + 2).toFixed(1)}" y="${H - pad - h}" width="${(bw - 4).toFixed(1)}" height="${Math.max(h, s.v ? 2 : 0)}" rx="3" fill="#2bc0f7"><title>${esc(s.d.split('-').reverse().join('/'))} · ${esc(kz(s.v))}</title></rect>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Entradas por dia, últimos 30 dias">
    <line x1="0" y1="${H - pad}" x2="${W}" y2="${H - pad}" stroke="#28394b"/>
    <text x="0" y="12" fill="#8a9fb2" font-size="11">${esc(kz(max))}</text>
    <text x="0" y="${H - 6}" fill="#8a9fb2" font-size="11">${esc(series[0].d.slice(8) + '/' + series[0].d.slice(5, 7))}</text>
    <text x="${W}" y="${H - 6}" text-anchor="end" fill="#8a9fb2" font-size="11">hoje</text>${bars}</svg>`;
}

function dashboard(d) {
  const kpi = (label, val, sub, cls = '') => `<div class="kpi ${cls}"><span>${esc(label)}</span><b>${val}</b><small>${sub}</small></div>`;
  const s = d.status;
  return `<h1>Dashboard</h1><p class="sub">Resumo da loja · horas de Luanda</p>
  <div class="kpis">
    ${kpi('Entradas hoje', kzs(d.t.in), `${d.t.nIn} registo(s)`)}
    ${kpi('Entradas 7 dias', kzs(d.w.in), `${d.w.nIn} registo(s)`)}
    ${kpi('Entradas 30 dias', kzs(d.m.in), `${d.m.nIn} registo(s)`)}
    ${kpi('Despesas 30 dias', kzs(d.m.out), `${d.m.nOut} registo(s)`)}
    ${kpi('Lucro 30 dias', sign(d.m.net), d.m.net >= 0 ? 'entradas − despesas' : 'a perder dinheiro', d.m.net >= 0 ? 'good' : 'neg')}
  </div>
  <div class="alerts">
    <a class="alert ${s.awaiting_review ? 'warn' : ''}" href="/admin/encomendas?estado=awaiting_review"><b>${s.awaiting_review || 0}</b> por aprovar</a>
    <a class="alert ${s.failed ? 'bad' : ''}" href="/admin/encomendas?estado=failed"><b>${s.failed || 0}</b> entregas falhadas</a>
    <a class="alert" href="/admin/encomendas?estado=paid"><b>${s.paid || 0}</b> a entregar</a>
    <a class="alert" href="/admin/encomendas?estado=pending"><b>${s.pending || 0}</b> por pagar</a>
  </div>
  <div class="box"><h3>Entradas por dia (30 dias)</h3>${chart(d.series)}</div>
  <div class="cols">
    <div class="box"><h3>Mais vendidos (30 dias)</h3>${d.top.length ? `<table>${d.top.map((t) => `<tr><td>${esc(t.product_name)}</td><td>${t.n}×</td><td>${kz(Number(t.s))}</td></tr>`).join('')}</table>` : '<p class="sub">Ainda sem vendas.</p>'}</div>
    <div class="box"><h3>Últimas encomendas</h3>${d.recent.length ? `<table>${d.recent.map((o) => `<tr><td><span class="copy">${esc(o.code)}</span></td><td>${esc(o.product_name)}</td><td>${badge(o.status)}</td></tr>`).join('')}</table>` : '<p class="sub">Sem encomendas.</p>'}</div>
  </div>`;
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const monthLabel = (m) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
const shiftMonth = (m, n) => { const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };

function finance({ m, entries, totals, byCat, csrf, error, form }) {
  const f = form || {};
  const cur = todayLuanda().slice(0, 7);
  const catRows = (kind, title) => {
    const rows = byCat.filter((c) => c.kind === kind);
    return `<div class="box"><h3>${title}</h3>${rows.length ? `<table>${rows.map((c) => `<tr><td>${esc(c.category)}</td><td>${kz(Number(c.s))}</td></tr>`).join('')}</table>` : '<p class="sub">Nada neste mês.</p>'}</div>`;
  };
  return `<h1>Financeiro</h1>
  <div class="row" style="margin:10px 0 18px"><a class="btn dark" href="/admin/financeiro?m=${shiftMonth(m, -1)}">←</a><b style="min-width:150px;text-align:center">${esc(monthLabel(m))}</b>
    ${m < cur ? `<a class="btn dark" href="/admin/financeiro?m=${shiftMonth(m, 1)}">→</a>` : '<span class="btn dark off">→</span>'}
    <a class="btn ghost" href="/admin/financeiro.csv?m=${m}">Exportar CSV</a></div>
  <div class="kpis three">
    <div class="kpi"><span>Entradas</span><b>${kzs(totals.in)}</b><small>${totals.nIn} registo(s)</small></div>
    <div class="kpi"><span>Despesas</span><b>${kzs(totals.out)}</b><small>${totals.nOut} registo(s)</small></div>
    <div class="kpi ${totals.net >= 0 ? 'good' : 'neg'}"><span>Lucro do mês</span><b>${sign(totals.net)}</b><small>entradas − despesas</small></div>
  </div>
  <div class="box"><h3>Novo registo</h3>
  ${error ? `<div class="flash bad">${esc(error)}</div>` : ''}
  <form method="post" action="/admin/financeiro"><input type="hidden" name="_csrf" value="${esc(csrf)}">
    <div class="three-f">
      <div><label for="kind">Tipo</label><select id="kind" name="kind"><option value="in"${f.kind !== 'out' ? ' selected' : ''}>Entrada (dinheiro que recebi)</option><option value="out"${f.kind === 'out' ? ' selected' : ''}>Despesa (dinheiro que gastei)</option></select></div>
      <div><label for="amount">Valor (Kz)</label><input id="amount" type="number" name="amount" min="1" max="1000000000" step="1" value="${esc(f.amount ?? '')}" required></div>
      <div><label for="date">Data</label><input id="date" type="date" name="date" value="${esc(f.date || todayLuanda())}" required></div>
    </div>
    <div class="two"><div><label for="category">Categoria</label><input id="category" type="text" name="category" list="cats" maxlength="40" value="${esc(f.category || '')}" required placeholder="ex.: Hospedagem, Domínio, Publicidade"><datalist id="cats"><option value="Hospedagem"><option value="Domínio"><option value="Publicidade"><option value="Staff / salários"><option value="Doação"><option value="Parceria"><option value="Outros"></datalist></div>
    <div><label for="desc">Descrição (opcional)</label><input id="desc" type="text" name="desc" maxlength="160" value="${esc(f.desc || '')}"></div></div>
    <p style="margin:16px 0 0"><button type="submit">Guardar registo</button></p>
  </form><p class="fine">As vendas da loja entram sozinhas quando o pagamento é aprovado. Aqui registas o resto (despesas, doações, etc.).</p></div>
  <div class="cols">${catRows('in', 'Entradas por categoria')}${catRows('out', 'Despesas por categoria')}</div>
  <h2>Movimentos</h2>
  <div class="tablewrap"><table><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th></th></tr>
  ${entries.map((e) => `<tr><td>${esc(e.d.split('-').reverse().join('/'))}</td><td>${e.kind === 'in' ? '<span class="badge ok">Entrada</span>' : '<span class="badge bad">Despesa</span>'}</td><td>${esc(e.category)}</td><td>${esc(e.description)}</td>
    <td class="${e.kind === 'in' ? 'pos' : 'negt'}">${e.kind === 'in' ? '+' : '−'}${kzs(Number(e.amount_kz))}</td>
    <td>${e.order_id ? '<small>automático</small>' : `<form class="inline" method="post" action="/admin/financeiro/${e.id}/apagar"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button class="danger" type="submit">Apagar</button></form>`}</td></tr>`).join('') || '<tr><td colspan="6">Sem movimentos neste mês.</td></tr>'}</table></div>`;
}

function logs({ rows, kind }) {
  const tabs = [['all', 'Tudo'], ['admin', 'Admin'], ['order', 'Encomendas'], ['system', 'Sistema']];
  return `<h1>Logs</h1><p class="sub">Últimos 200 eventos (guardados 180 dias)</p>
  <div class="row" style="margin:0 0 16px">${tabs.map(([k, t]) => `<a class="btn ${kind === k ? '' : 'ghost'}" href="/admin/logs?tipo=${k}">${t}</a>`).join('')}</div>
  <div class="tablewrap"><table><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Alvo</th><th>Detalhes</th></tr>
  ${rows.map((r) => `<tr><td>${esc(when(r.at))}</td><td>${esc(r.actor)}</td><td><span class="badge ${r.kind === 'admin' ? 'info' : r.kind === 'order' ? 'ok' : 'mute'}">${esc(r.action)}</span></td><td>${esc(r.target)}</td><td>${esc(r.details)}</td></tr>`).join('') || '<tr><td colspan="5">Sem eventos.</td></tr>'}</table></div>`;
}

module.exports = { shell, dashboard, finance, logs };

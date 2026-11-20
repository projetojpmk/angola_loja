const { esc, kz, STATUS } = require('./util');
const { avatarUrl } = require('./discord');
const pay = require('./payments');


// ---------- Arte vetorial (própria, sem imagens externas) ----------
// Definições partilhadas (gradientes) — colocadas uma vez no layout
const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfeaff"/><stop offset="1" stop-color="#6cc8f5"/></linearGradient>
  <linearGradient id="gB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4db8f0"/><stop offset="1" stop-color="#1b86d0"/></linearGradient>
  <linearGradient id="gC" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a8fdc"/><stop offset="1" stop-color="#0d5aa0"/></linearGradient>
  <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b86d0"/><stop offset="1" stop-color="#0a3f7a"/></linearGradient>
</defs></svg>`;

// Um diamante (vista de lado). x/y/size posicionam-no dentro de um quadro de 220x120
function gem(x, y, size) {
  const k = size / 100;
  return `<g transform="translate(${x} ${y}) scale(${k})">
    <polygon points="22,8 78,8 66,34 34,34" fill="url(#gA)"/>
    <polygon points="22,8 34,34 2,34" fill="url(#gB)"/>
    <polygon points="78,8 98,34 66,34" fill="url(#gC)"/>
    <polygon points="2,34 34,34 50,88" fill="url(#gC)"/>
    <polygon points="34,34 66,34 50,88" fill="url(#gB)"/>
    <polygon points="66,34 98,34 50,88" fill="url(#gD)"/>
  </g>`;
}

const TIERS = { imperial: '#1b86d0', supremo: '#12a6b0', elite: '#7b61e0', black: '#2b3542', royal: '#d49a1a' };
const FONT = "'Exo 2','Arial Narrow',Arial,sans-serif";

// Pinceladas de cor nos cantos
const strokes = (c) => `<g fill="none" stroke="${c}" stroke-linecap="round" opacity=".9">
  <path d="M-10 70 Q 30 30 90 -12" stroke-width="12"/><path d="M-12 96 Q 20 66 62 38" stroke-width="5" opacity=".7"/>
  <path d="M312 252 Q 280 282 238 314" stroke-width="12"/><path d="M314 228 Q 292 252 266 272" stroke-width="5" opacity=".7"/></g>`;

const title = (l1, l2, big) => `<text x="150" y="${big ? 86 : 70}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="${big ? 78 : 42}" fill="#0a2038">${esc(l1)}</text>
  <text x="150" y="${big ? 124 : 116}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="${big ? 30 : 50}" fill="#0a2038" textLength="${Math.min(250, l2.length * (big ? 19 : 30))}" lengthAdjust="spacingAndGlyphs">${esc(l2)}</text>`;
const caption = (t) => `<text x="150" y="284" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="11" letter-spacing="1.2" fill="#3b5873">${esc(t)}</text>`;
const frame = (inner) => `<svg viewBox="0 0 300 300" role="img"><defs><linearGradient id="bgArt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef6ff"/><stop offset="1" stop-color="#d9eafb"/></linearGradient></defs><rect width="300" height="300" fill="url(#bgArt)"/>${inner}</svg>`;

function diamondArt(amount) {
  const n = amount <= 100 ? 1 : amount <= 200 ? 2 : amount <= 500 ? 3 : 5;
  const layouts = {
    1: [[70, 14, 80]], 2: [[38, 26, 66], [100, 16, 76]],
    3: [[22, 34, 58], [140, 34, 58], [66, 12, 88]], 5: [[10, 40, 50], [160, 40, 50], [48, 24, 66], [110, 24, 66], [75, 4, 92]],
  };
  return frame(`${strokes('#2b9be6')}${title(String(amount), 'DIAMANTES', true)}
    <g transform="translate(40 142)">${layouts[n].map(([x, y, sz]) => gem(x, y, sz)).join('')}</g>${caption('ENTREGA NO JOGO')}`);
}

function vipArt(tier, days) {
  const c = TIERS[tier] || '#1b86d0';
  return frame(`${strokes(c)}${title('VIP', String(tier || '').toUpperCase(), false)}
    <g transform="translate(100 140) scale(1)">
      <path d="M8 70 L16 26 L40 50 L50 14 L60 50 L84 26 L92 70 Z" fill="${c}"/>
      <rect x="8" y="76" width="84" height="10" rx="3" fill="${c}" opacity=".75"/>
      <circle cx="16" cy="22" r="5" fill="${c}"/><circle cx="50" cy="10" r="5" fill="${c}"/><circle cx="84" cy="22" r="5" fill="${c}"/>
      <path d="M26 66 L50 38 L74 66 Z" fill="#fff" opacity=".22"/></g>${caption('DURAÇÃO DE ' + (Number(days) || 30) + ' DIAS')}`);
}

function productArt(p) {
  const payload = p.payload || {};
  if (p.kind === 'diamonds') return diamondArt(Number(payload.amount) || 100);
  if (p.kind === 'vip') return vipArt(payload.tier, payload.days);
  return diamondArt(100);
}

const badge = (s) => { const [t, c] = STATUS[s] || [s, 'mute']; return `<span class="badge ${c}">${esc(t)}</span>`; };

const I = {
  gem: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z"/></svg>',
  crown: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 18 2 7l5 4 5-8 5 8 5-4-1 11z"/><rect x="3" y="19.5" width="18" height="2" rx="1"/></svg>',
  grid: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  bag: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12l-1 12H7z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
};

function layout({ title, user, csrf, flash, body, q }) {
  const right = user
    ? `${user.admin ? '<a class="btn dark" href="/admin">Admin</a>' : ''}
       <a class="btn dark" href="/encomendas">${I.bag}<span class="hide-s">As minhas compras</span></a>
       <span class="chip"><img src="${esc(avatarUrl(user))}" alt=""><span class="hide-s">${esc(user.name)}</span></span>
       <form class="inline" method="post" action="/logout"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button class="dark" type="submit">Sair</button></form>`
    : `<a class="btn dark" href="/login">${I.user}Entrar</a>`;
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Angola Roleplay</title><link rel="icon" type="image/png" href="/img/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Exo+2:wght@700;800&family=Inter:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/style.css"></head><body>
${DEFS}
<header class="top"><div class="wrap">
  <a class="brand" href="/" aria-label="Angola Roleplay · Loja"><img src="/img/logo-sm.png" alt="Angola Roleplay"></a>
  <form class="search" method="get" action="/" role="search">${I.search}<input type="text" name="q" value="${esc(q || '')}" placeholder="Buscar produto" maxlength="40" aria-label="Buscar produto"></form>
  <div class="right">${right}</div>
</div></header>
<main><div class="wrap">${flash ? `<div class="flash ${esc(flash.type)}">${esc(flash.text)}</div>` : ''}${body}</div></main>
<footer><div class="wrap"><img src="/img/ar.png" alt="" width="40" height="40"><p>Angola Roleplay é um projeto independente e não é afiliado à Take-Two Interactive, à Rockstar North ou a quaisquer titulares de direitos. Pagamentos em Kwanzas (Kz). Dúvidas? Fala com a administração no Discord.</p></div></footer>
</body></html>`;
}

function buyForm(p, csrf, user) {
  if (!user) return `<a class="btn buy" href="/login">${I.bag}Comprar agora</a>`;
  return `<form method="post" action="/comprar/${p.id}"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button class="buy" type="submit">${I.bag}Comprar agora</button></form>`;
}

const CATS = [['todos', 'Todos', I.grid], ['diamantes', 'Diamantes', I.gem], ['vip', 'VIPs', I.crown]];
const ORDER = { diamantes: 0, vip: 1 };

function home({ products, csrf, user, cat, q }) {
  const otherCats = [...new Set(products.map((p) => p.category).filter((c) => !(c in ORDER)))];
  const cats = [...CATS, ...otherCats.map((c) => [c, c.charAt(0).toUpperCase() + c.slice(1), I.grid])];
  const active = cats.some((c) => c[0] === cat) ? cat : 'todos';
  const term = String(q || '').trim().toLowerCase();
  let list = products.filter((p) => (active === 'todos' || p.category === active) && (!term || p.name.toLowerCase().includes(term)));
  list = list.slice().sort((a, b) => (ORDER[a.category] ?? 9) - (ORDER[b.category] ?? 9) || a.sort - b.sort || a.id - b.id);

  const pill = ([key, label, icon]) => `<a class="pill${key === active ? ' on' : ''}" href="/${key === 'todos' ? '' : '?cat=' + encodeURIComponent(key)}">${icon}${esc(label)}</a>`;
  const meta = (p) => p.kind === 'vip' ? `${Number((p.payload || {}).days) || 30} dias` : 'Entrega no jogo';
  const card = (p) => `<article class="card prod"><div class="art">${productArt(p)}</div>
      <div class="body"><h3>${esc(p.name)}</h3><div class="price">${kz(p.price_kz)}</div><div class="muted">${esc(meta(p))}</div>${buyForm(p, csrf, user)}</div></article>`;

  return `<h1 class="big">Categorias</h1>
  <nav class="pills" aria-label="Categorias">${cats.map(pill).join('')}</nav>
  ${term ? `<p class="sub">Resultados para “${esc(q)}”</p>` : ''}
  ${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : '<div class="box">Nenhum produto encontrado.</div>'}`;
}

function needVerify() {
  return `<div class="box"><h1>Falta ligar a tua conta do jogo</h1><p class="sub">Para comprar, o teu Discord tem de estar ligado a uma conta do jogo.</p>
  <p>Vai ao canal de <b>liberação de acesso</b> do nosso Discord, escolhe <b>Liberar ID</b> e depois volta aqui.</p><a class="btn" href="/">Voltar à loja</a></div>`;
}

function orderPage({ o, csrf }) {
  const payload = typeof o.payload === 'string' ? JSON.parse(o.payload) : o.payload;
  const info = pay.instructions();
  let action = '';
  if (o.status === 'pending') {
    action = pay.mode() === 'webhook'
      ? `<div class="box"><h3>Como pagar</h3><p class="sub">Paga por Multicaixa Express/referência usando a referência abaixo. A confirmação é automática.</p>
         ${info.length ? `<dl class="kv">${info.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
         <dl class="kv"><dt>Referência</dt><dd><span class="copy">${esc(o.reference)}</span></dd><dt>Valor</dt><dd><b>${kz(o.price_kz)}</b></dd></dl></div>`
      : `<div class="box"><h3>Como pagar</h3><p class="sub">Faz o pagamento e depois confirma abaixo. Uma pessoa da administração aprova.</p>
         <dl class="kv">${info.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}<dt>Descrição / referência</dt><dd><span class="copy">${esc(o.reference)}</span></dd><dt>Valor</dt><dd><b>${kz(o.price_kz)}</b></dd></dl></div>
         <div class="box"><h3>Já paguei</h3><form method="post" action="/encomenda/${esc(o.code)}/comprovativo"><input type="hidden" name="_csrf" value="${esc(csrf)}">
         <label for="n">Referência da transferência ou link do comprovativo</label><input id="n" name="note" type="text" maxlength="200" required>
         <p style="margin:14px 0 0"><button type="submit">Enviar para aprovação</button></p></form></div>`;
    action += `<form method="post" action="/encomenda/${esc(o.code)}/cancelar"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button class="ghost" type="submit">Cancelar encomenda</button></form>`;
  } else if (o.status === 'awaiting_review') {
    action = '<div class="box">O teu pagamento está em análise. Assim que for aprovado, a entrega é feita no jogo.</div>';
  } else if (o.status === 'paid') {
    action = '<div class="box">Pagamento confirmado. A entrega vai ser feita no jogo dentro de instantes.</div>';
  } else if (o.status === 'delivered') {
    action = '<div class="box">Entregue na tua conta. Obrigado pelo apoio ao servidor!</div>';
  } else if (o.status === 'failed') {
    action = '<div class="box">O pagamento está confirmado, mas a entrega falhou. A administração já foi avisada e vai resolver.</div>';
  }
  return `<h1>Encomenda ${esc(o.code)}</h1><p class="sub">${badge(o.status)}</p>
  <div class="box"><dl class="kv"><dt>Produto</dt><dd>${esc(o.product_name)}</dd><dt>Valor</dt><dd>${kz(o.price_kz)}</dd>
  <dt>ID no jogo</dt><dd>${esc(o.game_id ?? '—')}</dd><dt>Criada</dt><dd>${esc(new Date(o.created_at).toLocaleString('pt-PT'))}</dd>
  ${payload.amount ? `<dt>Diamantes</dt><dd>${esc(payload.amount)}</dd>` : ''}${payload.days ? `<dt>Duração</dt><dd>${esc(payload.days)} dias</dd>` : ''}</dl></div>${action}`;
}

function ordersList({ orders }) {
  if (!orders.length) return '<h1>As minhas encomendas</h1><p class="sub">Ainda não fizeste nenhuma compra.</p><a class="btn" href="/">Ver a loja</a>';
  return `<h1>As minhas encomendas</h1><p class="sub">&nbsp;</p><div class="tablewrap"><table><tr><th>Código</th><th>Produto</th><th>Valor</th><th>Estado</th><th></th></tr>
  ${orders.map((o) => `<tr><td><span class="copy">${esc(o.code)}</span></td><td>${esc(o.product_name)}</td><td>${kz(o.price_kz)}</td><td>${badge(o.status)}</td><td><a href="/encomenda/${esc(o.code)}">Abrir</a></td></tr>`).join('')}</table></div>`;
}

function adminOrders({ orders, filter, csrf }) {
  const tabs = [['awaiting_review', 'Por aprovar'], ['pending', 'Por pagar'], ['failed', 'Falharam'], ['paid', 'A entregar'], ['delivered', 'Entregues'], ['all', 'Todas']];
  const act = (o) => {
    const f = (path, cls, label) => `<form class="inline" method="post" action="/admin/encomenda/${o.id}/${path}"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button class="${cls}" type="submit">${label}</button></form>`;
    if (['pending', 'awaiting_review'].includes(o.status)) return `${f('aprovar', 'ok', 'Aprovar')} ${f('rejeitar', 'danger', 'Rejeitar')}`;
    if (o.status === 'failed') return f('reentregar', '', 'Reentregar');
    return '';
  };
  return `<h1>Encomendas</h1><div class="row" style="margin:10px 0 18px">${tabs.map(([k, t]) => `<a class="btn ${filter === k ? '' : 'ghost'}" href="/admin?estado=${k}">${t}</a>`).join('')}<a class="btn ghost" href="/admin/produtos">Produtos</a></div>
  <div class="tablewrap"><table><tr><th>Código</th><th>Discord</th><th>ID</th><th>Produto</th><th>Valor</th><th>Comprovativo</th><th>Estado</th><th></th></tr>
  ${orders.map((o) => `<tr><td><span class="copy">${esc(o.code)}</span></td><td>${esc(o.discord_user_id)}</td><td>${esc(o.game_id ?? '—')}</td><td>${esc(o.product_name)}</td><td>${kz(o.price_kz)}</td><td>${esc(o.proof_note || '—')}</td><td>${badge(o.status)}${o.admin_note ? `<br><small>${esc(o.admin_note)}</small>` : ''}${o.delivery_error ? `<br><small>${esc(o.delivery_error)}</small>` : ''}</td><td>${act(o)}</td></tr>`).join('') || '<tr><td colspan="8">Nada por aqui.</td></tr>'}</table></div>`;
}

function adminProducts({ products, csrf }) {
  // os campos usam o atributo form="pf<id>" (um <form> não pode ficar dentro de <tr>)
  const rows = products.map((p) => `<tr>
  <td><input form="pf${p.id}" type="text" name="name" value="${esc(p.name)}" maxlength="80"><small>${esc(p.kind)} · ${esc(JSON.stringify(p.payload))}</small></td>
  <td style="width:140px"><input form="pf${p.id}" type="number" name="price_kz" value="${p.price_kz}" min="0" max="10000000"></td>
  <td style="width:110px"><select form="pf${p.id}" name="active"><option value="1"${p.active ? ' selected' : ''}>Sim</option><option value="0"${p.active ? '' : ' selected'}>Não</option></select></td>
  <td><button form="pf${p.id}" type="submit">Guardar</button></td></tr>`).join('');
  const forms = products.map((p) => `<form id="pf${p.id}" method="post" action="/admin/produtos/${p.id}"><input type="hidden" name="_csrf" value="${esc(csrf)}"></form>`).join('');
  return `<h1>Produtos</h1><p class="sub"><a href="/admin">← Encomendas</a></p><div class="tablewrap"><table><tr><th>Produto</th><th>Preço (Kz)</th><th>Ativo</th><th></th></tr>${rows}</table></div>${forms}`;
}

const errorPage = (title, text) => `<div class="box"><h1>${esc(title)}</h1><p class="sub">${esc(text)}</p><a class="btn" href="/">Voltar à loja</a></div>`;

module.exports = { layout, home, needVerify, orderPage, ordersList, adminOrders, adminProducts, errorPage };

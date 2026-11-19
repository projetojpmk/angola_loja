const { esc, kz, STATUS } = require('./util');
const { avatarUrl } = require('./discord');
const pay = require('./payments');

const badge = (s) => { const [t, c] = STATUS[s] || [s, 'mute']; return `<span class="badge ${c}">${esc(t)}</span>`; };

function layout({ title, user, csrf, flash, body }) {
  const nav = user
    ? `<a href="/encomendas">As minhas encomendas</a>${user.admin ? '<a href="/admin">Admin</a>' : ''}
       <span class="chip"><img src="${esc(avatarUrl(user))}" alt="">${esc(user.name)}</span>
       <form class="inline" method="post" action="/logout"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button class="ghost" type="submit">Sair</button></form>`
    : '<a class="btn" href="/login">Entrar com Discord</a>';
  return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Angola Roleplay</title><link rel="stylesheet" href="/style.css"></head><body>
<header class="top"><div class="wrap"><a class="brand" href="/"><i></i>Angola Roleplay · Loja</a><nav>${nav}</nav></div></header>
<main><div class="wrap">${flash ? `<div class="flash ${esc(flash.type)}">${esc(flash.text)}</div>` : ''}${body}</div></main>
<footer><div class="wrap">Angola Roleplay · Todos os pagamentos são em Kwanzas (Kz). Dúvidas? Fala com a administração no Discord.</div></footer>
</body></html>`;
}

function buyForm(p, csrf, user) {
  if (!user) return '<a class="btn" href="/login">Entrar para comprar</a>';
  return `<form method="post" action="/comprar/${p.id}"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button type="submit" style="width:100%">Comprar</button></form>`;
}

function home({ products, csrf, user }) {
  const section = (cat, titulo, texto) => {
    const list = products.filter((p) => p.category === cat);
    if (!list.length) return '';
    return `<h2>${titulo}</h2><p class="sub">${texto}</p><div class="grid">${list.map((p) => `
      <div class="card"><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="price">${kz(p.price_kz)}</div>${buyForm(p, csrf, user)}</div>`).join('')}</div>`;
  };
  const others = products.filter((p) => !['diamantes', 'vip'].includes(p.category));
  return `<div class="hero"><h1>Loja do Angola Roleplay</h1><p>Diamantes e VIPs para a tua conta. Entras com o Discord, pagas em Kz e a entrega é feita no jogo.</p></div>
  ${section('diamantes', 'Diamantes', 'A moeda do servidor.')}${section('vip', 'VIPs', 'Planos por 30 dias.')}
  ${others.length ? section(others[0].category, 'Outros', '') : ''}`;
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

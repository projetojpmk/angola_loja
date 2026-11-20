const { esc, kz, STATUS, youtubeId } = require('./util');
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

function vehicleArt(name) {
  return frame(`${strokes('#2b9be6')}${title('CARRO', String(name || '').toUpperCase().slice(0, 14), false)}
    <g transform="translate(70 150) scale(1)">
      <path d="M4 56 L12 36 Q16 28 28 26 L54 22 Q68 4 88 4 L116 4 Q134 6 144 22 L156 26 Q162 30 162 42 L162 56 Z" fill="#1b86d0"/>
      <path d="M62 22 L74 10 L88 10 L88 22 Z M94 22 L94 10 L114 10 Q124 12 130 22 Z" fill="#d9eafb"/>
      <circle cx="38" cy="56" r="13" fill="#0a2038"/><circle cx="38" cy="56" r="5" fill="#d9eafb"/>
      <circle cx="128" cy="56" r="13" fill="#0a2038"/><circle cx="128" cy="56" r="5" fill="#d9eafb"/></g>${caption('ENTREGA NO JOGO')}`);
}

function houseArt(name) {
  return frame(`${strokes('#2b9be6')}${title('CASA', String(name || '').toUpperCase().slice(0, 14), false)}
    <g transform="translate(100 140) scale(1)">
      <path d="M2 46 L50 4 L98 46 Z" fill="#0d5aa0"/><rect x="12" y="46" width="76" height="40" fill="#1b86d0"/>
      <rect x="42" y="58" width="16" height="28" rx="2" fill="#0a2038"/><rect x="18" y="54" width="16" height="14" rx="2" fill="#d9eafb"/><rect x="66" y="54" width="16" height="14" rx="2" fill="#d9eafb"/></g>${caption('ENTREGA NO JOGO')}`);
}

function productArt(p) {
  if (p.image_url) return `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`;
  const payload = p.payload || {};
  if (p.kind === 'diamonds') return diamondArt(Number(payload.amount) || 100);
  if (p.kind === 'vip') return vipArt(payload.tier, payload.days);
  if (p.kind === 'vehicle') return vehicleArt(p.name);
  if (p.kind === 'house') return houseArt(p.name);
  return diamondArt(100);
}

const CAT_LABEL = { diamantes: 'Diamantes', vip: 'VIPs', carros: 'Carros', casas: 'Casas', outros: 'Outros' };
const KIND_LABEL = { diamonds: 'Diamantes', vip: 'VIP', vehicle: 'Veículo', house: 'Casa', item: 'Item' };
const catName = (c) => CAT_LABEL[c] || (String(c).charAt(0).toUpperCase() + String(c).slice(1));

const badge = (s) => { const [t, c] = STATUS[s] || [s, 'mute']; return `<span class="badge ${c}">${esc(t)}</span>`; };

const I = {
  gem: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M6 3h12l4 6-10 12L2 9z"/></svg>',
  crown: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M3 18 2 7l5 4 5-8 5 8 5-4-1 11z"/><rect x="3" y="19.5" width="18" height="2" rx="1"/></svg>',
  grid: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  bag: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8h12l-1 12H7z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>',
  car: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11h1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1.2a2.3 2.3 0 0 1-4.6 0H9.8a2.3 2.3 0 0 1-4.6 0H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1zm2.1 0h9.8l-1-2.6a.5.5 0 0 0-.5-.4h-6.8a.5.5 0 0 0-.5.4z"/></svg>',
  house: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M12 3 2 12h3v8h5v-5h4v5h5v-8h3z"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
};

function layout({ title, user, csrf, flash, body, q }) {
  const tut = '<a class="navlink" href="/tutorial">Como comprar</a>';
  const right = user
    ? `${tut}${user.admin ? '<a class="btn dark" href="/admin">Admin</a>' : ''}
       <a class="btn dark" href="/encomendas">${I.bag}<span class="hide-s">As minhas compras</span></a>
       <span class="chip"><img src="${esc(avatarUrl(user))}" alt=""><span class="hide-s">${esc(user.name)}</span></span>
       <form class="inline" method="post" action="/logout"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button class="dark" type="submit">Sair</button></form>`
    : `${tut}<a class="btn dark" href="/login">${I.user}Entrar</a>`;
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

const CATS = [['todos', 'Todos', I.grid], ['diamantes', 'Diamantes', I.gem], ['vip', 'VIPs', I.crown], ['carros', 'Carros', I.car], ['casas', 'Casas', I.house]];
const ORDER = { diamantes: 0, vip: 1, carros: 2, casas: 3 };

function metaOf(p) {
  if (p.kind === 'vip') return `${Number((p.payload || {}).days) || 30} dias`;
  return 'Entrega no jogo';
}

function home({ products, cat, q }) {
  const extra = [...new Set(products.map((p) => p.category).filter((c) => !CATS.some((x) => x[0] === c)))];
  const cats = [...CATS, ...extra.map((c) => [c, catName(c), I.grid])];
  const active = cats.some((c) => c[0] === cat) ? cat : 'todos';
  const term = String(q || '').trim().toLowerCase();
  let list = products.filter((p) => (active === 'todos' || p.category === active) && (!term || p.name.toLowerCase().includes(term)));
  list = list.slice().sort((a, b) => (ORDER[a.category] ?? 9) - (ORDER[b.category] ?? 9) || a.sort - b.sort || a.id - b.id);

  const pill = ([key, label, icon]) => `<a class="pill${key === active ? ' on' : ''}" href="/${key === 'todos' ? '' : '?cat=' + encodeURIComponent(key)}">${icon}${esc(label)}</a>`;
  const card = (p) => `<article class="card prod"><a class="art" href="/produto/${esc(p.slug)}" aria-label="${esc(p.name)}">${productArt(p)}</a>
      <div class="body"><h3><a href="/produto/${esc(p.slug)}">${esc(p.name)}</a></h3><div class="price">${kz(p.price_kz)}</div><div class="muted">${esc(metaOf(p))}</div>
      <a class="btn buy" href="/produto/${esc(p.slug)}">${I.bag}Comprar agora</a></div></article>`;
  const empty = term ? 'Nenhum produto encontrado.' : `<b>${esc(catName(active))}</b> — em breve novidades por aqui.`;

  return `<h1 class="big">Categorias</h1>
  <nav class="pills" aria-label="Categorias">${cats.map(pill).join('')}</nav>
  ${term ? `<p class="sub">Resultados para “${esc(q)}”</p>` : ''}
  ${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : `<div class="box empty">${empty}</div>`}`;
}

function productPage({ p, csrf, user }) {
  const lines = String(p.details || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 12);
  const buy = user
    ? `<form method="post" action="/comprar/${p.id}"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button class="buy big-btn" type="submit">${I.bag}Comprar por ${kz(p.price_kz)}</button></form>`
    : `<a class="btn buy big-btn" href="/login?next=${encodeURIComponent('/produto/' + p.slug)}">${I.user}Entrar com Discord para comprar</a>`;
  return `<p class="crumbs"><a href="/">Loja</a> / <a href="/?cat=${encodeURIComponent(p.category)}">${esc(catName(p.category))}</a> / ${esc(p.name)}</p>
  <div class="pdp">
    <div class="pdp-art">${productArt(p)}</div>
    <div class="pdp-info">
      <span class="tag">${esc(KIND_LABEL[p.kind] || catName(p.category))}</span>
      <h1 class="big" style="margin:10px 0 6px">${esc(p.name)}</h1>
      <div class="pdp-price">${kz(p.price_kz)}</div>
      ${p.description ? `<p class="lead">${esc(p.description)}</p>` : ''}
      ${lines.length ? `<ul class="checks">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      ${buy}
      <p class="fine">Pagamento em Kwanzas. Depois de confirmado, a entrega é feita na tua conta do jogo.</p>
    </div>
  </div>
  <h2>Como funciona</h2>
  <p class="sub" style="margin-top:-6px">Primeira vez? <a href="/tutorial">Vê o tutorial em vídeo</a>.</p>
  <ol class="how"><li><b>Compras aqui</b><span>Entras com o Discord e crias a encomenda.</span></li>
  <li><b>Pagas e envias o comprovativo</b><span>Pagas por Multicaixa Express e envias o PDF do comprovativo.</span></li>
  <li><b>Recebes no jogo</b><span>Quando o pagamento é confirmado, a entrega é feita na tua conta.</span></li></ol>`;
}

function tutorialPage({ videoId, isAdmin }) {
  const video = videoId
    ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(videoId)}" title="Como comprar na loja" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
    : `<div class="video empty"><p>O vídeo do tutorial vai estar aqui muito em breve.</p>${isAdmin ? '<p><a class="btn" href="/admin/tutorial">Adicionar o vídeo</a></p>' : ''}</div>`;
  return `<h1 class="big">Como comprar</h1><p class="sub">Vê o vídeo ou segue os passos escritos. Demora poucos minutos.</p>
  ${video}${isAdmin && videoId ? '<p class="fine"><a href="/admin/tutorial">Mudar o vídeo</a></p>' : ''}
  <h2>Passo a passo</h2>
  <ol class="how four"><li><b>Escolhe o produto</b><span>Abre o produto, lê os detalhes e carrega em Comprar. Se ainda não entraste, usa o login do Discord.</span></li>
  <li><b>Paga por Multicaixa Express</b><span>Transfere o valor para o número que aparece na encomenda e escreve a referência no campo <b>Mensagem</b> (opcional).</span></li>
  <li><b>Envia o comprovativo</b><span>No Express, gera o comprovativo em PDF e envia-o na página da encomenda.</span></li>
  <li><b>Recebe no jogo</b><span>Depois de confirmarmos o pagamento, a entrega é feita na tua conta do jogo.</span></li></ol>
  <p style="margin-top:26px"><a class="btn" href="/">Ir para a loja</a></p>`;
}

function adminTutorial({ videoId, csrf, error, value }) {
  return `<h1>Vídeo do tutorial</h1><p class="sub">&nbsp;</p>
  ${error ? `<div class="flash bad">${esc(error)}</div>` : ''}
  <form class="box" method="post" action="/admin/tutorial"><input type="hidden" name="_csrf" value="${esc(csrf)}">
    <label for="u">Link do vídeo do YouTube</label>
    <input id="u" type="text" name="url" value="${esc(value ?? (videoId ? 'https://youtu.be/' + videoId : ''))}" maxlength="200" placeholder="https://youtu.be/xxxxxxxxxxx">
    <p class="fine">Aceita links como <code>youtu.be/…</code>, <code>youtube.com/watch?v=…</code> ou <code>youtube.com/shorts/…</code>. Deixa vazio para esconder o vídeo.</p>
    <p style="margin:16px 0 0"><button type="submit">Guardar</button> <a class="btn ghost" href="/tutorial">Ver a página</a></p></form>`;
}

function needVerify() {
  return `<div class="box"><h1>Falta ligar a tua conta do jogo</h1><p class="sub">Para comprar, o teu Discord tem de estar ligado a uma conta do jogo.</p>
  <p>Vai ao canal de <b>liberação de acesso</b> do nosso Discord, escolhe <b>Liberar ID</b> e depois volta aqui.</p><a class="btn" href="/">Voltar à loja</a></div>`;
}

function orderPage({ o, csrf, proof, product }) {
  const payload = typeof o.payload === 'string' ? JSON.parse(o.payload) : o.payload;
  const stage = { pending: 0, awaiting_review: 1, paid: 2, failed: 2, delivered: 3 }[o.status] ?? 0;
  const steps = ['Pagar', 'Comprovativo', 'Entrega'].map((t, i) => `<li class="${i < stage ? 'done' : i === stage ? 'now' : ''}"><i>${i < stage ? '✓' : i + 1}</i>${t}</li>`).join('');
  const dead = ['cancelled', 'expired'].includes(o.status);
  const art = productArt({ ...(product || {}), name: o.product_name, kind: o.kind, payload });

  const num = pay.expressNumber();
  const payBox = `<div class="box"><h3>1. Paga por Multicaixa Express</h3>
     <dl class="kv" style="margin-top:12px">
       <dt>Número</dt><dd><b class="amount">${esc(num)}</b></dd>
       <dt>Valor</dt><dd><b class="amount">${kz(o.price_kz)}</b></dd>
       <dt>Mensagem / referência</dt><dd><span class="copy">${esc(o.reference)}</span></dd></dl>
     <ol class="mini"><li>Abre o <b>Multicaixa Express</b> e escolhe <b>Transferir</b> para o número acima.</li>
       <li>Escreve o valor exato: <b>${kz(o.price_kz)}</b>.</li>
       <li>No campo <b>Mensagem</b> (aparece como "opcional"), escreve a referência <b>${esc(o.reference)}</b>.</li>
       <li>Confirma o pagamento e depois gera o <b>comprovativo em PDF</b>.</li></ol>
     <p class="fine">A referência na mensagem é o que nos permite confirmar o teu pagamento mais depressa. <a href="/tutorial">Ver o tutorial em vídeo</a></p></div>`;

  let body = '';
  if (dead) body = `<div class="box">Esta encomenda está ${o.status === 'expired' ? 'expirada' : 'cancelada'}. <a href="/">Voltar à loja</a></div>`;
  else if (o.status === 'pending' && pay.mode() === 'webhook') {
    body = `${payBox}<div class="box"><h3>2. Confirmação automática</h3><p class="sub" style="margin:6px 0 0">Assim que o pagamento entrar, a entrega começa sozinha. Podes fechar esta página.</p></div>`;
  } else if (o.status === 'pending') {
    body = `${payBox}<div class="box"><h3>2. Envia o comprovativo</h3>
      <form method="post" enctype="multipart/form-data" action="/encomenda/${esc(o.code)}/comprovativo">
        <input type="hidden" name="_csrf" value="${esc(csrf)}">
        <p class="sub" style="margin:6px 0 0">Depois de pagar, gera o comprovativo no Multicaixa Express e envia-o aqui.</p>
        <label for="f">Comprovativo (PDF, PNG ou JPG, até 3 MB)</label>
        <input id="f" class="file" type="file" name="proof" accept="application/pdf,image/png,image/jpeg" required>
        <label for="n">Nota (opcional)</label><input id="n" name="note" type="text" maxlength="200" placeholder="Ex.: pago pelo Multicaixa Express">
        <p style="margin:16px 0 0"><button type="submit">Enviar para aprovação</button></p></form></div>
      <form method="post" action="/encomenda/${esc(o.code)}/cancelar"><input type="hidden" name="_csrf" value="${esc(csrf)}"><button class="ghost" type="submit">Cancelar encomenda</button></form>`;
  } else if (o.status === 'awaiting_review') {
    body = `<div class="box"><h3>Comprovativo recebido</h3><p class="sub" style="margin:6px 0 0">${proof ? `Ficheiro enviado: <span class="copy">${esc(proof.filename)}</span>. ` : ''}A administração vai confirmar o pagamento e a entrega é feita no jogo.</p></div>`;
  } else if (o.status === 'paid') {
    body = '<div class="box"><h3>Pagamento confirmado</h3><p class="sub" style="margin:6px 0 0">A entrega vai ser feita na tua conta do jogo dentro de instantes.</p></div>';
  } else if (o.status === 'delivered') {
    body = '<div class="box"><h3>Entregue!</h3><p class="sub" style="margin:6px 0 0">Já está na tua conta. Obrigado por apoiares o servidor.</p></div>';
  } else if (o.status === 'failed') {
    body = '<div class="box"><h3>Houve um problema na entrega</h3><p class="sub" style="margin:6px 0 0">O pagamento está confirmado. A administração já foi avisada e vai resolver.</p></div>';
  }

  return `<p class="crumbs"><a href="/encomendas">As minhas compras</a> / ${esc(o.code)}</p>
  <div class="checkout"><div class="co-main">
    <h1>Encomenda ${esc(o.code)}</h1><p class="sub" style="margin-bottom:14px">${badge(o.status)}</p>
    ${dead ? '' : `<ol class="steps">${steps}</ol>`}${body}</div>
    <aside class="co-side"><div class="box sum"><div class="sum-art">${art}</div>
      <h3 style="margin-top:12px">${esc(o.product_name)}</h3>
      <dl class="kv small"><dt>Valor</dt><dd><b>${kz(o.price_kz)}</b></dd><dt>ID no jogo</dt><dd>${esc(o.game_id ?? '—')}</dd>
      ${payload.amount ? `<dt>Diamantes</dt><dd>${esc(payload.amount)}</dd>` : ''}${payload.days ? `<dt>Duração</dt><dd>${esc(payload.days)} dias</dd>` : ''}
      <dt>Criada</dt><dd>${esc(new Date(o.created_at).toLocaleString('pt-PT'))}</dd></dl></div></aside></div>`;
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
  return `<h1>Encomendas</h1><div class="row" style="margin:10px 0 18px">${tabs.map(([k, t]) => `<a class="btn ${filter === k ? '' : 'ghost'}" href="/admin/encomendas?estado=${k}">${t}</a>`).join('')}</div>
  <div class="tablewrap"><table><tr><th>Código</th><th>Discord</th><th>ID</th><th>Produto</th><th>Valor</th><th>Comprovativo</th><th>Estado</th><th></th></tr>
  ${orders.map((o) => `<tr><td><span class="copy">${esc(o.code)}</span></td><td>${esc(o.discord_user_id)}</td><td>${esc(o.game_id ?? '—')}</td><td>${esc(o.product_name)}</td><td>${kz(o.price_kz)}</td><td>${o.has_proof ? `<a href="/admin/comprovativo/${o.id}" target="_blank" rel="noopener">Ver ficheiro</a>` : '—'}${o.proof_note ? `<br><small>${esc(o.proof_note)}</small>` : ''}</td><td>${badge(o.status)}${o.admin_note ? `<br><small>${esc(o.admin_note)}</small>` : ''}${o.delivery_error ? `<br><small>${esc(o.delivery_error)}</small>` : ''}</td><td>${act(o)}</td></tr>`).join('') || '<tr><td colspan="8">Nada por aqui.</td></tr>'}</table></div>`;
}

function adminProducts({ products }) {
  const rows = products.map((p) => `<tr><td><b>${esc(p.name)}</b><br><small>${esc(catName(p.category))} · ${esc(KIND_LABEL[p.kind] || p.kind)}</small></td>
    <td>${kz(p.price_kz)}</td><td>${p.active ? '<span class="badge ok">Ativo</span>' : '<span class="badge mute">Escondido</span>'}</td><td><a class="btn dark" href="/admin/produtos/${p.id}">Editar</a></td></tr>`).join('');
  return `<h1>Produtos</h1><div class="row" style="margin:10px 0 18px"><a class="btn" href="/admin/produtos/novo">Novo produto</a></div>
  <div class="tablewrap"><table><tr><th>Produto</th><th>Preço</th><th>Estado</th><th></th></tr>${rows}</table></div>`;
}

function adminProductForm({ p, csrf, error }) {
  const isNew = !p.id;
  const opt = (v, cur, label) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
  return `<h1>${isNew ? 'Novo produto' : 'Editar produto'}</h1><p class="sub"><a href="/admin/produtos">← Produtos</a></p>
  ${error ? `<div class="flash bad">${esc(error)}</div>` : ''}
  <form class="box" method="post" action="${isNew ? '/admin/produtos/novo' : '/admin/produtos/' + p.id}"><input type="hidden" name="_csrf" value="${esc(csrf)}">
    <label for="name">Nome</label><input id="name" type="text" name="name" value="${esc(p.name)}" maxlength="80" required>
    <div class="two"><div><label for="category">Categoria</label><select id="category" name="category">${['diamantes', 'vip', 'carros', 'casas', 'outros'].map((c) => opt(c, p.category, catName(c))).join('')}</select></div>
    <div><label for="kind">Tipo de entrega</label><select id="kind" name="kind">${['diamonds', 'vip', 'vehicle', 'house', 'item'].map((k) => opt(k, p.kind, KIND_LABEL[k])).join('')}</select></div></div>
    <div class="two"><div><label for="price_kz">Preço (Kz)</label><input id="price_kz" type="number" name="price_kz" value="${esc(p.price_kz)}" min="0" max="10000000" required></div>
    <div><label for="sort">Ordem (menor aparece primeiro)</label><input id="sort" type="number" name="sort" value="${esc(p.sort ?? 0)}"></div></div>
    <label for="description">Descrição curta</label><input id="description" type="text" name="description" value="${esc(p.description)}" maxlength="255">
    <label for="details">Benefícios / detalhes (uma linha por ponto)</label><textarea id="details" name="details" rows="5">${esc(p.details)}</textarea>
    <label for="image_url">Imagem (link https, opcional — se vazio usa a arte automática)</label><input id="image_url" type="text" name="image_url" value="${esc(p.image_url)}" maxlength="500" placeholder="https://i.postimg.cc/...">
    <label for="payload">Dados da entrega (JSON)</label><textarea id="payload" name="payload" rows="3" spellcheck="false">${esc(typeof p.payload === 'string' ? p.payload : JSON.stringify(p.payload || {}))}</textarea>
    <p class="fine">Diamantes: <code>{"amount":100}</code> · VIP: <code>{"tier":"black","days":30}</code> · Carro: <code>{"model":411}</code> · Casa: <code>{"houseId":12}</code> — estes dados são entregues ao resource <b>ar_loja</b>.</p>
    <label for="active">Visível na loja</label><select id="active" name="active">${opt('1', p.active === 0 ? '0' : '1', 'Sim')}${opt('0', p.active === 0 ? '0' : '1', 'Não (escondido)')}</select>
    <p style="margin:20px 0 0"><button type="submit">${isNew ? 'Criar produto' : 'Guardar'}</button></p></form>`;
}

const errorPage = (title, text) => `<div class="box"><h1>${esc(title)}</h1><p class="sub">${esc(text)}</p><a class="btn" href="/">Voltar à loja</a></div>`;

module.exports = { layout, home, productPage, tutorialPage, adminTutorial, needVerify, orderPage, ordersList, adminOrders, adminProducts, adminProductForm, errorPage };

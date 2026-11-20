// Loja do Angola Roleplay
require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const multer = require('multer');
const { q } = require('./lib/db');
const { ensureSchema } = require('./lib/schema');
const { token, limited, esc, youtubeId, todayLuanda } = require('./lib/util');
const discord = require('./lib/discord');
const orders = require('./lib/orders');
const pay = require('./lib/payments');
const V = require('./lib/views');
const AV = require('./lib/adminviews');
const stats = require('./lib/stats');
const { logEvent } = require('./lib/log');

const dbOk = { MYSQL_HOST: process.env.MYSQL_HOST || process.env.MYSQLHOST, MYSQL_USER: process.env.MYSQL_USER || process.env.MYSQLUSER, 'MYSQL_DB': process.env.MYSQL_DB || process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE };
const required = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DISCORD_REDIRECT_URI', 'SESSION_SECRET'];
const missing = [...Object.keys(dbOk).filter((k) => !dbOk[k]), ...required.filter((k) => !process.env[k])];
if (missing.length) { console.error('❌ Faltam variáveis de ambiente:', missing.join(', ')); process.exit(1); }
if (process.env.SESSION_SECRET.length < 24) { console.error('❌ SESSION_SECRET demasiado curto (mín. 24 caracteres).'); process.exit(1); }

// FINANCE_DISCORD_IDS (opcional): só estes IDs veem o Financeiro. Vazio = todos os admins.
const FINANCE = new Set((process.env.FINANCE_DISCORD_IDS || '').split(',').map((x) => x.trim()).filter(Boolean));
const ADMINS = new Set((process.env.ADMIN_DISCORD_IDS || '').split(',').map((s) => s.trim()).filter(Boolean));
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' https: data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'none'; frame-src https://www.youtube-nocookie.com; form-action 'self'; frame-ancestors 'none'",
  });
  next();
});

// Webhook do gateway (corpo cru para verificar a assinatura) — antes dos parsers e da sessão
app.post('/webhook/payment', express.raw({ type: '*/*', limit: '20kb' }), async (req, res) => {
  try {
    if (pay.mode() !== 'webhook') return res.status(404).end();
    if (limited('wh:' + req.ip, 120, 60e3)) return res.status(429).end();
    if (!pay.verifySignature(req.body, req.get('X-Signature'))) return res.status(401).end();
    const evt = pay.parseWebhook(req.body);
    if (!evt || !evt.reference) return res.status(400).end();
    if (!evt.paid) return res.status(200).json({ ok: true, ignored: true });
    const [o] = await q('SELECT id, price_kz, status FROM store_orders WHERE reference = ? LIMIT 1', [evt.reference]);
    if (!o) return res.status(404).json({ ok: false });
    if (!(evt.amount >= o.price_kz)) { console.warn(`⚠️ Webhook com valor insuficiente para ${evt.reference}: ${evt.amount} < ${o.price_kz}`); return res.status(422).json({ ok: false, error: 'amount' }); }
    const changed = await orders.markPaid(o.id, 'Pago via gateway', 'gateway');
    if (changed) console.log(`💰 Encomenda ${evt.reference} paga (gateway).`);
    return res.status(200).json({ ok: true });
  } catch (e) { console.error('Erro no webhook:', e); return res.status(500).end(); }
});

app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieSession({
  name: 'arloja', keys: [process.env.SESSION_SECRET], maxAge: 7 * 24 * 3600e3,
  httpOnly: true, sameSite: 'lax', secure: (process.env.SITE_URL || '').startsWith('https'),
}));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));

app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = token();
  res.locals.csrf = req.session.csrf;
  const u = req.session.user;
  res.locals.user = u ? { ...u, admin: ADMINS.has(u.id), finance: ADMINS.has(u.id) && (!FINANCE.size || FINANCE.has(u.id)) } : null;
  const f = req.session.flash; delete req.session.flash;
  res.locals.flash = f || null;
  if (req.method === 'POST' && !req.is('multipart/form-data') && req.body._csrf !== req.session.csrf) return res.status(403).send('Pedido inválido. Volta atrás e tenta de novo.');
  next();
});

const page = (res, title, body) => res.send(V.layout({ title, user: res.locals.user, csrf: res.locals.csrf, flash: res.locals.flash, body }));
const adminPage = async (res, active, title, body) => {
  const [r] = await q("SELECT COUNT(*) AS n FROM store_orders WHERE status = 'awaiting_review'");
  page(res, title, AV.shell(active, body, { finance: res.locals.user.finance, pending: r.n }));
};
const who = (res) => `${res.locals.user.name} (${res.locals.user.id})`.slice(0, 100);
const flash = (req, type, text) => { req.session.flash = { type, text }; };
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch((e) => { console.error(e); res.status(500); page(res, 'Erro', V.errorPage('Algo correu mal', 'Tenta outra vez dentro de instantes.')); });
const needLogin = (req, res, next) => res.locals.user ? next() : res.redirect('/login');
const needFinance = (req, res, next) => (res.locals.user && res.locals.user.finance) ? next() : res.status(403).send('Sem permissão.');
const needAdmin = (req, res, next) => (res.locals.user && res.locals.user.admin) ? next() : res.status(403).send('Sem permissão.');

// ---------- Público ----------
const parseProducts = (list) => { list.forEach((p) => { if (typeof p.payload === 'string') p.payload = JSON.parse(p.payload); }); return list; };

app.get('/', wrap(async (req, res) => {
  const products = parseProducts(await q('SELECT * FROM store_products WHERE active = 1 ORDER BY category, sort, id'));
  const qs = String(req.query.q || '').slice(0, 40);
  res.send(V.layout({ title: 'Loja', user: res.locals.user, csrf: res.locals.csrf, flash: res.locals.flash, q: qs, body: V.home({ products, cat: String(req.query.cat || 'todos'), q: qs }) }));
}));

app.get('/produto/:slug', wrap(async (req, res) => {
  const [p] = parseProducts(await q('SELECT * FROM store_products WHERE slug = ? AND active = 1', [String(req.params.slug).slice(0, 40)]));
  if (!p) { res.status(404); return page(res, 'Não encontrado', V.errorPage('Produto não encontrado', 'Este produto não existe ou já não está à venda.')); }
  page(res, p.name, V.productPage({ p, csrf: res.locals.csrf, user: res.locals.user }));
}));

const getSetting = async (k) => { const [r] = await q('SELECT v FROM store_settings WHERE k = ?', [k]); return r ? r.v : ''; };

app.get('/tutorial', wrap(async (req, res) => {
  const videoId = youtubeId(await getSetting('tutorial_video'));
  page(res, 'Como comprar', V.tutorialPage({ videoId, isAdmin: !!(res.locals.user && res.locals.user.admin) }));
}));

app.get('/login', (req, res) => {
  const state = token();
  req.session.oauthState = state;
  const next = String(req.query.next || '');
  req.session.next = /^\/[A-Za-z0-9\-_\/?=&%.]*$/.test(next) && !next.startsWith('//') ? next.slice(0, 120) : '/';
  res.redirect(discord.authorizeUrl(state));
});

app.get('/auth/callback', wrap(async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state || state !== req.session.oauthState) { return res.status(400).send('Login inválido. Tenta outra vez.'); }
  delete req.session.oauthState;
  if (limited('login:' + req.ip, 20, 600e3)) return res.status(429).send('Demasiadas tentativas.');
  const u = await discord.exchange(String(code));
  req.session.user = { id: u.id, name: u.name, avatar: u.avatar };
  req.session.csrf = token();
  const go = req.session.next || '/'; delete req.session.next;
  res.redirect(go);
}));

app.post('/logout', (req, res) => { req.session = null; res.redirect('/'); });

// ---------- Compra ----------
app.post('/comprar/:id', needLogin, wrap(async (req, res) => {
  if (limited('buy:' + res.locals.user.id, 10, 600e3)) { flash(req, 'bad', 'Calma! Tenta daqui a uns minutos.'); return res.redirect('/'); }
  const [product] = await q('SELECT * FROM store_products WHERE id = ? AND active = 1', [Number(req.params.id) || 0]);
  if (!product) { flash(req, 'bad', 'Esse produto já não está disponível.'); return res.redirect('/'); }
  if (typeof product.payload === 'string') product.payload = JSON.parse(product.payload);
  const account = await orders.linkedAccount(res.locals.user.id);
  if (!account) return page(res, 'Liga a tua conta', V.needVerify());
  const r = await orders.createOrder(res.locals.user, account, product);
  if (r.error) { flash(req, 'bad', r.error); return res.redirect('/encomendas'); }
  res.redirect('/encomenda/' + r.code);
}));

async function ownOrder(req, res) {
  const [o] = await q('SELECT * FROM store_orders WHERE code = ? AND discord_user_id = ?', [String(req.params.code).slice(0, 12), res.locals.user.id]);
  return o;
}

app.get('/encomenda/:code', needLogin, wrap(async (req, res) => {
  const o = await ownOrder(req, res);
  if (!o) return res.status(404).send('Encomenda não encontrada.');
  const [proof] = await q('SELECT filename, size FROM store_proofs WHERE order_id = ?', [o.id]);
  const [product] = parseProducts(await q('SELECT * FROM store_products WHERE id = ?', [o.product_id]));
  page(res, 'Encomenda ' + o.code, V.orderPage({ o, csrf: res.locals.csrf, proof, product }));
}));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1, fields: 4, parts: 6 } });
app.post('/encomenda/:code/comprovativo', needLogin, (req, res, next) => {
  upload.single('proof')(req, res, (err) => {
    if (err) {
      flash(req, 'bad', err.code === 'LIMIT_FILE_SIZE' ? 'Ficheiro demasiado grande (máximo 3 MB).' : 'Não consegui ler o ficheiro. Tenta outra vez.');
      return res.redirect('/encomenda/' + encodeURIComponent(String(req.params.code).slice(0, 12)));
    }
    next();
  });
}, wrap(async (req, res) => {
  if (pay.mode() !== 'manual') return res.status(404).end();
  if (!req.body || req.body._csrf !== req.session.csrf) return res.status(403).send('Pedido inválido. Volta atrás e tenta de novo.');
  if (limited('proof:' + res.locals.user.id, 8, 600e3)) { flash(req, 'bad', 'Calma! Tenta daqui a uns minutos.'); return res.redirect('/encomendas'); }
  const o = await ownOrder(req, res);
  if (!o) return res.status(404).send('Encomenda não encontrada.');
  if (!req.file) { flash(req, 'bad', 'Escolhe o ficheiro do comprovativo.'); return res.redirect('/encomenda/' + o.code); }
  const r = await orders.saveProof(o, req.file, String(req.body.note || '').trim().slice(0, 200));
  if (r.error) { flash(req, 'bad', r.error); return res.redirect('/encomenda/' + o.code); }
  flash(req, 'ok', 'Comprovativo recebido! A administração vai confirmar o pagamento.');
  res.redirect('/encomenda/' + o.code);
}));

app.post('/encomenda/:code/cancelar', needLogin, wrap(async (req, res) => {
  const o = await ownOrder(req, res);
  if (!o) return res.status(404).send('Encomenda não encontrada.');
  await q("UPDATE store_orders SET status = 'cancelled' WHERE id = ? AND status = 'pending'", [o.id]);
  res.redirect('/encomendas');
}));

app.get('/encomendas', needLogin, wrap(async (req, res) => {
  const list = await q('SELECT * FROM store_orders WHERE discord_user_id = ? ORDER BY id DESC LIMIT 50', [res.locals.user.id]);
  page(res, 'As minhas encomendas', V.ordersList({ orders: list }));
}));

// ---------- Administração ----------
app.get('/admin', needLogin, needAdmin, wrap(async (req, res) => {
  await adminPage(res, 'dash', 'Dashboard', AV.dashboard(await stats.dashboard()));
}));

app.get('/admin/encomendas', needLogin, needAdmin, wrap(async (req, res) => {
  const filter = ['awaiting_review', 'pending', 'failed', 'paid', 'delivered', 'all'].includes(req.query.estado) ? req.query.estado : 'awaiting_review';
  const where = filter === 'all' ? '' : 'WHERE o.status = ?';
  const list = await q(`SELECT o.*, d.error AS delivery_error, (SELECT COUNT(*) FROM store_proofs sp WHERE sp.order_id = o.id) AS has_proof FROM store_orders o LEFT JOIN store_deliveries d ON d.order_id = o.id ${where} ORDER BY o.id DESC LIMIT 100`, filter === 'all' ? [] : [filter]);
  await adminPage(res, 'orders', 'Encomendas', V.adminOrders({ orders: list, filter, csrf: res.locals.csrf }));
}));

app.post('/admin/encomenda/:id/:acao', needLogin, needAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id) || 0;
  const acao = req.params.acao;
  if (acao === 'aprovar') {
    const ok = await orders.markPaid(id, 'Aprovado por ' + who(res), who(res));
    flash(req, ok ? 'ok' : 'bad', ok ? 'Pagamento aprovado. A entrega vai ser feita no jogo.' : 'Esta encomenda já não pode ser aprovada.');
  } else if (acao === 'rejeitar') {
    await q("UPDATE store_orders SET status = 'cancelled', admin_note = ? WHERE id = ? AND status IN ('pending','awaiting_review')", ['Rejeitado por ' + who(res), id]);
    logEvent('admin', who(res), 'rejeitou', '#' + id, '');
    flash(req, 'ok', 'Encomenda rejeitada.');
  } else if (acao === 'reentregar') {
    const ok = await orders.redeliver(id);
    if (ok) logEvent('admin', who(res), 'reentregar', '#' + id, '');
    flash(req, ok ? 'ok' : 'bad', ok ? 'Entrega reposta na fila.' : 'Não havia entrega falhada para repor.');
  }
  res.redirect('/admin/encomendas');
}));

app.get('/admin/tutorial', needLogin, needAdmin, wrap(async (req, res) => {
  await adminPage(res, 'tutorial', 'Tutorial', V.adminTutorial({ videoId: youtubeId(await getSetting('tutorial_video')), csrf: res.locals.csrf }));
}));

app.post('/admin/tutorial', needLogin, needAdmin, wrap(async (req, res) => {
  const raw = String(req.body.url || '').trim().slice(0, 200);
  const id = raw ? youtubeId(raw) : '';
  if (raw && !id) return adminPage(res, 'tutorial', 'Tutorial', V.adminTutorial({ videoId: null, csrf: res.locals.csrf, error: 'Não reconheci esse link do YouTube.', value: raw }));
  await q('INSERT INTO store_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)', ['tutorial_video', id || '']);
  logEvent('admin', who(res), 'tutorial', '', id ? 'vídeo ' + id : 'vídeo removido');
  flash(req, 'ok', id ? 'Vídeo guardado.' : 'Vídeo removido.');
  res.redirect('/admin/tutorial');
}));

app.get('/admin/comprovativo/:id', needLogin, needAdmin, wrap(async (req, res) => {
  const [f] = await q('SELECT filename, mime, data FROM store_proofs WHERE order_id = ?', [Number(req.params.id) || 0]);
  if (!f) return res.status(404).send('Sem comprovativo.');
  res.set({ 'Content-Type': f.mime, 'Content-Disposition': `inline; filename="${String(f.filename).replace(/[^\w.\-]/g, '_')}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'" });
  res.send(f.data);
}));

app.get('/admin/produtos', needLogin, needAdmin, wrap(async (req, res) => {
  const products = await q('SELECT * FROM store_products ORDER BY category, sort, id');
  await adminPage(res, 'products', 'Produtos', V.adminProducts({ products }));
}));

const BLANK = { name: '', category: 'carros', kind: 'vehicle', price_kz: 0, sort: 0, description: '', details: '', image_url: '', payload: '{}', active: 1 };
app.get('/admin/produtos/novo', needLogin, needAdmin, (req, res) => adminPage(res, 'products', 'Novo produto', V.adminProductForm({ p: BLANK, csrf: res.locals.csrf })));

function readProduct(body) {
  const f = {
    name: String(body.name || '').trim().slice(0, 80),
    category: ['diamantes', 'vip', 'carros', 'casas', 'outros'].includes(body.category) ? body.category : 'outros',
    kind: ['diamonds', 'vip', 'vehicle', 'house', 'item'].includes(body.kind) ? body.kind : 'item',
    price_kz: Math.floor(Number(body.price_kz)),
    sort: Math.floor(Number(body.sort)) || 0,
    description: String(body.description || '').trim().slice(0, 255),
    details: String(body.details || '').replace(/\r/g, '').trim().slice(0, 1500),
    image_url: String(body.image_url || '').trim().slice(0, 500),
    active: body.active === '0' ? 0 : 1,
  };
  let error = null;
  let payload = {};
  try { payload = JSON.parse(String(body.payload || '{}')); if (typeof payload !== 'object' || Array.isArray(payload) || payload === null) throw new Error(); } catch { error = 'Os dados da entrega têm de ser um JSON válido, por exemplo {"model":411}.'; }
  if (!f.name) error = 'O nome é obrigatório.';
  else if (!Number.isFinite(f.price_kz) || f.price_kz < 0 || f.price_kz > 10000000) error = 'Preço inválido.';
  else if (f.image_url && !/^https:\/\/\S+$/i.test(f.image_url)) error = 'A imagem tem de ser um link https.';
  f.payload = JSON.stringify(payload);
  return { f, error };
}

const slugify = (n) => n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'produto';

app.post('/admin/produtos/novo', needLogin, needAdmin, wrap(async (req, res) => {
  const { f, error } = readProduct(req.body);
  if (error) return adminPage(res, 'products', 'Novo produto', V.adminProductForm({ p: { ...f }, csrf: res.locals.csrf, error }));
  const base = slugify(f.name);
  for (let i = 0; i < 20; i++) {
    const slug = i ? `${base}-${i + 1}` : base;
    try {
      await q('INSERT INTO store_products (slug, name, category, kind, description, details, image_url, price_kz, payload, active, sort) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [slug, f.name, f.category, f.kind, f.description, f.details || null, f.image_url || null, f.price_kz, f.payload, f.active, f.sort]);
      logEvent('admin', who(res), 'produto criado', f.name, `${f.price_kz} Kz`);
      flash(req, 'ok', 'Produto criado.');
      return res.redirect('/admin/produtos');
    } catch (e) { if (e.code !== 'ER_DUP_ENTRY') throw e; }
  }
  flash(req, 'bad', 'Não consegui criar o produto.'); res.redirect('/admin/produtos');
}));

app.get('/admin/produtos/:id', needLogin, needAdmin, wrap(async (req, res) => {
  const [p] = await q('SELECT * FROM store_products WHERE id = ?', [Number(req.params.id) || 0]);
  if (!p) return res.status(404).send('Produto não encontrado.');
  await adminPage(res, 'products', 'Editar produto', V.adminProductForm({ p, csrf: res.locals.csrf }));
}));

app.post('/admin/produtos/:id', needLogin, needAdmin, wrap(async (req, res) => {
  const id = Number(req.params.id) || 0;
  const { f, error } = readProduct(req.body);
  if (error) return adminPage(res, 'products', 'Editar produto', V.adminProductForm({ p: { ...f, id }, csrf: res.locals.csrf, error }));
  await q('UPDATE store_products SET name=?, category=?, kind=?, description=?, details=?, image_url=?, price_kz=?, payload=?, active=?, sort=? WHERE id=?',
    [f.name, f.category, f.kind, f.description, f.details || null, f.image_url || null, f.price_kz, f.payload, f.active, f.sort, id]);
  logEvent('admin', who(res), 'produto editado', f.name, `${f.price_kz} Kz · ${f.active ? 'visível' : 'escondido'}`);
  flash(req, 'ok', 'Produto guardado.');
  res.redirect('/admin/produtos');
}));

// ---------- Financeiro ----------
const monthOf = (v) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(String(v || '')) ? String(v) : todayLuanda().slice(0, 7));
const monthRange = (m) => { const last = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).getUTCDate(); return [m + '-01', m + '-' + String(last).padStart(2, '0')]; };

async function financeData(m) {
  const [from, to] = monthRange(m);
  const entries = await q("SELECT id, kind, amount_kz, category, description, order_id, DATE_FORMAT(entry_date, '%Y-%m-%d') AS d FROM store_ledger WHERE entry_date BETWEEN ? AND ? ORDER BY entry_date DESC, id DESC LIMIT 1000", [from, to]);
  const byCat = await q("SELECT kind, category, SUM(amount_kz) AS s FROM store_ledger WHERE entry_date BETWEEN ? AND ? GROUP BY kind, category ORDER BY s DESC", [from, to]);
  return { entries, byCat, totals: await stats.sums(from, to) };
}

app.get('/admin/financeiro', needLogin, needFinance, wrap(async (req, res) => {
  const m = monthOf(req.query.m);
  await adminPage(res, 'finance', 'Financeiro', AV.finance({ m, ...(await financeData(m)), csrf: res.locals.csrf }));
}));

app.post('/admin/financeiro', needLogin, needFinance, wrap(async (req, res) => {
  const b = req.body;
  const form = { kind: b.kind === 'out' ? 'out' : 'in', amount: String(b.amount || '').slice(0, 12), date: String(b.date || '').slice(0, 10), category: String(b.category || '').trim().slice(0, 40), desc: String(b.desc || '').trim().slice(0, 160) };
  const amount = Math.floor(Number(form.amount));
  let error = null;
  if (!Number.isFinite(amount) || amount < 1 || amount > 1e9) error = 'Valor inválido.';
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || Number.isNaN(Date.parse(form.date)) || form.date > todayLuanda(1)) error = 'Data inválida.';
  else if (!form.category) error = 'Escolhe ou escreve uma categoria.';
  const m = /^\d{4}-\d{2}-\d{2}$/.test(form.date) ? form.date.slice(0, 7) : todayLuanda().slice(0, 7);
  if (error) return adminPage(res, 'finance', 'Financeiro', AV.finance({ m: monthOf(m), ...(await financeData(monthOf(m))), csrf: res.locals.csrf, error, form }));
  await q('INSERT INTO store_ledger (kind, amount_kz, category, description, entry_date, created_by) VALUES (?,?,?,?,?,?)', [form.kind, amount, form.category, form.desc, form.date, who(res)]);
  logEvent('admin', who(res), form.kind === 'in' ? 'entrada' : 'despesa', form.category, `${amount} Kz · ${form.date}${form.desc ? ' · ' + form.desc : ''}`);
  flash(req, 'ok', form.kind === 'in' ? 'Entrada registada.' : 'Despesa registada.');
  res.redirect('/admin/financeiro?m=' + monthOf(m));
}));

app.post('/admin/financeiro/:id/apagar', needLogin, needFinance, wrap(async (req, res) => {
  const id = Number(req.params.id) || 0;
  const [e] = await q("SELECT kind, amount_kz, category, DATE_FORMAT(entry_date, '%Y-%m-%d') AS d FROM store_ledger WHERE id = ? AND order_id IS NULL", [id]);
  if (e) {
    await q('DELETE FROM store_ledger WHERE id = ? AND order_id IS NULL', [id]);
    logEvent('admin', who(res), 'apagou registo', e.category, `${e.kind === 'in' ? 'entrada' : 'despesa'} ${e.amount_kz} Kz · ${e.d}`);
    flash(req, 'ok', 'Registo apagado.');
  }
  res.redirect('/admin/financeiro' + (e ? '?m=' + e.d.slice(0, 7) : ''));
}));

// CSV (Excel pt usa ';'). Protege contra injeção de fórmulas.
const csvCell = (v) => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
app.get('/admin/financeiro.csv', needLogin, needFinance, wrap(async (req, res) => {
  const m = monthOf(req.query.m);
  const { entries } = await financeData(m);
  const lines = ['Data;Tipo;Categoria;Descricao;Valor_Kz'].concat(entries.map((e) => [e.d, e.kind === 'in' ? 'Entrada' : 'Despesa', e.category, e.description, (e.kind === 'in' ? '' : '-') + e.amount_kz].map(csvCell).join(';')));
  logEvent('admin', who(res), 'exportou CSV', m, '');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="financeiro-${m}.csv"`, 'Cache-Control': 'private, no-store' });
  res.send('﻿' + lines.join('\r\n'));
}));

// ---------- Logs ----------
app.get('/admin/logs', needLogin, needAdmin, wrap(async (req, res) => {
  const kind = ['admin', 'order', 'system'].includes(req.query.tipo) ? req.query.tipo : 'all';
  const rows = await q(`SELECT at, kind, actor, action, target, details FROM store_logs ${kind === 'all' ? '' : 'WHERE kind = ?'} ORDER BY id DESC LIMIT 200`, kind === 'all' ? [] : [kind]);
  await adminPage(res, 'logs', 'Logs', AV.logs({ rows, kind }));
}));

app.use((req, res) => { res.status(404); page(res, 'Não encontrado', V.errorPage('Página não encontrada', 'Essa página não existe.')); });

(async () => {
  await ensureSchema();
  logEvent('system', 'sistema', 'arranque', '', 'Loja iniciada');
  setInterval(() => orders.syncDeliveryStatus().catch((e) => console.error('sync:', e.message)), 10e3);
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`✅ Loja online na porta ${port} (pagamento: ${pay.mode()})`));
})().catch((e) => { console.error('❌ Erro ao arrancar a loja:', e.code || e.message, e.code === 'ETIMEDOUT' || e.code === 'ECONNREFUSED' ? '→ o MYSQL_HOST/MYSQL_PORT estão errados ou o MySQL não aceita ligações do Railway.' : ''); process.exit(1); });

const { pool, q } = require('./db');
const { orderCode } = require('./util');

// Conta do jogo ligada a este Discord (verificação feita no painel de liberar ID)
async function linkedAccount(discordId) {
  const rows = await q(
    `SELECT v.account_id, p.game_id, p.first_name, p.last_name
     FROM discord_verifications v LEFT JOIN discord_profiles p ON p.discord_user_id = v.discord_user_id
     WHERE v.discord_user_id = ? ORDER BY v.account_id LIMIT 1`, [discordId]);
  if (!rows[0]) return null;
  let gameId = rows[0].game_id;
  if (!gameId) {
    const c = await q('SELECT id FROM cache WHERE account = ? LIMIT 1', [rows[0].account_id]).catch(() => []);
    gameId = c[0] && c[0].id;
  }
  return { accountId: Number(rows[0].account_id), gameId: gameId ? Number(gameId) : null, name: rows[0].first_name ? `${rows[0].first_name} ${rows[0].last_name || ''}`.trim() : null };
}

async function createOrder(user, account, product) {
  const open = await q("SELECT COUNT(*) AS n FROM store_orders WHERE discord_user_id = ? AND status IN ('pending','awaiting_review')", [user.id]);
  if (open[0].n >= 5) return { error: 'Tens demasiadas encomendas por pagar. Paga ou cancela alguma primeiro.' };
  for (let i = 0; i < 5; i++) {
    const code = orderCode();
    try {
      await q(`INSERT INTO store_orders (code, discord_user_id, account_id, game_id, product_id, product_name, kind, payload, price_kz, reference)
               VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [code, user.id, account.accountId, account.gameId, product.id, product.name, product.kind, JSON.stringify(product.payload), product.price_kz, 'AR' + code]);
      return { code };
    } catch (e) { if (e.code !== 'ER_DUP_ENTRY') throw e; }
  }
  return { error: 'Não foi possível criar a encomenda. Tenta de novo.' };
}

// Marca como paga e cria a entrega (uma só vez, mesmo com webhooks repetidos)
async function markPaid(orderId, note) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.query(
      "UPDATE store_orders SET status = 'paid', paid_at = NOW(), admin_note = COALESCE(?, admin_note) WHERE id = ? AND status IN ('pending','awaiting_review')", [note || null, orderId]);
    if (!res.affectedRows) { await conn.rollback(); return false; }
    const [[o]] = await conn.query('SELECT account_id, game_id, kind, payload FROM store_orders WHERE id = ?', [orderId]);
    const payload = typeof o.payload === 'string' ? o.payload : JSON.stringify(o.payload);
    await conn.query('INSERT IGNORE INTO store_deliveries (order_id, account_id, game_id, kind, payload) VALUES (?,?,?,?,?)', [orderId, o.account_id, o.game_id, o.kind, payload]);
    await conn.commit();
    return true;
  } catch (e) { await conn.rollback().catch(() => {}); throw e; } finally { conn.release(); }
}

// Mantém o estado da encomenda em sincronia com a entrega feita pelo MTA
async function syncDeliveryStatus() {
  await q(`UPDATE store_orders o JOIN store_deliveries d ON d.order_id = o.id
           SET o.status = 'delivered' WHERE o.status IN ('paid','failed') AND d.status = 'delivered'`);
  await q(`UPDATE store_orders o JOIN store_deliveries d ON d.order_id = o.id
           SET o.status = 'failed' WHERE o.status = 'paid' AND d.status = 'failed'`);
  await q("UPDATE store_orders SET status = 'expired' WHERE status = 'pending' AND created_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)");
}

async function redeliver(orderId) {
  const [res] = await pool.query("UPDATE store_deliveries SET status = 'pending', attempts = 0, error = NULL WHERE order_id = ? AND status = 'failed'", [orderId]);
  if (res.affectedRows) await q("UPDATE store_orders SET status = 'paid' WHERE id = ? AND status = 'failed'", [orderId]);
  return !!res.affectedRows;
}

module.exports = { linkedAccount, createOrder, markPaid, syncDeliveryStatus, redeliver };

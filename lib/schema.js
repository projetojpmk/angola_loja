// Tabelas da loja + produtos de exemplo (só se a tabela de produtos estiver vazia)
const { q } = require('./db');

async function ensureSchema() {
  await q(`CREATE TABLE IF NOT EXISTS store_products (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(40) NOT NULL,
    name VARCHAR(80) NOT NULL,
    category VARCHAR(20) NOT NULL,
    kind VARCHAR(20) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT '',
    price_kz INT UNSIGNED NOT NULL,
    payload JSON NOT NULL,
    active TINYINT UNSIGNED NOT NULL DEFAULT 1,
    sort INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id), UNIQUE KEY uq_slug (slug)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  await q(`CREATE TABLE IF NOT EXISTS store_orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(12) NOT NULL,
    discord_user_id VARCHAR(32) NOT NULL,
    account_id BIGINT UNSIGNED NOT NULL,
    game_id INT UNSIGNED NULL,
    product_id INT UNSIGNED NOT NULL,
    product_name VARCHAR(80) NOT NULL,
    kind VARCHAR(20) NOT NULL,
    payload JSON NOT NULL,
    price_kz INT UNSIGNED NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    reference VARCHAR(24) NOT NULL,
    proof_note VARCHAR(255) NULL,
    admin_note VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME NULL,
    PRIMARY KEY (id), UNIQUE KEY uq_code (code), UNIQUE KEY uq_reference (reference),
    KEY idx_user (discord_user_id, created_at), KEY idx_status (status, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // Fila lida pelo resource MTA ar_loja. status: pending | sending | delivered | failed
  await q(`CREATE TABLE IF NOT EXISTS store_deliveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    account_id BIGINT UNSIGNED NOT NULL,
    game_id INT UNSIGNED NULL,
    kind VARCHAR(20) NOT NULL,
    payload JSON NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'pending',
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    error VARCHAR(120) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id), UNIQUE KEY uq_order (order_id), KEY idx_status (status, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // migrações: descrição longa e imagem própria por produto
  const have = (await q('SHOW COLUMNS FROM store_products')).map((c) => c.Field);
  if (!have.includes('details')) await q('ALTER TABLE store_products ADD COLUMN details TEXT NULL AFTER description');
  if (!have.includes('image_url')) await q('ALTER TABLE store_products ADD COLUMN image_url VARCHAR(500) NULL AFTER details');

  // Definições editáveis no painel (ex.: vídeo do tutorial)
  await q(`CREATE TABLE IF NOT EXISTS store_settings (
    k VARCHAR(40) NOT NULL, v VARCHAR(500) NOT NULL DEFAULT '', PRIMARY KEY (k)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // Comprovativos (PDF/PNG/JPG) guardados na própria base de dados — o disco do Railway não é permanente
  await q(`CREATE TABLE IF NOT EXISTS store_proofs (
    order_id BIGINT UNSIGNED NOT NULL,
    filename VARCHAR(120) NOT NULL,
    mime VARCHAR(40) NOT NULL,
    size INT UNSIGNED NOT NULL,
    data MEDIUMBLOB NOT NULL,
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (order_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  const [{ n }] = await q('SELECT COUNT(*) AS n FROM store_products');
  if (!n) {
    const P = (slug, name, category, kind, description, price, payload, sort) =>
      [slug, name, category, kind, description, price, JSON.stringify(payload), sort];
    const rows = [
      P('diamantes-100', '100 Diamantes', 'diamantes', 'diamonds', 'Pacote inicial', 2000, { amount: 100 }, 10),
      P('diamantes-200', '200 Diamantes', 'diamantes', 'diamonds', 'Pacote médio', 4000, { amount: 200 }, 20),
      // ATENÇÃO: confirma este preço no painel (/admin/produtos)
      P('diamantes-500', '500 Diamantes', 'diamantes', 'diamonds', 'Pacote grande', 10000, { amount: 500 }, 30),
      P('vip-imperial', 'VIP Imperial', 'vip', 'vip', 'Benefícios VIP Imperial por 30 dias', 5000, { tier: 'imperial', days: 30 }, 10),
      P('vip-supremo', 'VIP Supremo', 'vip', 'vip', 'Benefícios VIP Supremo por 30 dias', 8000, { tier: 'supremo', days: 30 }, 20),
      P('vip-elite', 'VIP Elite', 'vip', 'vip', 'Benefícios VIP Elite por 30 dias', 12000, { tier: 'elite', days: 30 }, 30),
      P('vip-black', 'VIP Black', 'vip', 'vip', 'Benefícios VIP Black por 30 dias', 16000, { tier: 'black', days: 30 }, 40),
      P('vip-royal', 'VIP Royal', 'vip', 'vip', 'Benefícios VIP Royal por 30 dias', 20000, { tier: 'royal', days: 30 }, 50),
    ];
    for (const r of rows) {
      await q('INSERT INTO store_products (slug, name, category, kind, description, price_kz, payload, sort) VALUES (?,?,?,?,?,?,?,?)', r);
    }
    console.log('✅ Produtos de exemplo criados.');
  }
  await ensureDetails();
}

// Textos de exemplo (só preenche produtos que ainda não têm detalhes). Edita-os em /admin/produtos
const DEFAULT_DETAILS = {
  'diamantes-100': 'Moeda do servidor, creditada na tua conta\nEntrega depois da confirmação do pagamento\nSem prazo de validade',
  'diamantes-200': 'Moeda do servidor, creditada na tua conta\nEntrega depois da confirmação do pagamento\nSem prazo de validade',
  'diamantes-500': 'Moeda do servidor, creditada na tua conta\nEntrega depois da confirmação do pagamento\nSem prazo de validade',
};
for (const t of ['imperial', 'supremo', 'elite', 'black', 'royal']) {
  DEFAULT_DETAILS['vip-' + t] = 'Duração de 30 dias\nAtivado na tua conta do jogo\nEntrega depois da confirmação do pagamento';
}
async function ensureDetails() {
  for (const [slug, text] of Object.entries(DEFAULT_DETAILS)) {
    await q('UPDATE store_products SET details = ? WHERE slug = ? AND details IS NULL', [text, slug]);
  }
}

module.exports = { ensureSchema, ensureDetails };

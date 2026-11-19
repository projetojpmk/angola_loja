// Pagamentos. Dois modos (PAYMENT_MODE):
//  - manual : mostramos os dados de pagamento; o jogador envia a referência da transferência e um admin aprova.
//  - webhook: um gateway (Multicaixa Express/referência) chama POST /webhook/payment e a aprovação é automática.
// O formato do webhook é genérico; ao escolher o gateway adapta-se aqui (verifySignature / parseWebhook).
const crypto = require('crypto');

const mode = () => (process.env.PAYMENT_MODE === 'webhook' ? 'webhook' : 'manual');

function instructions() {
  const f = [];
  if (process.env.PAY_ENTITY) f.push(['Entidade', process.env.PAY_ENTITY]);
  if (process.env.PAY_IBAN) f.push(['IBAN', process.env.PAY_IBAN]);
  if (process.env.PAY_EXPRESS_NUMBER) f.push(['Multicaixa Express', process.env.PAY_EXPRESS_NUMBER]);
  if (process.env.PAY_HOLDER) f.push(['Titular', process.env.PAY_HOLDER]);
  return f;
}

function verifySignature(rawBody, signature) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(signature).replace(/^sha256=/, ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Corpo esperado: { "reference": "AR1A2B3C4D", "status": "paid", "amount": 2000 }
function parseWebhook(rawBody) {
  try {
    const j = JSON.parse(rawBody.toString('utf8'));
    return { reference: String(j.reference || ''), paid: String(j.status).toLowerCase() === 'paid', amount: Number(j.amount) };
  } catch { return null; }
}

module.exports = { mode, instructions, verifySignature, parseWebhook };

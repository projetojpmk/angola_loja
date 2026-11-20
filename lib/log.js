// Registo de eventos (aparece em /admin/logs). Nunca deve partir o fluxo principal.
const { q } = require('./db');

// kind: admin | order | system
async function logEvent(kind, actor, action, target, details) {
  try {
    await q('INSERT INTO store_logs (kind, actor, action, target, details) VALUES (?,?,?,?,?)',
      [kind, String(actor || 'sistema').slice(0, 100), String(action).slice(0, 40), String(target || '').slice(0, 60), String(details || '').slice(0, 255)]);
  } catch (e) { console.error('log:', e.message); }
}

module.exports = { logEvent };

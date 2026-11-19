// Login com Discord (OAuth2, scope "identify")
const API = 'https://discord.com/api';

function authorizeUrl(state) {
  const p = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state,
    prompt: 'none',
  });
  return `${API}/oauth2/authorize?${p}`;
}

async function exchange(code) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    client_secret: process.env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
  });
  const res = await fetch(`${API}/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new Error(`token ${res.status}`);
  const { access_token } = await res.json();
  const me = await fetch(`${API}/users/@me`, { headers: { Authorization: `Bearer ${access_token}` } });
  if (!me.ok) throw new Error(`me ${me.status}`);
  const u = await me.json();
  return { id: String(u.id), name: u.global_name || u.username, avatar: u.avatar };
}

const avatarUrl = (u) => u.avatar
  ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`
  : 'https://cdn.discordapp.com/embed/avatars/0.png';

module.exports = { authorizeUrl, exchange, avatarUrl };

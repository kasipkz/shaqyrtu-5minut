// QOSSHY JOLY — жаңа клиент туралы Telegram-ға хабарлау (Netlify Function)
// Netlify → Environment variables: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, (қосымша) ALLOWED_ORIGINS
const ORIGINS = ['https://toi-kz.netlify.app'].concat((process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
const PER_IP = 20, WINDOW_MS = 10 * 60 * 1000, DAILY = parseInt(process.env.NOTIFY_DAILY_LIMIT || '300', 10);
const PRICE = { std: 3000, prem: 5000, vip: 10000 }, TN = { std: 'Қола', prem: 'Күміс', vip: 'Алтын' };
const hits = new Map(); let day = { d: '', n: 0 };
const clean = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);
const send = (code, body, origin) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origin || ORIGINS[0], 'Vary': 'Origin', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }, body: JSON.stringify(body) });

exports.handler = async (event) => {
  const origin = event.headers.origin || event.headers.Origin || '';
  const ok = ORIGINS.includes(origin) ? origin : '';
  if (event.httpMethod === 'OPTIONS') return { ...send(204, {}, ok), body: '' };
  if (origin && !ok) return send(403, { error: 'forbidden' }, ORIGINS[0]);
  if (event.httpMethod !== 'POST') return send(405, { error: 'method' }, ok);
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return send(503, { error: 'not_configured' }, ok);
  if ((event.body || '').length > 2000) return send(413, { error: 'too_large' }, ok);
  const ip = (event.headers['x-nf-client-connection-ip'] || (event.headers['x-forwarded-for'] || '').split(',')[0] || 'x').trim(), now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  const today = new Date().toISOString().slice(0, 10); if (day.d !== today) day = { d: today, n: 0 };
  if (arr.length >= PER_IP || day.n >= DAILY) return send(429, { error: 'rate' }, ok);
  let p; try { p = JSON.parse(event.body || '{}'); } catch (e) { return send(400, { error: 'json' }, ok); }
  const name = clean(p.name, 60); if (name.length < 2) return send(400, { error: 'name' }, ok);
  const tariff = PRICE[p.tariff] ? p.tariff : '';
  const dsc = parseInt(p.disc, 10) || 0, dcode = clean(p.discCode, 30), pk = tariff ? TN[tariff] + ' — ' + PRICE[tariff] + ' ₸' : '—';
  const text = p.type === 'code'
    ? ['🔔 Жаңа код сұрау', '👤 Аты: ' + name, '📞 Тел: ' + (clean(p.phone, 25) || '—'), '🎉 Той: ' + (clean(p.event, 40) || '—'), '💳 Пакет: ' + pk + (dsc ? ' (жеңілдік −' + dsc + '%' + (dcode ? ', коды: ' + dcode : '') + ')' : ''), '💬 Төледім, код сұрау'].join('\n')
    : ['🆕 Жаңа клиент' + (p.source ? ' (' + clean(p.source, 20) + ')' : ''), '👤 ' + name, '📞 ' + (clean(p.phone, 25) || '—'), '🎉 ' + (clean(p.event, 40) || '—'),
    '💳 ' + (tariff ? TN[tariff] + ' — ' + PRICE[tariff] + ' ₸' : '—'), '📌 Статус: ' + (clean(p.status, 30) || 'Жаңа клиент')].join('\n');
  arr.push(now); hits.set(ip, arr); day.n++;
  try {
    const r = await fetch('https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }) });
    return r.ok ? send(200, { ok: true }, ok) : send(502, { error: 'telegram' }, ok);
  } catch (e) { return send(504, { error: 'timeout' }, ok); }
};

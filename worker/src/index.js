/* Worker de Cloudflare: recibe el aviso de la app y lo envía por OneSignal.
 *
 * La REST key de OneSignal vive solo aquí (secreto de Cloudflare), nunca en el navegador.
 * La petición se autoriza con el token de Firebase del usuario que crea el reparto.
 */

const JWK_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

let jwks = { at: 0, keys: [] };

const corsHeaders = env => ({
  'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
});

const json = (body, status, env) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(env), 'Content-Type': 'application/json' },
  });

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKeys() {
  const now = Date.now();
  if (jwks.keys.length && now - jwks.at < 3600000) return jwks.keys;
  const r = await fetch(JWK_URL, { cf: { cacheTtl: 3600 } });
  if (!r.ok) throw new Error('No se pudieron obtener las llaves de Firebase');
  const j = await r.json();
  jwks = { at: now, keys: j.keys || [] };
  return jwks.keys;
}

async function verifyFirebaseToken(token, projectId) {
  if (!token || !projectId) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch (_) {
    return null;
  }

  if (header.alg !== 'RS256' || !header.kid) return null;
  const list = await getKeys();
  const jwk = list.find(k => k.kid === header.kid);
  if (!jwk) return null;

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1])
  );
  if (!valid) return null;

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp <= now) return null;
  if (payload.aud !== projectId) return null;
  if (payload.iss !== 'https://securetoken.google.com/' + projectId) return null;
  if (!payload.sub) return null;
  return payload;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405, env);

    const origin = request.headers.get('Origin');
    if (origin && env.ALLOWED_ORIGIN && origin !== env.ALLOWED_ORIGIN)
      return json({ error: 'Origen no permitido' }, 403, env);

    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const claims = await verifyFirebaseToken(token, env.FIREBASE_PROJECT_ID);
    if (!claims) return json({ error: 'No autorizado' }, 401, env);

    let data;
    try {
      data = await request.json();
    } catch (_) {
      return json({ error: 'JSON inválido' }, 400, env);
    }

    if (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_REST_KEY)
      return json({ error: 'Faltan los secretos de OneSignal' }, 500, env);

    const title = String(data.title || 'Nuevo reparto').slice(0, 80);
    const body = String(data.body || '').slice(0, 200);

    const payload = {
      app_id: env.ONESIGNAL_APP_ID,
      headings: { en: title, es: title },
      contents: { en: body, es: body },
      url: env.APP_URL || 'https://tamalescastro-ca1bf.web.app',
      /* Solo a repartidores (etiqueta puesta por la app al iniciar sesión). */
      filters: [{ field: 'tag', key: 'role', value: 'rep', relation: '=' }],
    };

    const r = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Key ' + env.ONESIGNAL_REST_KEY,
      },
      body: JSON.stringify(payload),
    });

    return new Response(await r.text(), {
      status: r.status,
      headers: { ...corsHeaders(env), 'Content-Type': 'application/json' },
    });
  },
};

/* Utilidades puras: selector, escape HTML, números, fechas y formato de dinero. */

const $ = s => document.querySelector(s);

const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const pad = n => String(n).padStart(2, '0');

const nz = x => +x || 0;

const day = () => {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
};

let D = day(),
  money = n => '$' + (+n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 });

const AVC = [1, 2, 3, 4, 5, 6, 7, 8].map(n => 'var(--av' + n + ')');

const avC = u => {
  let h = 0;
  for (const c of String(u)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVC[h % AVC.length];
};

const avI = n => esc((String(n).trim()[0] || '?').toUpperCase());

const distKm = (a, b) => {
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};
const hm = ts => {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + pad(m) + ' ' + ampm;
};

/* Hora escrita como «14:30» → «2:30 PM» */
const ftime = t => {
  const x = /^(\d{1,2}):(\d{2})/.exec(t || '');
  if (!x) return '';
  let h = +x[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + x[2] + ' ' + ampm;
};

/* --- corte a ciegas: el vendedor no ve cuánto debe haber hasta hacerlo --- */
const dstr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

const ago = t => {
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'hace un momento' : 'hace ' + m + ' min';
};

const vib = () => {
  try {
    navigator.vibrate && navigator.vibrate([200, 100, 200]);
  } catch (e) {}
};

const tmr = k => {
  const d = new Date();
  d.setDate(d.getDate() + (k == null ? 1 : k));
  return dstr(d);
};

const fdate = x => {
  const [y, m, d] = x.split('-').map(Number),
    t = new Date(y, m - 1, d),
    n = new Date(),
    a = new Date(n.getFullYear(), n.getMonth(), n.getDate()),
    df = Math.round((t - a) / 864e5),
    l = t.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
  return df == 1 ? 'mañana · ' + l : df == 2 ? 'pasado mañana · ' + l : l;
};

const dayAdd = (d, n) => {
  const x = new Date(d + 'T12:00:00');
  x.setDate(x.getDate() + n);
  return dstr(x);
};

const dayDiff = (a, b) =>
  Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5);

const dayList = (a, b) => {
  const l = [];
  for (let d = a; d <= b && l.length < 400; d = dayAdd(d, 1)) l.push(d);
  return l;
};

const fdd = d => {
  const t = new Date(d + 'T12:00:00');
  return isNaN(t)
    ? esc(d)
    : t.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
};

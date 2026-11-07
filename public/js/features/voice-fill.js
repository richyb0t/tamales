/* Llenar la carga por voz o por texto (interpretación de números y sabores en español). */

/* Llenar por voz o por texto */
const NU = {
  cero: 0,
  un: 1,
  uno: 1,
  una: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  dieciseis: 16,
  diecisiete: 17,
  dieciocho: 18,
  diecinueve: 19,
  veinte: 20,
  veintiun: 21,
  veintiuno: 21,
  veintidos: 22,
  veintitres: 23,
  veinticuatro: 24,
  veinticinco: 25,
  veintiseis: 26,
  veintisiete: 27,
  veintiocho: 28,
  veintinueve: 29,
  treinta: 30,
  cuarenta: 40,
  cincuenta: 50,
  sesenta: 60,
  setenta: 70,
  ochenta: 80,
  noventa: 90,
  cien: 100,
  ciento: 100,
  doscientos: 200,
  trescientos: 300,
  cuatrocientos: 400,
  quinientos: 500,
  seiscientos: 600,
  setecientos: 700,
  ochocientos: 800,
  novecientos: 900,
};

const lev = (a, b) => {
  const d = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    let p = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] == b[j - 1] ? 0 : 1));
      p = t;
    }
  }
  return d[b.length];
};

const eqw = (a, b) =>
  a == b ||
  a + 's' == b ||
  a + 'es' == b ||
  b + 's' == a ||
  b + 'es' == a ||
  (a.length >= 5 && b.length >= 5 && lev(a, b) <= 1);

/* «cinco litros y medio», «5 y medio», «un litro y cuarto»: la fracción puede ir antes o después de la unidad */
function frac(t, i) {
  let j = i;
  if (/^(litros?|lts?|l)$/.test(t[j] || '')) j++;
  if ((t[j] == 'y' || t[j] == 'con') && /^medi[oa]$/.test(t[j + 1] || '')) return [0.5, j + 2];
  if ((t[j] == 'y' || t[j] == 'con') && t[j + 1] == 'cuarto') return [0.25, j + 2];
  return null;
}

function parseVoice(txt) {
  const t = norm(txt)
      .replace(/(\d)[,.](\d)/g, '$1#$2')
      .replace(/[^a-z0-9# ]/g, ' ')
      .replace(/#/g, '.')
      .split(/\s+/)
      .filter(Boolean),
    STP = ['con', 'de', 'del', 'en', 'la', 'el', 'los', 'las', 'a', 'y', 'salsa'];
  const toks = F.map(n =>
      norm(n)
        .split(/\s+/)
        .filter(w => !STP.includes(w))
    ),
    cnt = {};
  toks.forEach(a => new Set(a).forEach(w => (cnt[w] = (cnt[w] || 0) + 1)));
  const al = [];
  F.forEach((n, f) => {
    al.push([f, norm(n).split(/\s+/)]);
    toks[f].forEach(w => {
      if (cnt[w] == 1 && w.length > 3) al.push([f, [w]]);
    });
  });
  al.push(['ch', ['champurrado']]);
  al.sort((a, c) => c[1].length - a[1].length);
  const it = [];
  let i = 0;
  while (i < t.length) {
    const w = t[i];
    let m;
    if (/^\d+(\.\d+)?$/.test(w)) {
      let v = parseFloat(w);
      i++;
      {
        const r = frac(t, i);
        if (r) {
          v += r[0];
          i = r[1];
        } else if (/^cuartos?$/.test(t[i] || '')) {
          v *= 0.25;
          i++;
        }
      }
      it.push({ n: v });
      continue;
    }
    if (NU[w] != null) {
      let v = NU[w];
      i++;
      for (;;) {
        const nx = NU[t[i]],
          p = v % 10 ? 1 : v % 100 ? 10 : 100;
        if (t[i] == 'y' && NU[t[i + 1]] > 0 && NU[t[i + 1]] < 10 && v >= 30 && v % 10 == 0) {
          v += NU[t[i + 1]];
          i += 2;
        } else if (nx > 0 && nx < p) {
          v += nx;
          i++;
        } else break;
      }
      {
        const r = frac(t, i);
        if (r) {
          v += r[0];
          i = r[1];
        } else if (/^cuartos?$/.test(t[i] || '')) {
          v *= 0.25;
          i++;
        }
      }
      it.push({ n: v });
      continue;
    }
    if (/^medi[oa]$/.test(w)) {
      it.push({ n: 0.5 });
      i++;
      continue;
    }
    if (w == 'cuarto') {
      it.push({ n: 0.25 });
      i++;
      continue;
    }
    m = al.find(([f, a]) => a.every((x, j) => t[i + j] != null && eqw(x, t[i + j])));
    if (m) {
      it.push({ f: m[0] });
      i += m[1].length;
    } else i++;
  }
  const out = {},
    used = new Set(),
    before = it.length && it[0].n != null;
  it.forEach((x, k) => {
    if (x.f == null) return;
    const a = before ? k - 1 : k + 1,
      c = before ? k + 1 : k - 1;
    const j = [a, c].find(j => it[j] && it[j].n != null && !used.has(j));
    if (j != null) {
      used.add(j);
      out[x.f] = it[j].n;
    }
  });
  return out;
}

function voiceFill(txt) {
  const b = curIb(),
    s = $('#vs');
  if (!(txt || '').trim()) return toast('Escribe o dicta primero');
  const r = parseVoice(txt),
    ks = Object.keys(r);
  if (!ks.length) {
    if (s)
      s.textContent = 'No entendí. Prueba así: «mole rojo 20, rajas 15, champurrado 10 litros».';
    return toast('No entendí, intenta otra vez');
  }
  const ok = [];
  ks.forEach(k => {
    if (k == 'ch') {
      const v = Math.max(0, Math.round(r[k] * 4) / 4);
      setField(b, 'qch', v);
      ok.push('Champurrado ' + v + ' L');
    } else {
      const f = +k,
        v = Math.max(0, Math.round(r[k]));
      setField(b, 'q' + f, v);
      ok.push(F[f] + ' ' + v);
    }
  });
  if (s) s.textContent = 'Entendí: ' + ok.join(' · ') + '. Revisa y guarda.';
  toast('Se llenaron ' + ok.length + ' campos. Revisa y guarda');
}

let rec = null,
  want = false;

function micUi(on) {
  const bb = $('#mic');
  if (bb) {
    bb.innerHTML = on ? '<span>⏹</span>Terminar' : '<span>🎤</span>Dictar';
    bb.classList.toggle('rec', on);
  }
}

function mic() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR)
    return toast(
      'Este navegador no tiene dictado. Usa el micrófono de tu teclado en el cuadro de texto'
    );
  if (want) {
    want = false;
    try {
      rec && rec.stop();
    } catch (_) {}
    return;
  }
  let fin = '',
    itm = '',
    fatal = false,
    tries = 0;
  want = true;
  micUi(true);
  S.vx = '';
  const bx = $('#vt');
  if (bx) bx.value = '';
  const show = () => {
      const x = (fin + ' ' + itm).trim();
      S.vx = x;
      const box = $('#vt');
      if (box) box.value = x;
    },
    go = () => {
      tries++;
      rec = new SR();
      rec.lang = 'es-MX';
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      rec.onresult = e => {
        itm = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i],
            t = r[0].transcript.trim();
          if (r.isFinal) fin = (fin + ' ' + t).trim();
          else itm = (itm + ' ' + t).trim();
        }
        show();
      };
      rec.onerror = e => {
        if (e.error == 'no-speech' || e.error == 'aborted') return;
        fatal = true;
        want = false;
        toast(
          e.error == 'not-allowed' || e.error == 'service-not-allowed'
            ? 'Permite el micrófono para dictar'
            : e.error == 'network'
              ? 'El dictado necesita internet'
              : 'No se pudo dictar (' + e.error + ')'
        );
      };
      rec.onend = () => {
        rec = null;
        fin = (fin + ' ' + itm).trim();
        itm = '';
        /* si todavía no dijiste nada, sigue esperando; si ya hablaste y hay silencio, termina y llena */
        if (want && !fatal && !fin && tries < 4) {
          try {
            go();
            return;
          } catch (_) {}
        }
        want = false;
        micUi(false);
        show();
        if (fin) voiceFill(fin);
        else toast('No te escuché, intenta otra vez');
      };
      rec.start();
    };
  try {
    go();
  } catch (_) {
    want = false;
    rec = null;
    micUi(false);
  }
}

/* Corte de caja a ciegas y consulta de cortes (administrador). */

const corteDone = () => !!S.me && S.me.role == 'vend' && S.cuts.some(k => k.by == S.me.user);

const corteBlk = () => {
  if (!corteDone()) return false;
  toast('Ya hiciste el corte de hoy: no se pueden registrar más ventas ni devoluciones');
  return true;
};

function corteBanner() {
  return corteDone()
    ? `<div class="card" style="border:2px solid var(--bad)"><b>🔒 Corte de caja hecho</b><br><small>Ya no se pueden registrar ventas, entregas ni devoluciones hoy. Si hace falta, pídele al administrador que anule el corte.</small></div>`
    : '';
}

let cutUn = null,
  csUn = null;

function subCSales() {
  if (csUn) {
    csUn();
    csUn = null;
  }
  const m = S.me,
    d = S.cday || D;
  if (!m || m.role != 'admin' || d == D) return;
  csUn = db
    .collection('sales')
    .where('day', '==', d)
    .onSnapshot(q => {
      S.csales = q.docs.map(x => ({ _id: x.id, ...x.data() }));
      render();
    }, err);
}

function subCuts() {
  if (cutUn) {
    cutUn();
    cutUn = null;
  }
  const m = S.me;
  if (!m || m.role == 'enc' || m.role == 'rep') return;
  let q = db.collection('cuts').where('day', '==', m.role == 'admin' ? S.cday || D : D);
  if (m.role == 'vend') q = q.where('by', '==', m.user);
  cutUn = q.onSnapshot(r => {
    S.cuts = r.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  }, err);
}

const dif$ = d => (d == 0 ? 'Correcto ✓' : d > 0 ? 'Sobran ' + money(d) : 'Faltan ' + money(-d));

function cx() {
  const mine = S.sales.filter(s => s.by == S.me.user),
    sm = t => mine.filter(s => s.type == t).reduce((a, s) => a + s.qty * s.price, 0);
  const fo = fondo(),
    v = sm('vendido'),
    d = sm('devolucion');
  return { fo, v, d, ap: sm('apartado'), esp: r2(fo + v - d) };
}

function setCday(v) {
  S.cday = v || D;
  S.cuts = [];
  S.csales = null;
  subCuts();
  subCSales();
  render(true);
}

function anCorte(id) {
  ask('¿Anular este corte? El vendedor podrá hacerlo de nuevo.', async () => {
    try {
      await db.doc('cuts/' + id).delete();
      toast('Corte anulado');
    } catch (e) {
      err(e);
    }
  });
}

const dlong = x => {
  const t = new Date(x + 'T12:00:00').toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function dateChips(cur) {
  const days = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dstr(d));
  }
  const sh = (x, o) => new Date(x + 'T12:00:00').toLocaleDateString('es-MX', o).replace('.', ''),
    custom = !days.includes(cur);
  return `<div class="seg">${days.map((x, i) => `<button class="${x == cur ? 'on' : ''}" onclick="setCday('${x}')">${i == 0 ? 'Hoy' : i == 1 ? 'Ayer' : 'Antier'}</button>`).join('')}<button class="${custom ? 'on' : ''}" onclick="pickDay()">📅 ${custom ? sh(cur, { day: 'numeric', month: 'short' }) : 'Otra'}</button></div><input type="date" id="cdt" tabindex="-1" aria-hidden="true" max="${D}" style="position:absolute;opacity:0;pointer-events:none;width:1px;height:1px" onchange="setCday(this.value)">`;
}

function pickDay() {
  const i = $('#cdt');
  try {
    i.showPicker();
  } catch (e) {
    i.click();
  }
}

function corteCard() {
  const x = cx(),
    c = S.cuts.find(k => k.by == S.me.user);
  if (c)
    return `<div class="card"><div class="crh"><div><h3>Corte de caja</h3><small>Hecho a las ${hm(c.ts)}</small></div><span class="chip ${c.dif == 0 ? 'ok' : c.dif > 0 ? 'low' : 'bad'}">${dif$(c.dif)}</span></div>
 <div class="cre"><small>Entrega al administrador</small><b>${money(c.entregar)}</b><small>Lo contado menos tu fondo de ${money(c.fondo)}</small></div>
 ${
   c.dif == 0
     ? ''
     : `<div class="row"><div>Fondo inicial</div><b>${money(c.fondo)}</b></div><div class="row"><div>Ventas cobradas</div><b>${money(c.ventas)}</b></div><div class="row"><div>Devoluciones</div><b>−${money(c.devol)}</b></div>
 <div class="row"><div>Debía haber en caja</div><b>${money(c.esperado)}</b></div><div class="row"><div>Contaste</div><b>${money(c.contado)}</b></div>`
 }
 <small style="display:block;margin-top:8px">Si te equivocaste, pídele al administrador que anule el corte para hacerlo de nuevo.</small></div>`;
  return `<div class="card"><div class="crh"><h3>Corte de caja</h3><span class="chip">Fondo ${money(x.fo)}</span></div><small>Cuenta todo el efectivo de tu caja, incluyendo tu fondo de ${money(x.fo)}, y escribe el total. Al terminar verás el resultado.</small>
 <div class="cash"><span>$</span><input id="cc" aria-label="Efectivo contado en caja" type="text" inputmode="decimal" placeholder="0" autocomplete="off" oninput="this.value=this.value.replace(/[^0-9.]/g,'')"></div>
 ${x.ap ? '<div class="crn"><span aria-hidden="true">📌</span><span>Los apartados sin entregar no cuentan para el corte.</span></div>' : ''}
 <input id="cn" placeholder="Nota (opcional)" style="width:100%;margin-top:10px">
 <button class="go crb" onclick="doCorte()">Hacer corte</button></div>`;
}

function doCorte() {
  if (corteDone()) return;
  const x = cx(),
    val = $('#cc').value,
    nota = $('#cn').value.trim();
  if (val === '' || isNaN(+val)) return toast('Escribe cuánto efectivo hay en caja');
  const c = r2(+val),
    dif = r2(c - x.esp);
  ask(
    `¿Hacer el corte con ${money(c)} en caja? Después ya no podrás registrar ventas, entregas ni devoluciones hoy, ni cambiar el corte.${x.ap || preN() ? ' Tienes apartados sin entregar: tendrías que cobrarlos antes.' : ''}`,
    async () => {
      if (!lock('ct')) return;
      try {
        await db.doc('cuts/' + D + '_' + S.me.user).set({
          day: D,
          branch: S.me.branch,
          by: S.me.user,
          name: S.me.name,
          fondo: x.fo,
          ventas: x.v,
          devol: x.d,
          esperado: x.esp,
          contado: c,
          dif,
          entregar: r2(c - x.fo),
          apartados: x.ap,
          nota,
          ts: Date.now(),
        });
        toast('Corte guardado');
      } catch (e) {
        err(e);
      }
    }
  );
}

function cortesView() {
  const day = S.cday || D,
    l = [...S.cuts].sort((a, b) => a.ts - b.ts),
    sm = k => l.reduce((a, c) => a + c[k], 0),
    SL = day == D ? S.sales : S.csales;
  /* recalcula desde las ventas registradas (hasta la hora del corte) y avisa si no coincide con lo que declaró el corte */
  const rc = c => {
    if (!SL) return null;
    const m = SL.filter(s => s.by == c.by && s.ts <= c.ts),
      t = k => m.filter(s => s.type == k).reduce((a, s) => a + s.qty * s.price, 0),
      v = t('vendido'),
      d = t('devolucion');
    return Math.abs(v - c.ventas) > 0.01 || Math.abs(d - c.devol) > 0.01
      ? { v, d, dif: r2(c.contado - (c.fondo + v - d)) }
      : null;
  };
  const pend =
    day == D
      ? S.users
          .filter(
            u =>
              u.role == 'vend' &&
              u.active !== false &&
              vbr(u) != null &&
              !l.some(c => c.by == u.user)
          )
          .map(u => ({ name: u.name, br: vbr(u) }))
      : SL
        ? [...new Set(SL.filter(s => s.type != 'apartado').map(s => s.by))]
            .filter(by => !l.some(c => c.by == by))
            .map(by => {
              const u = S.users.find(u => u.user == by);
              return u && u.role == 'vend'
                ? { name: u.name, br: (SL.find(s => s.by == by) || {}).branch }
                : null;
            })
            .filter(Boolean)
        : [];
  return `<div class="card"><h3>Cortes de caja</h3><small>${dlong(day)}</small>${dateChips(day)}
 <div class="kp"><div><small>Cortes</small><b>${l.length}</b></div><div><small>A entregar</small><b>${money(sm('entregar'))}</b></div><div><small>Diferencia</small><b class="${sm('dif') == 0 ? 'ok' : sm('dif') > 0 ? 'low' : 'bad'}">${money(r2(sm('dif')))}</b></div></div></div>
 ${
   l
     .map(
       c => `<div class="card"><div class="row"><div><b>${esc(c.name)}</b><br><small>${esc(brs()[c.branch])} · ${hm(c.ts)}</small></div><span class="chip ${c.dif == 0 ? 'ok' : c.dif > 0 ? 'low' : 'bad'}">${dif$(c.dif)}</span></div>
 ${
   c.dif == 0
     ? ''
     : `<div class="row"><div>Fondo</div><b>${money(c.fondo)}</b></div><div class="row"><div>Ventas</div><b>${money(c.ventas)}</b></div><div class="row"><div>Devoluciones</div><b>−${money(c.devol)}</b></div>
 <div class="row"><div>Debía haber</div><b>${money(c.esperado)}</b></div><div class="row"><div>Contado</div><b>${money(c.contado)}</b></div>`
 }<div class="row"><div><b>Entregó</b></div><b>${money(c.entregar)}</b></div>${(x => (x ? `<div class="row"><div><b class="bad">⚠️ No coincide con las ventas registradas</b><br><small>Las ventas suman ${money(x.v)} y las devoluciones ${money(x.d)}. Con eso el resultado sería: ${dif$(x.dif)}. Si el vendedor entregó apartados o vendió después del corte, puede explicarse.</small></div></div>` : ''))(rc(c))}
 ${c.apartados ? `<small>Apartados sin cobrar: ${money(c.apartados)}</small><br>` : ''}${c.nota ? `<small>Nota: ${esc(c.nota)}</small><br>` : ''}<div class="form"><button class="gh" style="color:var(--bad)" data-id="${esc(c.id)}" onclick="anCorte(this.dataset.id)">Anular corte</button></div></div>`
     )
     .join('') || '<div class="card"><small>No hay cortes en esta fecha.</small></div>'
 }
 ${pend.length ? `<div class="card"><h3>Sin corte todavía</h3>${pend.map(u => `<div class="row"><div>${esc(u.name)}<br><small>${esc(brs()[u.br] || '')}</small></div></div>`).join('')}</div>` : ''}`;
}

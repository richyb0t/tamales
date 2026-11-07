/* Inventario (carga del día): captura, copiar días anteriores, guardar y reiniciar. */

async function saveInv() {
  const b = curIb(),
    q = {},
    pa = {};
  if (pendAc(b).length) {
    toast('Primero acepta los apartados de hoy de ' + brs()[b]);
    return admAp(b);
  }
  F.forEach((_, f) => {
    const a = paNow(b, f),
      base = Math.max(0, parseInt($('#q' + f).value) || 0);
    q['f' + f] = base + a;
    if (a) pa['f' + f] = a;
  });
  q.ch = Math.max(0, parseFloat($('#qch').value) || 0);
  q.pa = pa;
  try {
    await db.doc(`loads/${D}_${b}`).set({ day: D, branch: b, q });
    if (S.dr) delete S.dr[b];
    const n = Object.values(pa).reduce((x, v) => x + v, 0);
    toast(
      'Carga guardada para ' +
        brs()[b] +
        (F.some((_, f) => q['f' + f] > 0 && !price(f))
          ? ' · ⚠️ hay sabores sin precio (Ajustes)'
          : '') +
        (n ? ' · incluye ' + n + (n == 1 ? ' apartado' : ' apartados') : '')
    );
  } catch (e) {
    err(e);
  }
}

function curIb() {
  return BI().includes(S.ib) ? S.ib : BI()[0];
}

function dv(b, k, d) {
  const x = (S.dr || {})[b];
  return x && x[k] != null ? x[k] : d;
}

function drs(b, k, v) {
  S.dr = S.dr || {};
  (S.dr[b] = S.dr[b] || {})[k] = v;
}

/* Chips de sucursal para la carga: ✓ = ya tiene carga guardada hoy. Si hay muchas sucursales, se desliza de lado. */
const invChips = b =>
  `<div class="seg">${BI()
    .map(
      i =>
        `<button class="${i == b ? 'on' : ''}" onclick="setIb(${i})">${esc(brs()[i])}${loadDone(i) ? ' ✓' : ''}</button>`
    )
    .join('')}</div>`;

const invTxt = (n, l) => n + (n == 1 ? ' tamal' : ' tamales') + (l ? ' · ' + l + ' L' : '');

/* Total a cargar (incluye los apartados de hoy, que se suman al guardar); se recalcula al escribir */
function invTot() {
  const b = curIb();
  let n = 0;
  F.forEach((_, f) => {
    const e = $('#q' + f);
    n += Math.max(0, parseInt(e && e.value) || 0) + paNow(b, f);
  });
  const c = $('#qch'),
    t = $('#invTot');
  if (t) t.textContent = invTxt(n, Math.max(0, parseFloat(c && c.value) || 0));
}

function invStp(id, d, s) {
  const e = $('#' + id);
  if (!e) return;
  const v = Math.max(0, r2((parseFloat(e.value) || 0) + d * s));
  e.value = v;
  drs(curIb(), id, String(v));
  invTot();
}

function invView() {
  const b = curIb(),
    v = (k, d) => dv(b, k, d),
    o = `oninput="drs(${b},this.id,this.value);invTot()"`;
  const pn = pendAc(b);
  if (pn.length)
    return (
      preInvCard(b) +
      `<div class="card"><h3>Carga del día</h3>${invChips(b)}<div style="border:2px solid var(--ac);border-radius:12px;padding:12px;margin-top:10px"><b>📌 Primero acepta los apartados de hoy</b><br><small>${pn.length == 1 ? 'Hay 1 apartado sin aceptar' : 'Hay ' + pn.length + ' apartados sin aceptar'} en ${esc(brs()[b])} (${pn.map(x => esc(x.client)).join(', ')}). Acéptalos (o recházalos) y después podrás llenar la carga.</small><div class="form"><button class="go" style="flex:1" onclick="admAp(${b})">Ir a aceptar apartados</button></div></div></div>`
    );
  const gv = f => Math.max(0, parseInt(v('q' + f, Math.max(0, load(b, f) - paNow(b, f)))) || 0),
    n0 = F.reduce((a, _, f) => a + gv(f) + paNow(b, f), 0),
    l0 = Math.max(0, parseFloat(v('qch', chLoad(b))) || 0);
  const stp = (id, s) =>
      `<button class="gh" onclick="invStp('${id}',-1,${s})" aria-label="Menos">−</button>`,
    pls = (id, s) => `<button onclick="invStp('${id}',1,${s})" aria-label="Más">＋</button>`;
  return (
    preInvCard(b) +
    `<div class="card"><div class="ivh"><h3>Carga del día</h3>${loadDone(b) ? '<span class="chip ok">✓ Guardada hoy</span>' : '<span class="chip low">Sin guardar</span>'}</div><small>Elige la sucursal y escribe cuántos tamales lleva. Los apartados se suman solos al guardar. ✓ = ya tiene carga hoy.</small>${invChips(b)}
 <div class="ivt"><button class="alt" onclick="copyDay()"><span>📋</span>Copiar</button><button class="alt" id="mic" onclick="mic()"><span>🎤</span>Dictar</button><button class="alt" onclick="vaciarCarga()"><span>🗑</span>Vaciar</button></div>
 <div class="vz"><div class="form" style="margin:4px 0"><input type="text" id="vt" placeholder="Ej: mole rojo 20, rajas 15, champurrado 10 litros" autocomplete="off" enterkeyhint="done" value="${esc(S.vx || '')}" oninput="S.vx=this.value" onkeydown="if(event.key=='Enter'){event.preventDefault();voiceFill(this.value)}" style="flex:1 1 12rem;min-width:0"><button class="gh" onclick="voiceFill($('#vt').value)">Llenar</button></div>
 <small id="vs">Dicta o escribe los sabores con su cantidad; se llenan solos y tú revisas antes de guardar.</small></div></div>
 <div class="card"><div class="pkh"><span>Tamales</span><span>${F.length} sabores</span></div>${F.map((n, f) => `<div class="row iv"><div>${n}<br><small>ya salieron: ${used(b, f)}${paNow(b, f) ? ' · <b class="low">+' + paNow(b, f) + ' apartados' + (loadDone(b) ? ' incluidos' : ' al guardar') + '</b>' : ''}</small></div><div class="st">${stp('q' + f, 1)}<input type="number" min="0" inputmode="numeric" id="q${f}" aria-label="${esc(n)}" value="${v('q' + f, Math.max(0, load(b, f) - paNow(b, f)))}" ${o}>${pls('q' + f, 1)}</div></div>`).join('')}</div>
 <div class="card"><div class="pkh"><span>Bebida</span></div><div class="row iv"><div>☕ Champurrado (litros)<br><small>ya salieron: ${r2(chUsed(b))} L</small></div><div class="st">${stp('qch', 0.25)}<input type="number" min="0" step="0.25" inputmode="decimal" id="qch" aria-label="Champurrado en litros" value="${v('qch', chLoad(b))}" ${o}>${pls('qch', 0.25)}</div></div></div>
 <div class="cartsp"></div><div class="cart"><div class="ct one"><div class="ci"><small>Total · ${esc(brs()[b])}</small><b id="invTot">${invTxt(n0, l0)}</b></div><button class="go" onclick="saveInv()">Guardar carga</button></div></div>`
  );
}

function setField(b, k, v) {
  drs(b, k, v);
  const e = $('#' + k);
  if (e) {
    e.value = v;
    const r = e.closest('.row');
    if (r) {
      r.classList.add('flash');
      setTimeout(() => r.classList.remove('flash'), 9000);
    }
  }
  invTot();
}

/* Copiar la carga de un día anterior (o de otra sucursal hoy) */
async function copyDay() {
  const b = curIb(),
    m = $('#modal');
  m.innerHTML =
    '<div class="card mv"><h3>Copiar carga</h3><small>Buscando días anteriores…</small></div>';
  m.style.display = 'flex';
  let h = [];
  try {
    const ds = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i - 1);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    });
    h = (
      await Promise.all(
        ds.map(x =>
          db
            .doc(`loads/${x}_${b}`)
            .get()
            .catch(() => null)
        )
      )
    )
      .filter(d => d && d.exists())
      .map(d => d.data());
  } catch (e) {
    m.style.display = 'none';
    return err(e);
  }
  const fd = s => {
    const [y, mo, d] = s.split('-').map(Number);
    return new Date(y, mo - 1, d).toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  };
  const tot = q => F.reduce((a, _, f) => a + (+q['f' + f] || 0), 0);
  S.cp = [
    ...h.map(x => ({ t: fd(x.day), q: x.q || {} })),
    ...BI()
      .filter(i => i != b && S.loads[i] && tot(S.loads[i]) > 0)
      .map(i => ({ t: 'Hoy · ' + brs()[i], q: S.loads[i] })),
  ];
  m.innerHTML = `<div class="card mv"><h3>Copiar carga a ${esc(brs()[b])}</h3><small>Elige un día y se llenan las cantidades; después puedes cambiarlas y guardar.</small>${S.cp.length ? S.cp.map((x, i) => `<div class="row"><div style="text-transform:capitalize">${esc(x.t)}<br><small style="text-transform:none">${tot(x.q)} tamales${+x.q.ch ? ' · ' + x.q.ch + ' L champurrado' : ''}</small></div><button class="alt" onclick="pickLoad(${i})">Usar</button></div>`).join('') : '<div class="row"><small>No hay cargas de la semana pasada para esta sucursal.</small></div>'}<div class="form"><button id="mk" style="flex:1">Cerrar</button></div></div>`;
  $('#mk').onclick = () => (m.style.display = 'none');
}

function pickLoad(i) {
  const x = S.cp[i],
    b = curIb();
  if (!x) return;
  $('#modal').style.display = 'none';
  F.forEach((_, f) =>
    setField(b, 'q' + f, Math.max(0, (+x.q['f' + f] || 0) - (+(x.q.pa || {})['f' + f] || 0)))
  );
  setField(b, 'qch', +x.q.ch || 0);
  toast('Listo. Revisa las cantidades y guarda');
}

/* Vaciar: sin carga guardada solo pone las cantidades en 0 (se confirma con «Guardar carga»).
   Con la carga ya guardada la reinicia: la borra y queda como si hoy no se hubiera cargado nada (se anota en el registro). */
function vaciarCarga() {
  const b = curIb();
  if (!loadDone(b)) {
    F.forEach((_, f) => setField(b, 'q' + f, 0));
    setField(b, 'qch', 0);
    toast('Todo en 0. Toca «Guardar carga» para confirmar');
    return;
  }
  if (S.sales.some(x => x.branch == b))
    return toast(
      'Ya hay ventas o apartados hoy en ' +
        brs()[b] +
        ': no se puede reiniciar la carga. Corrige las cantidades y toca «Guardar carga»'
    );
  if (S.tr.some(t => t.from == b))
    return toast(
      'Ya salió un traspaso de ' + brs()[b] + ' hoy: anúlalo primero para reiniciar la carga'
    );
  const q = S.loads[b] || {},
    n = F.reduce((a, _, f) => a + (+q['f' + f] || 0), 0),
    c = +q.ch || 0,
    txt =
      [n ? n + (n == 1 ? ' tamal' : ' tamales') : '', c ? c + ' L de champurrado' : '']
        .filter(Boolean)
        .join(' y ') || 'carga en 0';
  ask(
    '¿Reiniciar la carga de ' +
      brs()[b] +
      '? Se borra lo guardado (' +
      txt +
      ') y queda como si hoy no se hubiera cargado nada.',
    async () => {
      if (!lock('rc' + b)) return;
      try {
        const bt = db.batch();
        bt.delete('loads/' + D + '_' + b);
        bt.set(
          'logs/ld_' + D + '_' + b + '_' + Date.now(),
          logD({
            branch: b,
            kind: 'anulacion',
            label: 'Carga reiniciada',
            txt: brs()[b] + ' · ' + txt,
          })
        );
        await bt.commit();
        if (S.dr) delete S.dr[b];
        toast('Carga reiniciada. Ya puedes cargar de nuevo');
        render(true);
      } catch (e) {
        delete lock.s['rc' + b];
        err(e);
      }
    }
  );
}

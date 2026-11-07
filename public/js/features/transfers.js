/* Traspasos de tamales y champurrado entre sucursales. */

const trTxt = () => {
  let n = 0,
    c = 0;
  Object.entries(S.trd || {}).forEach(([k, v]) => {
    v = +v || 0;
    if (k == 'ch') c = v;
    else n += Math.floor(v);
  });
  return n || c
    ? 'Vas a pasar ' +
        [n ? n + (n > 1 ? ' tamales' : ' tamal') : '', c ? c + ' L de champurrado' : '']
          .filter(Boolean)
          .join(' y ')
    : 'Elige cuántos pasas de cada sabor';
};

const trEl = k => $(k == 'ch' ? '#tqch' : '#tq' + k.slice(1));

function trUp(k, w) {
  const e = trEl(k),
    r = e && e.closest('.tpq');
  if (r) r.classList.toggle('on', (+w || 0) > 0);
  const s = $('#trs');
  if (s) s.textContent = trTxt();
}

function trStp(k, d, mx) {
  const e = trEl(k);
  let v = (+(e && e.value) || 0) + d;
  v = Math.min(mx, Math.max(0, v));
  v = k == 'ch' ? r2(v) : Math.floor(v);
  S.trd[k] = v;
  if (e) e.value = v;
  trUp(k, v);
}

function trIn(k) {
  const e = trEl(k);
  if (!e) return;
  S.trd[k] = e.value;
  trUp(k, e.value);
}

function trForm(from, adm) {
  S.trd = S.trd || {};
  if (S.trf !== from) {
    S.trd = {};
    S.trf = from;
  }
  const bs = brs(),
    o = BI().filter(i => i != from),
    to = o.includes(S.tt) ? S.tt : o[0],
    fl = F.map((n, f) => [n, f, left(from, f)]).filter(x => x[2] > 0),
    cl = chLeft(from),
    row = (k, name, sub, mx, stp, idn, val) =>
      `<div class="tpq${(+val || 0) > 0 ? ' on' : ''}"><div class="tpn">${name}<small>${sub}</small></div><div class="st"><button class="gh" aria-label="Menos" onclick="trStp('${k}',-${stp},${mx})">−</button><input type="number" min="0" max="${mx}" ${k == 'ch' ? 'step="0.25" inputmode="decimal"' : 'inputmode="numeric"'} id="${idn}" aria-label="${esc(name)}" value="${val}" oninput="trIn('${k}')"><button aria-label="Más" onclick="trStp('${k}',${stp},${mx})">+</button></div></div>`;
  return `<div class="card"><h3>Pasar tamales a otra sucursal</h3><small>Por ejemplo si cierran un puesto y pasan los sobrantes. Escribe cuántos pasas de cada sabor, o usa los botones.</small>
 <div class="tpr"><div>${adm ? `<select aria-label="De" onchange="S.tf=+this.value;render(true)">${bs.map((n, i) => (!isOpen(i) ? '' : `<option value="${i}" ${i == from ? 'selected' : ''}>De: ${esc(n)}</option>`)).join('')}</select>` : `<div class="tpf"><small>De</small><b>${esc(bs[from])}</b></div>`}</div><span class="tpa" aria-hidden="true">→</span><div><select aria-label="A" onchange="S.tt=+this.value;render(true)">${o.map(i => `<option value="${i}" ${i == to ? 'selected' : ''}>A: ${esc(bs[i])}</option>`).join('')}</select></div></div>
 ${fl.length || cl > 0 ? `<div class="form"><button class="alt" onclick="trFill(${from},1)">Pasar todo</button><button class="gh" onclick="trFill(${from},0)">Poner todo en 0</button></div>` + fl.map(x => row('f' + x[1], x[0], 'quedan ' + x[2], x[2], 1, 'tq' + x[1], S.trd['f' + x[1]] ?? 0)).join('') + (cl > 0 ? row('ch', '☕ Champurrado', 'quedan ' + cl + ' L', cl, 0.25, 'tqch', S.trd.ch ?? 0) : '') + `<div class="tps" id="trs">${trTxt()}</div><div class="form"><button class="go" style="flex:1" onclick="doTr(${from},${to})">${to != null ? 'Pasar a ' + esc(bs[to]) : 'Pasar'}</button></div>` : '<small>No quedan tamales en esta sucursal.</small>'}</div>`;
}

function trFill(from, all) {
  S.trd = {};
  if (all) {
    F.forEach((_, f) => {
      const l = left(from, f);
      if (l > 0) S.trd['f' + f] = l;
    });
    const c = chLeft(from);
    if (c > 0) S.trd.ch = c;
  }
  render(true);
}

function doTr(from, to) {
  if (to == null) return toast('No hay otra sucursal abierta para recibir el traspaso');
  const q = {};
  let n = 0,
    lc = 0;
  F.forEach((_, f) => {
    const v = $('#tq' + f);
    if (!v) return;
    const x = Math.min(Math.max(0, parseInt(v.value) || 0), left(from, f));
    if (x > 0) {
      q['f' + f] = x;
      n += x;
    }
  });
  const vc = $('#tqch');
  if (vc) {
    const x = r2(Math.min(Math.max(0, parseFloat(vc.value) || 0), chLeft(from)));
    if (x > 0) {
      q.ch = x;
      lc = x;
    }
  }
  if (!n && !lc) return toast('No hay nada para pasar');
  ask(
    `¿Pasar ${[n ? n + ' tamales' : '', lc ? lc + ' L de champurrado' : ''].filter(Boolean).join(' y ')} de ${brs()[from]} a ${brs()[to]}?`,
    async () => {
      try {
        await db
          .collection('transfers')
          .add({ day: D, from, to, q, n, by: S.me.user, ts: Date.now() });
        S.trd = {};
        toast('Traspaso hecho');
        render(true);
      } catch (e) {
        err(e);
      }
    }
  );
}

function trList(b) {
  const l = S.tr.filter(t => b == null || t.from == b || t.to == b).sort((a, c) => c.ts - a.ts);
  if (!l.length) return '';
  return `<div class="card"><h3>Traspasos de hoy</h3>${l
    .map(t => {
      const d = new Date(t.ts),
        it = Object.entries(t.q || {})
          .map(([k, v]) => (k == 'ch' ? v + ' L champurrado' : v + '× ' + F[+k.slice(1)]))
          .join(', '),
        inn = b != null && t.to == b,
        ttl =
          b == null
            ? esc(brs()[t.from]) + ' → ' + esc(brs()[t.to])
            : inn
              ? 'De ' + esc(brs()[t.from])
              : 'A ' + esc(brs()[t.to]);
      return `<div class="tpl"><div class="tpd"><b>${ttl}</b><small>${pad(d.getHours())}:${pad(d.getMinutes())} · ${esc(it)}</small></div>${b == null ? '' : `<span class="chip ${inn ? 'ok' : 'low'}">${inn ? 'Entró' : 'Salió'}</span>`}${b == null || t.from == b ? `<button class="gh" onclick="delTr('${t._id}')">Anular</button>` : ''}</div>`;
    })
    .join('')}</div>`;
}

function delTr(id) {
  const t = S.tr.find(x => x._id == id);
  if (!t) return;
  if (
    Object.entries(t.q || {}).find(([k, v]) =>
      k == 'ch' ? chLeft(t.to) < v : left(t.to, +k.slice(1)) < v
    )
  )
    return toast('No se puede anular: la sucursal destino ya vendió parte de esos tamales');
  ask('¿Anular este traspaso?', async () => {
    try {
      const bt = db.batch();
      bt.set(
        'logs/del_tr_' + id,
        logD({
          branch: t.from,
          branch2: t.to,
          kind: 'anulacion',
          label: 'Traspaso anulado',
          txt:
            brs()[t.from] +
            ' → ' +
            brs()[t.to] +
            ' · ' +
            Object.entries(t.q || {})
              .map(([k, v]) => (k == 'ch' ? v + ' L champurrado' : v + '× ' + F[+k.slice(1)]))
              .join(', '),
        })
      );
      bt.delete('transfers/' + id);
      await bt.commit();
      toast('Traspaso anulado');
    } catch (e) {
      err(e);
    }
  });
}

function trView() {
  const f = BI().includes(S.tf) ? S.tf : BI()[0];
  return trForm(f, true) + trList(null);
}

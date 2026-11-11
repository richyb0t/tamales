/* Lista de sabores: filtros, búsqueda, tarjetas de sabor y tabla de existencias. */

const isD = f => f >= 8,
  norm = s =>
    String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase(),
  inCat = f =>
    S.cat != 'b' &&
    ((S.cat || 't') == 't' || (S.cat == 'd') == isD(f)) &&
    (!S.q || norm(F[f]).includes(norm(S.q)));

function gridT(bs) {
  const q = S.q ? norm(S.q) : '',
    cr =
      (S.cat || 't') == 't' && (!q || norm('champurrado').includes(q))
        ? `<tr><td>☕ Champurrado (L)</td>${bs
            .map(b => {
              const t = chLoad(b),
                l = chLeft(b);
              return `<td class="n"><span class="chip ${l <= 0 ? (t ? 'bad' : '') : l < 1 ? 'low' : 'ok'}">${t || l ? l : '–'}</span></td>`;
            })
            .join('')}</tr>`
        : '';
  return (
    `<div class="sc"><table><tr><th>Sabor</th>${bs.map(b => `<th>${esc(brs()[b])}</th>`).join('')}</tr>` +
    F.map((n, f) =>
      inCat(f)
        ? `<tr><td>${n}</td>${bs
            .map(b => {
              const l = left(b, f),
                t = load(b, f);
              return `<td class="n"><span class="chip ${l <= 0 ? (t ? 'bad' : '') : l <= 3 ? 'low' : 'ok'}">${t || l ? l : '–'}</span></td>`;
            })
            .join('')}</tr>`
        : ''
    ).join('') +
    cr +
    `</table></div>`
  );
}

function grid(bs) {
  return seg() + srch() + `<div id="gr" class="stk" data-b="${bs.join()}">${gridT(bs)}</div>`;
}

function fsq(v) {
  S.q = v;
  const e = $('#fls');
  if (e) e.innerHTML = flList(S.me.branch);
  const g = $('#gr');
  if (g) g.innerHTML = gridT(g.dataset.b.split(',').map(Number));
}

function seg() {
  const o = S.so || S.q;
  return `<div class="sw"><div class="seg">${[['t', 'Todos'], ['s', 'Salados'], ['d', 'Dulces'], ...(S.me && S.me.role == 'vend' ? [['b', 'Bebidas']] : [])].map(([k, l]) => `<button class="${(S.cat || 't') == k ? 'on' : ''}" onclick="S.cat='${k}';renderNow(true)">${l}</button>`).join('')}</div><button class="lupa ${o ? 'on' : ''}" aria-label="Buscar" onclick="fso()">🔍</button></div>`;
}

function srch() {
  return S.so || S.q
    ? `<div class="sx"><input type="search" id="sq" placeholder="Buscar sabor…" value="${esc(S.q || '')}" oninput="fsq(this.value)" autocomplete="off" style="width:100%;box-sizing:border-box;margin-bottom:10px"></div>`
    : '';
}

function fso() {
  if (S.so || S.q) {
    S.so = false;
    S.q = '';
  } else S.so = true;
  renderNow(true);
  const i = $('#sq');
  if (i) i.focus();
}

function flav(b, f) {
  const l = left(b, f),
    c = S.cart[f] || 0,
    ch = f >= 100,
    mx = ch ? Math.floor((chLeft(b) - cartLit(f) + 1e-9) / CL[f - 100]) : l,
    t = ch ? 0 : load(b, f) + tx(b, f, 'to') - tx(b, f, 'from'),
    pc = t > 0 ? Math.max(0, Math.min(100, Math.round((l / t) * 100))) : 0,
    ok = l > 0 && (ch || price(f) > 0),
    sub =
      money(price(f)) +
      (ch
        ? ' · descuenta ' + CL[f - 100] + ' L'
        : l > 0 && price(f) > 0
          ? ` · <span class="${l <= 3 ? 'low' : ''}">${l} ${l == 1 ? 'queda' : 'quedan'}</span>`
          : ''),
    side = c
      ? `<div class="st" onclick="event.stopPropagation()"><button class="gh" aria-label="Quitar uno" onclick="cadd(${f},-1)">−</button><b>${c}</b><button aria-label="Agregar uno" onclick="cadd(${f},1)" ${c >= mx ? 'disabled' : ''}>+</button></div>`
      : ch
        ? l <= 0
          ? '<span class="chip bad">No alcanza</span>'
          : '<span class="add" aria-hidden="true">+</span>'
        : !price(f)
          ? '<span class="chip bad">Sin precio</span>'
          : l <= 0
            ? '<span class="chip bad">Agotado</span>'
            : '<span class="add" aria-hidden="true">+</span>';
  return `<div class="fl ${l <= 0 ? 'out' : ''} ${c ? 'sel' : ''} ${ch ? 'ch' : isD(f) ? 'd' : 's'}" ${ok ? `onclick="cadd(${f},1)"` : ''}><div class="fn"><b>${ch ? '☕ ' + CH[f - 100][0] + ' · ' + CH[f - 100][1] : nm(f)}</b><small>${sub}</small>${!ch && t > 0 && l > 0 ? `<div class="fm"><i class="${l <= 3 ? 'low' : ''}" style="width:${pc}%"></i></div>` : ''}</div>${side}</div>`;
}

function chHead(b) {
  const l = chLeft(b),
    c = cartLit(-1),
    t = chLoad(b),
    pa = t > 0 ? Math.max(0, Math.min(100, ((l - c) / t) * 100)) : 0,
    pb = t > 0 ? Math.max(0, Math.min(100 - pa, (c / t) * 100)) : 0;
  return `<div class="card chh"><div class="chx"><b>☕ Champurrado</b><small>${l <= 0 ? 'Se acabó el champurrado de hoy' : (c > 0 ? 'Con este pedido quedarían ' + r2(l - c) + ' L · ' : '') + 'Los litros se comparten entre chico, mediano y grande'}</small></div><div class="lt">${l} L</div>${t > 0 ? `<div class="glv"><i class="g1" style="width:${pa}%"></i><i class="g2" style="width:${pb}%"></i></div>` : ''}</div>`;
}

function flList(b) {
  const t = S.cat || 't',
    a = F.map((n, f) => f)
      .filter(inCat)
      .sort((x, y) => (left(b, x) <= 0) - (left(b, y) <= 0))
      .map(f => flav(b, f))
      .join(''),
    q = S.q ? norm(S.q) : '',
    ch =
      t == 't' || t == 'b'
        ? CH.map((c, i) => 100 + i)
            .filter(f => !q || norm(nm(f)).includes(q))
            .sort((x, y) => (left(b, x) <= 0) - (left(b, y) <= 0))
            .map(f => flav(b, f))
            .join('')
        : '';
  return (
    a + (ch ? chHead(b) + ch : '') ||
    '<div class="card"><small>No hay sabores con ese nombre.</small></div>'
  );
}

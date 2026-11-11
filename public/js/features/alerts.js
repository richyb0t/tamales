/* Alertas de existencias bajas. */

/* alertas de existencias bajas (administrador y encargado de pedidos) */
function lowList() {
  const T = lowT(),
    LL = lowL(),
    o = [];
  BI().forEach(b => {
    F.forEach((n, f) => {
      if (load(b, f) + tx(b, f, 'to') <= 0) return;
      const l = left(b, f);
      if (l <= T) o.push({ b, n, l, o: l <= 0 });
    });
    if (chLoad(b) + txc(b, 'to') > 0) {
      const l = chLeft(b);
      if (l <= LL) o.push({ b, n: 'Champurrado', l, o: l <= 0, L: 1 });
    }
  });
  return o;
}

function alertCard() {
  const l = lowList();
  if (!l.length) return '';
  const H = !!S.me && (S.me.role == 'admin' || S.me.role == 'enc');
  if (H && S.alHide) {
    const o = l.filter(x => x.o).length,
      w = l.length - o;
    return `<div class="card alb" style="border:2px solid ${o ? 'var(--bad)' : 'var(--low)'}"><span>${[o ? '🚫 ' + o + (o == 1 ? ' agotado' : ' agotados') : '', w ? '⚠️ ' + w + ' por agotarse' : ''].filter(Boolean).join(' · ')}</span><button class="gh" onclick="S.alHide=false;render(true)">Mostrar</button></div>`;
  }
  const sec = (arr, title, col) => {
    if (!arr.length) return '';
    return `<div style="margin-top:12px"><b style="color:${col}">${title}</b>${arr
      .map(
        x =>
          `<div class="row"><div><b>${esc(x.n)}</b><br><small>${esc(brs()[x.b])}${x.o ? '' : ' · ' + x.l + (x.L ? ' L' : '')}</small></div></div>`
      )
      .join('')}</div>`;
  };
  const out = l.filter(x => x.o),
    low = l.filter(x => !x.o);
  return `<div class="card" style="border:2px solid ${out.length ? 'var(--bad)' : 'var(--low)'}"><div class="alr"><h3 style="margin:0">Existencias</h3>${H ? '<button class="gh" onclick="S.alHide=true;render(true)">Ocultar</button>' : ''}</div>${sec(out, '🚫 Agotados', 'var(--bad)')}${sec(low, '⚠️ Por agotarse', 'var(--low)')}<small>Se avisa cuando quedan ${lowT()} o menos por sabor (${lowL()} L de champurrado).</small></div>`;
}

function chkAlerts() {
  const cur = new Set(lowList().map(x => x.b + '|' + x.n + '|' + (x.o ? 1 : 0)));
  if (Date.now() < (S.alAfter || 0) || !S.alSeen) {
    S.alSeen = cur;
    return;
  }
  const nw = [...cur].filter(k => !S.alSeen.has(k));
  if (nw.length) {
    const [b, n, o] = nw[0].split('|');
    toast('⚠️ ' + (o == '1' ? 'Se agotó ' : 'Se acaba ') + n + ' en ' + brs()[b]);
    vib();
  }
  S.alSeen = cur;
}

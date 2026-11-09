/* Catálogo y constantes del negocio: sabores, champurrado, roles y secciones. */

const F = [
  'Mole rojo',
  'Mole verde',
  'Rajas con queso',
  'Chicharrón',
  'Costilla en salsa verde',
  'Pollo con verduras',
  'Hawaiano',
  'Champiñón con queso',
  'Fresa',
  'Piña',
  'Philadelphia con zarzamora',
  'Elote',
  'Chocorrol',
  'Gansito',
];

const CH = [
  ['Chico', '250 ml', 20],
  ['Mediano', '500 ml', 30],
  ['Grande', '1 l', 50],
];

const nm = f =>
  f >= 100 ? 'Champurrado ' + CH[f - 100][0].toLowerCase() + ' ' + CH[f - 100][1] : F[f];

const ROLE = { admin: 'Administrador', sup: 'Supervisor', vend: 'Vendedor', enc: 'Pedidos', rep: 'Repartidor' };

const TL = {
  vendido: 'Vendido',
  apartado: '<b class="low">Apartado</b>',
  devolucion: '<b class="bad">Devolución</b>',
};

const SEC = {
  ap: 'Apartados',
  res: 'Resumen',
  inv: 'Inventario',
  tr: 'Traspasos',
  ct: 'Cortes',
  dv: 'Repartos',
  rp: 'Reportes',
  us: 'Usuarios',
  aj: 'Ajustes',
};

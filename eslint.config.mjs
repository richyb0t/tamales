import fs from 'node:fs';
import path from 'node:path';
import globals from 'globals';
import * as espree from 'espree';

/* Los scripts de public/js son clásicos y comparten ámbito global (los onclick del HTML generado
   llaman a esas funciones). Los nombres compartidos se calculan solos leyendo las declaraciones de
   nivel superior de cada archivo, así la lista nunca se desactualiza. */
const JS_DIR = 'public/js';
const walk = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const f = path.join(dir, e.name);
    return e.isDirectory() ? walk(f) : f.endsWith('.js') ? [f] : [];
  });

const shared = {};
for (const file of walk(JS_DIR)) {
  if (file.endsWith('firebase.js')) continue;
  const { body } = espree.parse(fs.readFileSync(file, 'utf8'), {
    ecmaVersion: 2022,
    sourceType: 'script',
  });
  for (const node of body) {
    if (node.type === 'FunctionDeclaration') shared[node.id.name] = 'readonly';
    if (node.type === 'VariableDeclaration')
      node.declarations.forEach(d => (shared[d.id.name] = 'readonly'));
  }
}

export default [
  {
    files: ['public/js/**/*.js'],
    ignores: ['public/js/firebase.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: { ...globals.browser, ...shared, FB: 'readonly' },
    },
    rules: {
      'no-undef': 'error',
      'no-redeclare': ['error', { builtinGlobals: false }],
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-else-if': 'error',
      'no-unreachable': 'warn',
      'no-unsafe-negation': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      /* Las funciones se invocan desde atributos onclick/oninput generados como texto: no se pueden
         detectar como «usadas», por eso no-unused-vars queda apagada. */
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['public/js/firebase.js', 'public/sw.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.serviceworker },
    },
  },
];

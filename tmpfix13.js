const fs = require('fs');
const p = 'public/js/features/deliveries.js';
let s = fs.readFileSync(p, 'utf8');
const oldB = fs.readFileSync('tmpfix13_oldB.txt', 'utf8').replace(/\r?\n$/, '').replace(/\n/g, '\r\n');
const newB = fs.readFileSync('tmpfix13_newB.txt', 'utf8').replace(/\r?\n$/, '').replace(/\n/g, '\r\n');
if (!s.includes(oldB)) { console.log('B NOT FOUND'); process.exit(1); }
s = s.split(oldB).join(newB);
fs.writeFileSync(p, s);
console.log('ok');

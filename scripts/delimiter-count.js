const fs = require('fs');
const p = 'components/inventory/pos-sales.tsx';
const s = fs.readFileSync(p, 'utf8');
const counts = {
  backtick: (s.match(/`/g) || []).length,
  single: (s.match(/'/g) || []).length,
  double: (s.match(/"/g) || []).length,
  openParen: (s.match(/\(/g) || []).length,
  closeParen: (s.match(/\)/g) || []).length,
  openBrace: (s.match(/{/g) || []).length,
  closeBrace: (s.match(/}/g) || []).length,
  lt: (s.match(/</g) || []).length,
  gt: (s.match(/>/g) || []).length,
};
console.log('counts:', counts);
for (const k of ['backtick','single','double','openParen','closeParen','openBrace','closeBrace','lt','gt']){
  if (counts[k] % 2 !== 0) console.log('odd count:', k, counts[k]);
}

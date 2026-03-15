const fs = require('fs');
const s = fs.readFileSync('components/inventory/pos-sales.tsx','utf8');
const openDiv = (s.match(/<div\b/g)||[]).length;
const closeDiv = (s.match(/<\/div>/g)||[]).length;
const openCardContent = (s.match(/<CardContent\b/g)||[]).length;
const closeCardContent = (s.match(/<\/CardContent>/g)||[]).length;
console.log('div open',openDiv,'close',closeDiv);
console.log('CardContent open',openCardContent,'close',closeCardContent);

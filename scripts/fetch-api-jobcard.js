const http = require('http');

const id = process.argv[2] || 'cmm4v2l1v0004odl083vr90nx';
const url = `http://localhost:3000/api/jobcards/find?id=${id}`;

http.get(url, (res) => {
  console.log('STATUS:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    console.log('BODY:', data);
  });
}).on('error', (e) => {
  console.error('ERROR:', e);
});

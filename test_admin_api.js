const http = require('http');

const data = JSON.stringify({
  customerId: 'c1', // this ID probably doesn't exist anymore, let's just see if API throws 404 or 500
  amount: 100,
  reason: 'Test'
});

const req = http.request('http://localhost:3000/api/admin/customers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Status:', res.statusCode, 'Body:', body));
});

req.on('error', e => console.error(e));
req.write(data);
req.end();

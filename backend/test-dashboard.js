const http = require('http');

// Test the admin dashboard endpoint
const options = {
  hostname: 'localhost',
  port: 8081,
  path: '/api/admin/dashboard',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer test-token',
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Request error:', e);
});

req.end();

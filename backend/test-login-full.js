const http = require('http');

// Test login first
const loginData = JSON.stringify({
  email: 'shettyrishab10@gmail.com',
  password: 'Rishab@123'
});

const loginOptions = {
  hostname: 'localhost',
  port: 8081,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData)
  }
};

const loginReq = http.request(loginOptions, (res) => {
  console.log('Login Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Login Response:', data);
    
    try {
      const loginResult = JSON.parse(data);
      if (loginResult.success && loginResult.token) {
        console.log('✅ Login successful! Token:', loginResult.token);
        
        // Now test admin dashboard with the token
        const dashboardOptions = {
          hostname: 'localhost',
          port: 8081,
          path: '/api/admin/dashboard',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${loginResult.token}`,
            'Content-Type': 'application/json'
          }
        };
        
        const dashboardReq = http.request(dashboardOptions, (dashboardRes) => {
          console.log('Dashboard Status:', dashboardRes.statusCode);
          
          let dashboardData = '';
          dashboardRes.on('data', (chunk) => {
            dashboardData += chunk;
          });
          
          dashboardRes.on('end', () => {
            console.log('Dashboard Response:', dashboardData);
          });
        });
        
        dashboardReq.on('error', (e) => {
          console.error('Dashboard request error:', e);
        });
        
        dashboardReq.end();
      }
    } catch (e) {
      console.error('Failed to parse login response:', e);
    }
  });
});

loginReq.on('error', (e) => {
  console.error('Login request error:', e);
});

loginReq.write(loginData);
loginReq.end();

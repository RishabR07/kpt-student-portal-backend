const http = require('http');

// Test teacher login first
const loginData = JSON.stringify({
  email: 'shettyrishith09@gmail.com',
  password: 'Temp@123'
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
  console.log('Teacher Login Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const loginResult = JSON.parse(data);
      if (loginResult.success && loginResult.token) {
        console.log('✅ Teacher login successful!');
        console.log('Must change password:', loginResult.user.mustChangePassword);
        
        // Test teacher dashboard
        const dashboardOptions = {
          hostname: 'localhost',
          port: 8081,
          path: '/api/teacher/dashboard',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${loginResult.token}`,
            'Content-Type': 'application/json'
          }
        };

        const dashboardReq = http.request(dashboardOptions, (dashboardRes) => {
          console.log('Teacher Dashboard Status:', dashboardRes.statusCode);
          
          let dashboardData = '';
          dashboardRes.on('data', (chunk) => {
            dashboardData += chunk;
          });
          
          dashboardRes.on('end', () => {
            console.log('Teacher Dashboard Response:', dashboardData);
          });
        });
        
        dashboardReq.on('error', (e) => {
          console.error('Teacher dashboard error:', e);
        });
        
        dashboardReq.end();
      } else {
        console.log('❌ Teacher login failed:', data);
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

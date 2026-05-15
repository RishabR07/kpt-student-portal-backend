const http = require('http');

// Test login as student first
const loginData = JSON.stringify({
  email: 'teststudent@example.com',
  password: 'Student@123'
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
  console.log('Student Login Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const loginResult = JSON.parse(data);
      if (loginResult.success && loginResult.token) {
        console.log('✅ Student login successful!');
        
        // Test student dashboard
        const dashboardOptions = {
          hostname: 'localhost',
          port: 8081,
          path: '/api/student/dashboard',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${loginResult.token}`,
            'Content-Type': 'application/json'
          }
        };

        const dashboardReq = http.request(dashboardOptions, (dashboardRes) => {
          console.log('Student Dashboard Status:', dashboardRes.statusCode);
          
          let dashboardData = '';
          dashboardRes.on('data', (chunk) => {
            dashboardData += chunk;
          });
          
          dashboardRes.on('end', () => {
            console.log('Student Dashboard Response:', dashboardData);
          });
        });
        
        dashboardReq.on('error', (e) => {
          console.error('Student dashboard error:', e);
        });
        
        dashboardReq.end();
      } else {
        console.log('❌ Student login failed:', data);
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

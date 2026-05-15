const http = require('http');

// Login as admin and reset teacher password
const adminLoginData = JSON.stringify({
  email: 'shettyrishab10@gmail.com',
  password: 'Rishab@123'
});

const adminLoginOptions = {
  hostname: 'localhost',
  port: 8081,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(adminLoginData)
  }
};

const adminLoginReq = http.request(adminLoginOptions, (res) => {
  console.log('Admin Login Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const adminResult = JSON.parse(data);
      if (adminResult.success && adminResult.token) {
        console.log('✅ Admin login successful!');
        
        // Reset teacher password
        const resetData = JSON.stringify({});
        const resetOptions = {
          hostname: 'localhost',
          port: 8081,
          path: '/api/admin/users/25378657-0eb4-48cc-b229-da1aff361d00/reset-password', // Use teacher ID from earlier
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminResult.token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(resetData)
          }
        };

        const resetReq = http.request(resetOptions, (resetRes) => {
          console.log('Reset Teacher Password Status:', resetRes.statusCode);
          
          let resetData = '';
          resetRes.on('data', (chunk) => {
            resetData += chunk;
          });
          
          resetRes.on('end', () => {
            try {
              const resetResult = JSON.parse(resetData);
              if (resetResult.success) {
                console.log('✅ Teacher password reset!');
                console.log('New temporary password:', resetResult.tempPassword);
                console.log('');
                console.log('🎯 TEACHER LOGIN CREDENTIALS:');
                console.log('Email: shettyrishith09@gmail.com');
                console.log('Password:', resetResult.tempPassword);
              }
            } catch (e) {
              console.error('Failed to parse reset response:', e);
            }
          });
        });
        
        resetReq.on('error', (e) => {
          console.error('Reset password error:', e);
        });
        
        resetReq.write(resetData);
        resetReq.end();
      }
    } catch (e) {
      console.error('Failed to parse admin login response:', e);
    }
  });
});

adminLoginReq.on('error', (e) => {
  console.error('Admin login error:', e);
});

adminLoginReq.write(adminLoginData);
adminReq.end();

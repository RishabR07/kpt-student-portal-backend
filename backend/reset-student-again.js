const http = require('http');

// Login as admin and reset student password to set must_change_password = 1
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
        
        // Reset student password to set must_change_password = 1
        const resetData = JSON.stringify({});
        const resetOptions = {
          hostname: 'localhost',
          port: 8081,
          path: '/api/admin/users/0975c1f1-0931-4e51-9e65-5afeb0e9a5e1/reset-password',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminResult.token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(resetData)
          }
        };

        const resetReq = http.request(resetOptions, (resetRes) => {
          console.log('Reset Password Status:', resetRes.statusCode);
          
          let resetData = '';
          resetRes.on('data', (chunk) => {
            resetData += chunk;
          });
          
          resetRes.on('end', () => {
            try {
              const resetResult = JSON.parse(resetData);
              if (resetResult.success) {
                console.log('✅ Student password reset again!');
                console.log('New temporary password:', resetResult.tempPassword);
                console.log('');
                console.log('🎯 NOW YOU CAN TEST:');
                console.log('1. Login as student with:', resetResult.tempPassword);
                console.log('2. Try to change password WITHOUT current password');
                console.log('3. It should work now because must_change_password = 1');
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
adminLoginReq.end();

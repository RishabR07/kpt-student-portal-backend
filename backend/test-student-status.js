const http = require('http');

// Test student login and check their status
const loginData = JSON.stringify({
  email: 'shettyrishab35@gmail.com',
  password: 'NewStudentPassword123' // Use the password we set earlier
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
        console.log('Must change password:', loginResult.user.mustChangePassword);
        
        // Test change password with only new password (no current password)
        const changePasswordData = JSON.stringify({
          newPassword: 'FinalPassword123'
        });

        const changePasswordOptions = {
          hostname: 'localhost',
          port: 8081,
          path: '/api/auth/change-password',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${loginResult.token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(changePasswordData)
          }
        };

        const changePasswordReq = http.request(changePasswordOptions, (changePasswordRes) => {
          console.log('Change Password Status:', changePasswordRes.statusCode);
          
          let changePasswordData = '';
          changePasswordRes.on('data', (chunk) => {
            changePasswordData += chunk;
          });
          
          changePasswordRes.on('end', () => {
            console.log('Change Password Response:', changePasswordData);
          });
        });
        
        changePasswordReq.on('error', (e) => {
          console.error('Change password error:', e);
        });
        
        changePasswordReq.write(changePasswordData);
        changePasswordReq.end();
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

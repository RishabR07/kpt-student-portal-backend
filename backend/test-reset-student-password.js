const http = require('http');

// First login as admin
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
  console.log('Admin Login Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const loginResult = JSON.parse(data);
      if (loginResult.success && loginResult.token) {
        console.log('✅ Admin login successful!');
        
        // Reset student password
        const resetData = JSON.stringify({});
        const resetOptions = {
          hostname: 'localhost',
          port: 8081,
          path: '/api/admin/users/0975c1f1-0931-4e51-9e65-5afeb0e9a5e1/reset-password', // Use the student ID from earlier
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${loginResult.token}`,
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
                console.log('✅ Student password reset successfully!');
                console.log('New temporary password:', resetResult.tempPassword);
                
                // Now test student login with new password
                const studentLoginData = JSON.stringify({
                  email: 'shettyrishab35@gmail.com',
                  password: resetResult.tempPassword
                });

                const studentLoginOptions = {
                  hostname: 'localhost',
                  port: 8081,
                  path: '/api/auth/login',
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(studentLoginData)
                  }
                };

                const studentLoginReq = http.request(studentLoginOptions, (studentLoginRes) => {
                  console.log('Student Login Status:', studentLoginRes.statusCode);
                  
                  let studentData = '';
                  studentLoginRes.on('data', (chunk) => {
                    studentData += chunk;
                  });
                  
                  studentLoginRes.on('end', () => {
                    console.log('Student Login Response:', studentData);
                  });
                });
                
                studentLoginReq.on('error', (e) => {
                  console.error('Student login error:', e);
                });
                
                studentLoginReq.write(studentLoginData);
                studentLoginReq.end();
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
      console.error('Failed to parse login response:', e);
    }
  });
});

loginReq.on('error', (e) => {
  console.error('Login request error:', e);
});

loginReq.write(loginData);
loginReq.end();

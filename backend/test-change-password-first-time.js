const http = require('http');

// First reset student password to ensure must_change_password = 1
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
                console.log('✅ Student password reset!');
                console.log('New temp password:', resetResult.tempPassword);
                
                // Now test student login and password change without current password
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
                    try {
                      const studentResult = JSON.parse(studentData);
                      if (studentResult.success && studentResult.token) {
                        console.log('✅ Student login successful!');
                        console.log('Must change password:', studentResult.user.mustChangePassword);
                        
                        // Test change password WITHOUT current password (first-time user)
                        const changePasswordData = JSON.stringify({
                          newPassword: 'NewStudentPassword123'
                        });

                        const changePasswordOptions = {
                          hostname: 'localhost',
                          port: 8081,
                          path: '/api/auth/change-password',
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${studentResult.token}`,
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
                      }
                    } catch (e) {
                      console.error('Failed to parse student login response:', e);
                    }
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
      console.error('Failed to parse admin login response:', e);
    }
  });
});

adminLoginReq.on('error', (e) => {
  console.error('Admin login error:', e);
});

adminLoginReq.write(adminLoginData);
adminLoginReq.end();

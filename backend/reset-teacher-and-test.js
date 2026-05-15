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
          path: '/api/admin/users/25378657-0eb4-48cc-b229-da1aff361d00/reset-password',
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
                
                // Now test teacher login and dashboard
                const teacherLoginData = JSON.stringify({
                  email: 'shettyrishith09@gmail.com',
                  password: resetResult.tempPassword
                });

                const teacherLoginOptions = {
                  hostname: 'localhost',
                  port: 8081,
                  path: '/api/auth/login',
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(teacherLoginData)
                  }
                };

                const teacherLoginReq = http.request(teacherLoginOptions, (teacherLoginRes) => {
                  console.log('Teacher Login Status:', teacherLoginRes.statusCode);
                  
                  let teacherData = '';
                  teacherLoginRes.on('data', (chunk) => {
                    teacherData += chunk;
                  });
                  
                  teacherLoginRes.on('end', () => {
                    try {
                      const teacherResult = JSON.parse(teacherData);
                      if (teacherResult.success && teacherResult.token) {
                        console.log('✅ Teacher login successful!');
                        console.log('Must change password:', teacherResult.user.mustChangePassword);
                        
                        // Test teacher dashboard
                        const dashboardOptions = {
                          hostname: 'localhost',
                          port: 8081,
                          path: '/api/teacher/dashboard',
                          method: 'GET',
                          headers: {
                            'Authorization': `Bearer ${teacherResult.token}`,
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
                        console.log('❌ Teacher login failed:', teacherData);
                      }
                    } catch (e) {
                      console.error('Failed to parse teacher login response:', e);
                    }
                  });
                });
                
                teacherLoginReq.on('error', (e) => {
                  console.error('Teacher login error:', e);
                });
                
                teacherLoginReq.write(teacherLoginData);
                teacherLoginReq.end();
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

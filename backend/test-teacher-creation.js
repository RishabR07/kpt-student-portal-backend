const http = require('http');

// Test login first to get token
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
    try {
      const loginResult = JSON.parse(data);
      if (loginResult.success && loginResult.token) {
        console.log('✅ Login successful!');
        
        // Now test teacher creation
        const teacherData = JSON.stringify({
          name: 'Teacher OP',
          email: 'shettyrishith09@gmail.com',
          role: 'teacher',
          department: 'Computer Science and Engineering',
          employeeId: '103KPT001'
        });

        const teacherOptions = {
          hostname: 'localhost',
          port: 8081,
          path: '/api/admin/users',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${loginResult.token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(teacherData)
          }
        };

        const teacherReq = http.request(teacherOptions, (teacherRes) => {
          console.log('Teacher Creation Status:', teacherRes.statusCode);
          
          let teacherData = '';
          teacherRes.on('data', (chunk) => {
            teacherData += chunk;
          });
          
          teacherRes.on('end', () => {
            console.log('Teacher Creation Response:', teacherData);
          });
        });
        
        teacherReq.on('error', (e) => {
          console.error('Teacher creation error:', e);
        });
        
        teacherReq.write(teacherData);
        teacherReq.end();
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

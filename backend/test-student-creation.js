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
        
        // Now test student creation
        const studentData = JSON.stringify({
          name: 'Student OP',
          email: 'shettyrishab35@gmail.com',
          role: 'student',
          department: 'Computer Science and Engineering',
          rollNumber: '103CS23040',
          semester: 6
        });

        const studentOptions = {
          hostname: 'localhost',
          port: 8081,
          path: '/api/admin/users',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${loginResult.token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(studentData)
          }
        };

        const studentReq = http.request(studentOptions, (studentRes) => {
          console.log('Student Creation Status:', studentRes.statusCode);
          
          let studentData = '';
          studentRes.on('data', (chunk) => {
            studentData += chunk;
          });
          
          studentRes.on('end', () => {
            console.log('Student Creation Response:', studentData);
          });
        });
        
        studentReq.on('error', (e) => {
          console.error('Student creation error:', e);
        });
        
        studentReq.write(studentData);
        studentReq.end();
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

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
        
        // Test updating the existing student we created earlier
        const updateData = JSON.stringify({
          name: 'Updated Test Student',
          email: 'teststudent@example.com',
          department: 'Updated Computer Science',
          role: 'student'
        });

        const updateOptions = {
          hostname: 'localhost',
          port: 8081,
          path: '/api/admin/users/ff2b00bd-0f2e-42e9-8b2d-108897eab553', // Use the ID from earlier test
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${loginResult.token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(updateData)
          }
        };

        const updateReq = http.request(updateOptions, (updateRes) => {
          console.log('Update User Status:', updateRes.statusCode);
          
          let updateData = '';
          updateRes.on('data', (chunk) => {
            updateData += chunk;
          });
          
          updateRes.on('end', () => {
            console.log('Update User Response:', updateData);
          });
        });
        
        updateReq.on('error', (e) => {
          console.error('Update user error:', e);
        });
        
        updateReq.write(updateData);
        updateReq.end();
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

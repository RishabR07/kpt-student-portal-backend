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
        
        // First create a test student to update
        const studentData = JSON.stringify({
          name: 'Test Student',
          email: 'teststudent@example.com',
          role: 'student',
          department: 'Computer Science',
          rollNumber: 'CS001',
          semester: 1
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
            try {
              const studentResult = JSON.parse(studentData);
              if (studentResult.success) {
                console.log('✅ Student created with ID:', studentResult.user.id);
                
                // Now test updating the student
                const updateData = JSON.stringify({
                  name: 'Updated Student Name',
                  email: 'updatedstudent@example.com',
                  department: 'Updated Department',
                  role: 'student'
                });

                const updateOptions = {
                  hostname: 'localhost',
                  port: 8081,
                  path: `/api/admin/users/${studentResult.user.id}`,
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
              console.error('Failed to parse student response:', e);
            }
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

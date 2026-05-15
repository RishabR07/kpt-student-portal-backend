const http = require('http');

// Test teacher login first
const loginData = JSON.stringify({
  email: 'shettyrishith09@gmail.com',
  password: 'LL30JB7J'
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
  console.log('Teacher Login Status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const loginResult = JSON.parse(data);
      if (loginResult.success && loginResult.token) {
        console.log('✅ Teacher login successful!');
        
        // Test creating a subject
        const subjectData = JSON.stringify({
          code: '103KPTDBMS',
          name: 'Data Base Management System',
          description: 'Brief description of the subject...',
          credits: 4,
          semester: 3,
          max_students: 63
        });

        const subjectOptions = {
          hostname: 'localhost',
          port: 8081,
          path: '/api/teacher/subjects',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${loginResult.token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(subjectData)
          }
        };

        const subjectReq = http.request(subjectOptions, (subjectRes) => {
          console.log('Create Subject Status:', subjectRes.statusCode);
          
          let subjectData = '';
          subjectRes.on('data', (chunk) => {
            subjectData += chunk;
          });
          
          subjectRes.on('end', () => {
            console.log('Create Subject Response:', subjectData);
          });
        });
        
        subjectReq.on('error', (e) => {
          console.error('Create subject error:', e);
        });
        
        subjectReq.write(subjectData);
        subjectReq.end();
      } else {
        console.log('❌ Teacher login failed:', data);
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

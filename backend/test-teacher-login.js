const http = require('http');

// Test teacher login
const testData = {
  email: 'user_3AsY276SCfWZjXTHIz5iwydj94E@clerk.local', // Teacher email from logs
  password: 'Temp123!' // Default temp password
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 8081,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
    try {
      const response = JSON.parse(data);
      if (response.success && response.token) {
        console.log('✅ Login successful!');
        console.log(`👤 User: ${response.user.email}`);
        console.log(`🔐 Role: ${response.user.role}`);
        console.log(`🔄 Needs password change: ${response.user.needsPasswordChange}`);
        
        // Test teacher me endpoint
        testTeacherMe(response.token);
      }
    } catch (e) {
      console.log('Failed to parse response:', e);
    }
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();

function testTeacherMe(token) {
  const options = {
    hostname: 'localhost',
    port: 8081,
    path: '/api/teacher/me',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const req = http.request(options, (res) => {
    console.log(`\nTeacher Me Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Teacher Me Response:', data);
    });
  });

  req.on('error', (e) => {
    console.error(`Teacher Me request error: ${e.message}`);
  });

  req.end();
}

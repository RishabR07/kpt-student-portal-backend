const http = require('http');

// Step 1: Login to get token
const loginData = {
  email: 'user_3AsY276SCfWZjXTHIz5iwydj94E@clerk.local', // Teacher email from logs
  password: 'Temp123!' // Default temp password
};

const loginOptions = {
  hostname: 'localhost',
  port: 8081,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(JSON.stringify(loginData))
  }
};

console.log('🔐 Step 1: Logging in teacher...');

const loginReq = http.request(loginOptions, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Login Status: ${res.statusCode}`);
    console.log('Login Response:', data);
    
    try {
      const response = JSON.parse(data);
      if (response.success && response.token) {
        console.log('✅ Login successful!');
        console.log(`👤 User: ${response.user.email}`);
        console.log(`🔐 Role: ${response.user.role}`);
        
        // Step 2: Test teacher me endpoint with token
        testTeacherMe(response.token);
      } else {
        console.log('❌ Login failed:', response.error);
      }
    } catch (e) {
      console.log('Failed to parse response:', e);
    }
  });
});

loginReq.on('error', (e) => {
  console.error(`Login request error: ${e.message}`);
});

loginReq.write(JSON.stringify(loginData));
loginReq.end();

function testTeacherMe(token) {
  console.log('\n🔐 Step 2: Testing teacher me endpoint...');
  
  const meOptions = {
    hostname: 'localhost',
    port: 8081,
    path: '/api/teacher/me',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  };

  const meReq = http.request(meOptions, (res) => {
    console.log(`Teacher Me Status: ${res.statusCode}`);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      console.log('Teacher Me Response:', data);
      try {
        const response = JSON.parse(data);
        if (response.id) {
          console.log('✅ Teacher me endpoint working!');
          console.log(`👤 Teacher: ${response.name} (${response.email})`);
          console.log(`🆔 Employee ID: ${response.employeeId}`);
        } else {
          console.log('❌ Teacher me failed:', response.error);
        }
      } catch (e) {
        console.log('Failed to parse response:', e);
      }
    });
  });

  meReq.on('error', (e) => {
    console.error(`Teacher me request error: ${e.message}`);
  });

  meReq.end();
}

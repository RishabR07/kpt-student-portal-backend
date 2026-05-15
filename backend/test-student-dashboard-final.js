const http = require('http');

// Test student dashboard with the new token
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwOTc1YzFmMS0wOTMxLTRlNTEtOWU2NS01YWZlYjBlOWE1ZTEiLCJlbWFpbCI6InNoZXR0eXJpc2hhYjM1QGdtYWlsLmNvbSIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzc0OTM0OTc5LCJleHAiOjE3NzUwMjEzNzl9.V1YNAWo5NFOj-3iMIZBCGtTptfF0euBzEURd8-MOIvk";

const dashboardOptions = {
  hostname: 'localhost',
  port: 8081,
  path: '/api/student/dashboard',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const dashboardReq = http.request(dashboardOptions, (dashboardRes) => {
  console.log('Student Dashboard Status:', dashboardRes.statusCode);
  
  let dashboardData = '';
  dashboardRes.on('data', (chunk) => {
    dashboardData += chunk;
  });
  
  dashboardRes.on('end', () => {
    console.log('Student Dashboard Response:', dashboardData);
  });
});

dashboardReq.on('error', (e) => {
  console.error('Student dashboard error:', e);
});

dashboardReq.end();

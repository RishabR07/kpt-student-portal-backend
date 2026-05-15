const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Load environment variables
function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (!key) continue;
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[key] = value;
    }
  } catch (e) {
    console.error('Failed to load .env file:', e);
  }
}

loadEnvFile(path.join(__dirname, '.env'));

async function checkUserRoles() {
  try {
    const pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'kpt_student_management',
      waitForConnections: true,
      connectionLimit: 10,
    });

    console.log('=== CHECKING USER ROLES ===\n');

    // Check the specific user from logs
    const clerkUserId = 'user_3AsY276SCfWZjXTHIz5iwydj94E';
    const internalUserId = '8e66d351-fba0-4b75-8b18-d46be50bcdac';

    console.log(`🔍 Checking user: ${clerkUserId}`);
    console.log(`🆔 Internal ID: ${internalUserId}`);

    // Check users table
    const [userRows] = await pool.execute(`
      SELECT id, email, clerk_user_id FROM users WHERE id = ?
    `, [internalUserId]);

    console.log('\n👤 Users Table:');
    userRows.forEach(row => {
      console.log(`  ID: ${row.id}`);
      console.log(`  Email: ${row.email}`);
      console.log(`  Clerk ID: ${row.clerk_user_id}`);
    });

    // Check profiles table
    const [profileRows] = await pool.execute(`
      SELECT id, name, email FROM profiles WHERE id = ?
    `, [internalUserId]);

    console.log('\n📋 Profiles Table:');
    profileRows.forEach(row => {
      console.log(`  ID: ${row.id}`);
      console.log(`  Name: ${row.name}`);
      console.log(`  Email: ${row.email}`);
    });

    // Check user_roles table
    const [roleRows] = await pool.execute(`
      SELECT id, user_id, role FROM user_roles WHERE user_id = ?
    `, [internalUserId]);

    console.log('\n🔐 User Roles Table:');
    roleRows.forEach(row => {
      console.log(`  ID: ${row.id}`);
      console.log(`  User ID: ${row.user_id}`);
      console.log(`  Role: ${row.role}`);
    });

    // Check if user has student record
    const [studentRows] = await pool.execute(`
      SELECT id, roll_number FROM students WHERE user_id = ?
    `, [internalUserId]);

    console.log('\n🎓 Students Table:');
    studentRows.forEach(row => {
      console.log(`  ID: ${row.id}`);
      console.log(`  Roll Number: ${row.roll_number}`);
    });

    // Check if user has teacher record
    const [teacherRows] = await pool.execute(`
      SELECT id, employee_id FROM teachers WHERE user_id = ?
    `, [internalUserId]);

    console.log('\n👨‍🏫 Teachers Table:');
    teacherRows.forEach(row => {
      console.log(`  ID: ${row.id}`);
      console.log(`  Employee ID: ${row.employee_id}`);
    });

    await pool.end();
  } catch (error) {
    console.error('Check user roles error:', error);
  }
}

checkUserRoles();

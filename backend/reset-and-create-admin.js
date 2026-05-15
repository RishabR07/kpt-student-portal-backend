const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
const fs = require('fs');
const path = require('path');

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

async function resetAndCreateAdmin() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'kpt_student_portal'
  });

  try {
    console.log('🗑️  Cleaning up existing data...');
    
    // Delete from dependent tables first (foreign key constraints)
    await connection.execute('DELETE FROM attendance');
    await connection.execute('DELETE FROM marks');
    await connection.execute('DELETE FROM enrollments');
    await connection.execute('DELETE FROM announcement_reads');
    await connection.execute('DELETE FROM event_enrollments');
    await connection.execute('DELETE FROM announcements');
    await connection.execute('DELETE FROM events');
    await connection.execute('DELETE FROM subjects');
    
    // Delete from user-related tables
    await connection.execute('DELETE FROM students');
    await connection.execute('DELETE FROM teachers');
    await connection.execute('DELETE FROM profiles');
    await connection.execute('DELETE FROM user_roles');
    await connection.execute('DELETE FROM users');
    
    console.log('✅ All existing data cleared');

    // Create new admin user
    const adminEmail = 'shettyrishab10@gmail.com';
    const adminPassword = 'Rishab@123';
    const adminName = 'Rishab Shetty';
    const adminDepartment = 'Administration';

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const userId = uuidv4();

    console.log('👤 Creating admin account...');

    // Create user
    await connection.execute(
      'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [userId, adminEmail, hashedPassword]
    );

    // Create profile
    await connection.execute(
      'INSERT INTO profiles (id, name, email, department, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [userId, adminName, adminEmail, adminDepartment]
    );

    // Create admin role
    await connection.execute(
      'INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, NOW())',
      [uuidv4(), userId, 'admin']
    );

    console.log('✅ Admin account created successfully:');
    console.log('   Email:', adminEmail);
    console.log('   Password:', adminPassword);
    console.log('   User ID:', userId);
    console.log('');
    console.log('🚀 You can now login with these credentials and add teachers/students through the admin interface!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await connection.end();
  }
}

resetAndCreateAdmin();

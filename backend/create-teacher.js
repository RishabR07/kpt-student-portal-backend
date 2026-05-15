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

async function createAdminAccount() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'kpt_student_portal'
  });

  try {
    const adminEmail = 'admin@kpt.edu';
    const adminPassword = 'admin@123';
    const adminName = 'Administrator';
    const adminDepartment = 'Administration';

    // Check if user already exists
    const [existingUsers] = await connection.execute(
      'SELECT id, email FROM users WHERE LOWER(email) = ? LIMIT 1',
      [adminEmail.toLowerCase()]
    );

    if (existingUsers.length > 0) {
      console.log('✅ Admin account already exists:', existingUsers[0]);
      
      // Update password anyway
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await connection.execute(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [hashedPassword, existingUsers[0].id]
      );
      console.log('✅ Password updated for existing admin account');
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const userId = uuidv4();

    // Create user
    await connection.execute(
      'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, NOW())',
      [userId, adminEmail, hashedPassword]
    );

    // Create profile
    await connection.execute(
      'INSERT INTO profiles (id, name, email, department) VALUES (?, ?, ?, ?)',
      [userId, adminName, adminEmail, adminDepartment]
    );

    // Create admin role
    await connection.execute(
      'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)',
      [uuidv4(), userId, 'admin']
    );

    console.log('✅ Admin account created successfully:');
    console.log('   Email:', adminEmail);
    console.log('   Password:', adminPassword);
    console.log('   User ID:', userId);

  } catch (error) {
    console.error('❌ Error creating admin account:', error);
  } finally {
    await connection.end();
  }
}

createAdminAccount();

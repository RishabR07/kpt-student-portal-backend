const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

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

async function setupAuthSystem() {
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

    console.log('=== SETTING UP AUTHENTICATION SYSTEM ===\n');

    // 1. Add password column to users table
    console.log('🔧 Adding password column to users table...');
    try {
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN password_hash VARCHAR(255) AFTER email,
        ADD COLUMN password_changed_at TIMESTAMP NULL DEFAULT NULL
      `);
      console.log('✅ Password column added successfully');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ Password column already exists');
      } else {
        throw error;
      }
    }

    // 2. Add password reset tokens table
    console.log('🔧 Creating password reset tokens table...');
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          token VARCHAR(255) NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          used_at TIMESTAMP NULL DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_token (token),
          INDEX idx_user_id (user_id)
        )
      `);
      console.log('✅ Password reset tokens table created');
    } catch (error) {
      console.log('ℹ️ Password reset tokens table may already exist');
    }

    // 3. Update existing users with temporary passwords
    console.log('🔧 Setting temporary passwords for existing users...');
    
    const [users] = await pool.execute(`
      SELECT id, email FROM users 
      WHERE password_hash IS NULL AND email NOT LIKE '%@clerk.local'
    `);

    for (const user of users) {
      const tempPassword = 'Temp123!'; // Default temporary password
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      await pool.execute(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [hashedPassword, user.id]
      );
      
      console.log(`  ✅ Set temp password for: ${user.email}`);
    }

    // 4. Update enrollment logic to prevent duplicates
    console.log('🔧 Checking for duplicate enrollments...');
    const [duplicates] = await pool.execute(`
      SELECT student_id, subject_id, COUNT(*) as count
      FROM enrollments 
      GROUP BY student_id, subject_id 
      HAVING count > 1
    `);

    if (duplicates.length > 0) {
      console.log('⚠️ Found duplicate enrollments:');
      duplicates.forEach(dup => {
        console.log(`  Student: ${dup.student_id}, Subject: ${dup.subject_id}, Count: ${dup.count}`);
      });
      
      // Remove duplicates (keep the latest one)
      for (const dup of duplicates) {
        await pool.execute(`
          DELETE FROM enrollments 
          WHERE student_id = ? AND subject_id = ? 
          AND id NOT IN (
            SELECT id FROM (
              SELECT id FROM enrollments 
              WHERE student_id = ? AND subject_id = ? 
              ORDER BY created_at DESC LIMIT 1
            ) as latest
          )
        `, [dup.student_id, dup.subject_id, dup.student_id, dup.subject_id]);
      }
      console.log('✅ Removed duplicate enrollments');
    }

    console.log('\n🎉 Authentication system setup complete!');
    console.log('📋 Next steps:');
    console.log('1. Update server.js to remove Clerk auth');
    console.log('2. Add JWT-based auth endpoints');
    console.log('3. Update frontend to use custom login forms');

    await pool.end();
  } catch (error) {
    console.error('Setup error:', error);
  }
}

setupAuthSystem();

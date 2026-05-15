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

async function fixDatabase() {
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

    console.log('=== FIXING DATABASE FOR NEW AUTH SYSTEM ===\n');

    // 1. Add password_changed_at column if it doesn't exist
    console.log('🔧 Adding password_changed_at column...');
    try {
      await pool.execute(`
        ALTER TABLE users 
        ADD COLUMN password_changed_at TIMESTAMP NULL DEFAULT NULL
      `);
      console.log('✅ password_changed_at column added');
    } catch (error) {
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('ℹ️ password_changed_at column already exists');
      } else {
        console.log('⚠️ Error adding column:', error.message);
      }
    }

    // 2. Clean up duplicate users and merge data
    console.log('\n🧹 Cleaning up duplicate users...');
    
    // Find users with same email (case-insensitive)
    const [duplicateEmails] = await pool.execute(`
      SELECT LOWER(email) as email_lower, COUNT(*) as count
      FROM users 
      WHERE email NOT LIKE '%@clerk.local'
      GROUP BY LOWER(email)
      HAVING count > 1
    `);

    for (const dup of duplicateEmails) {
      console.log(`  🔄 Processing duplicate email: ${dup.email_lower}`);
      
      // Get all users with this email
      const [users] = await pool.execute(`
        SELECT id, email, created_at 
        FROM users 
        WHERE LOWER(email) = ?
        ORDER BY created_at ASC
      `, [dup.email_lower]);

      if (users.length > 1) {
        // Keep the oldest one, delete others
        const keepUser = users[0];
        const deleteUsers = users.slice(1);
        
        console.log(`    ✅ Keeping: ${keepUser.email} (ID: ${keepUser.id})`);
        
        for (const deleteUser of deleteUsers) {
          console.log(`    🗑️ Deleting: ${deleteUser.email} (ID: ${deleteUser.id})`);
          
          // Move data from deleted user to kept user
          await pool.execute('UPDATE marks SET student_id = ? WHERE student_id IN (SELECT id FROM students WHERE user_id = ?)', [keepUser.id, deleteUser.id]);
          await pool.execute('UPDATE enrollments SET student_id = ? WHERE student_id IN (SELECT id FROM students WHERE user_id = ?)', [keepUser.id, deleteUser.id]);
          await pool.execute('UPDATE attendance SET student_id = ? WHERE student_id IN (SELECT id FROM students WHERE user_id = ?)', [keepUser.id, deleteUser.id]);
          
          // Delete the duplicate user
          await pool.execute('DELETE FROM users WHERE id = ?', [deleteUser.id]);
        }
      }
    }

    // 3. Set temporary passwords for users without passwords
    console.log('\n🔐 Setting temporary passwords...');
    const bcrypt = require('bcrypt');
    
    const [usersWithoutPassword] = await pool.execute(`
      SELECT id, email FROM users 
      WHERE password_hash IS NULL AND email NOT LIKE '%@clerk.local'
    `);

    for (const user of usersWithoutPassword) {
      const tempPassword = 'Temp123!'; // Default temp password
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      
      await pool.execute(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [hashedPassword, user.id]
      );
      
      console.log(`  ✅ Set temp password for: ${user.email}`);
    }

    // 4. Check specific user we're testing
    console.log('\n🔍 Checking shettyrishab035@gmail.com...');
    const [testUser] = await pool.execute(`
      SELECT id, email, password_hash FROM users 
      WHERE LOWER(email) = 'shettyrishab035@gmail.com' 
      LIMIT 1
    `);

    if (testUser.length > 0) {
      const user = testUser[0];
      console.log(`  ✅ User found: ${user.email}`);
      console.log(`  🆔 ID: ${user.id}`);
      console.log(`  🔐 Has password: ${user.password_hash ? 'Yes' : 'No'}`);
      
      if (!user.password_hash) {
        const tempPassword = 'Temp123!';
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
        
        await pool.execute(
          'UPDATE users SET password_hash = ? WHERE id = ?',
          [hashedPassword, user.id]
        );
        
        console.log(`  ✅ Set temp password: ${tempPassword}`);
      }
    } else {
      console.log('  ❌ User not found');
    }

    console.log('\n🎉 Database fix complete!');
    console.log('📋 Ready for testing:');
    console.log('  Email: shettyrishab035@gmail.com');
    console.log('  Password: Temp123!');
    console.log('  Login: http://localhost:5173/login');

    await pool.end();
  } catch (error) {
    console.error('Database fix error:', error);
  }
}

fixDatabase();

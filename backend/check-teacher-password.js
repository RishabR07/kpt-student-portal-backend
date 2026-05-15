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

async function checkTeacherPassword() {
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

    console.log('=== CHECKING TEACHER PASSWORD ===\n');

    const email = 'user_3AsY276SCfWZjXTHIz5iwydj94E@clerk.local';
    const password = 'Temp123!';

    // Check user exists
    const [userRows] = await pool.execute(
      'SELECT id, email, password_hash, password_changed_at FROM users WHERE LOWER(email) = ? LIMIT 1',
      [email.toLowerCase().trim()]
    );

    console.log('👤 Teacher Query Result:');
    if (userRows.length === 0) {
      console.log('  ❌ Teacher not found');
      return;
    }

    const user = userRows[0];
    console.log(`  ✅ Teacher found: ${user.email}`);
    console.log(`  🆔 User ID: ${user.id}`);
    console.log(`  🔐 Has password: ${user.password_hash ? 'Yes' : 'No'}`);
    console.log(`  📅 Password changed: ${user.password_changed_at || 'Never'}`);

    if (!user.password_hash) {
      console.log('  ⚠️ Setting temporary password...');
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await pool.execute(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [hashedPassword, user.id]
      );
      
      console.log('  ✅ Temporary password set successfully');
    } else {
      console.log('  ✅ Teacher already has password');
      
      // Test password verification
      const bcrypt = require('bcrypt');
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      console.log(`  🔍 Password test: ${passwordMatch ? '✅ Match' : '❌ No Match'}`);
    }

    await pool.end();
  } catch (error) {
    console.error('Check teacher password error:', error);
  }
}

checkTeacherPassword();

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

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

async function fixTeacherPassword() {
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

    console.log('=== FIXING TEACHER PASSWORD ===\n');

    const email = 'user_3AsY276SCfWZjXTHIz5iwydj94E@clerk.local';
    const password = 'Temp123!';

    // Get user
    const [userRows] = await pool.execute(
      'SELECT id, email FROM users WHERE LOWER(email) = ? LIMIT 1',
      [email.toLowerCase().trim()]
    );

    if (userRows.length === 0) {
      console.log('❌ Teacher not found');
      return;
    }

    const user = userRows[0];
    console.log(`👤 Found teacher: ${user.email}`);

    // Set new password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await pool.execute(
      'UPDATE users SET password_hash = ?, password_changed_at = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );
    
    console.log(`✅ Password updated to: ${password}`);
    console.log(`🔄 Password changed_at reset to NULL`);

    await pool.end();
  } catch (error) {
    console.error('Fix teacher password error:', error);
  }
}

fixTeacherPassword();

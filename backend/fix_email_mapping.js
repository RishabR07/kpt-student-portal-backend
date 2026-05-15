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

async function fixEmailMapping() {
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

    console.log('=== FIXING EMAIL MAPPING ===\n');

    // Get the profile ID for shettyrishab35@gmail.com
    const [profileRows] = await pool.execute(`
      SELECT id FROM profiles WHERE email = ?
    `, ['shettyrishab35@gmail.com']);

    if (profileRows.length === 0) {
      console.log('❌ Profile not found for shettyrishab35@gmail.com');
      return;
    }

    const profileId = profileRows[0].id;
    console.log(`📧 Profile ID for shettyrishab35@gmail.com: ${profileId}`);

    // Update the student record to use this profile ID as user_id
    const studentIdWithMarks = '15582e11-0786-49f5-a3ce-870f569270ab'; // This has the marks
    
    const [updateResult] = await pool.execute(`
      UPDATE students SET user_id = ? WHERE id = ?
    `, [profileId, studentIdWithMarks]);

    console.log(`✅ Updated student record: ${updateResult.affectedRows} rows affected`);

    // Update user_roles table
    const [roleResult] = await pool.execute(`
      UPDATE user_roles SET user_id = ? WHERE user_id = ?
    `, [profileId, studentIdWithMarks]);

    console.log(`✅ Updated user role: ${roleResult.affectedRows} rows affected`);

    console.log('\n🎉 SUCCESS! Email mapping has been fixed!');
    console.log('👤 Now shettyrishab35@gmail.com should map to the correct student ID with marks');

    await pool.end();
  } catch (error) {
    console.error('Fix email mapping error:', error);
  }
}

fixEmailMapping();

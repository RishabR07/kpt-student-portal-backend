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

async function fixStudentMapping() {
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

    console.log('=== FIXING STUDENT MAPPING ===\n');

    // Current correct mapping for shettyrishab35@gmail.com
    const correctStudentId = '98148061-85bb-406b-98d4-a0b87b3e1938'; // This has the marks
    const wrongStudentId = 'f395254f-6c98-4451-8ac0-42c4e10bb2dc'; // This is what shettyrishab35@gmail.com maps to

    console.log('🔍 Current Situation:');
    console.log(`  Correct Student ID (has marks): ${correctStudentId}`);
    console.log(`  Wrong Student ID (current mapping): ${wrongStudentId}`);

    // Update the student record for shettyrishab35@gmail.com to point to the correct student ID
    const [updateResult] = await pool.execute(`
      UPDATE students 
      SET user_id = ? 
      WHERE user_id = ?
    `, [wrongStudentId, correctStudentId]);

    console.log(`✅ Updated student record: ${updateResult.affectedRows} rows affected`);

    // Update the user_roles table
    const [roleResult] = await pool.execute(`
      UPDATE user_roles 
      SET user_id = ? 
      WHERE user_id = ?
    `, [wrongStudentId, correctStudentId]);

    console.log(`✅ Updated user role: ${roleResult.affectedRows} rows affected`);

    // Update the profiles table
    const [profileResult] = await pool.execute(`
      UPDATE profiles 
      SET id = ? 
      WHERE id = ?
    `, [wrongStudentId, correctStudentId]);

    console.log(`✅ Updated profile: ${profileResult.affectedRows} rows affected`);

    // Delete the duplicate student record
    const [deleteResult] = await pool.execute(`
      DELETE FROM students WHERE id = ?
    `, [correctStudentId]);

    console.log(`✅ Deleted duplicate student record: ${deleteResult.affectedRows} rows affected`);

    console.log('\n🎉 SUCCESS! Student mapping has been fixed!');
    console.log('👤 Now shettyrishab35@gmail.com should see all marks and attendance data');

    await pool.end();
  } catch (error) {
    console.error('Fix student mapping error:', error);
  }
}

fixStudentMapping();

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

async function fixDuplicateStudent() {
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

    console.log('=== FIXING DUPLICATE STUDENT ===\n');

    // Profile ID for shettyrishab35@gmail.com
    const profileId = '55eaa670-993c-41c4-ac63-ef6b3e6b361c';
    // Student ID that has the marks
    const studentIdWithMarks = '15582e11-0786-49f5-a3ce-870f569270ab';
    // Student ID that's currently mapped to shettyrishab35@gmail.com (wrong one)
    const wrongStudentId = 'f395254f-6c98-4451-8ac0-42c4e10bb2dc';

    console.log('🔧 Fixing duplicate student mapping...');
    console.log(`  Profile ID: ${profileId}`);
    console.log(`  Student with marks: ${studentIdWithMarks}`);
    console.log(`  Wrong student ID: ${wrongStudentId}`);

    // Step 1: Delete the wrong student record
    const [deleteResult] = await pool.execute(`
      DELETE FROM students WHERE id = ?
    `, [wrongStudentId]);

    console.log(`✅ Deleted wrong student record: ${deleteResult.affectedRows} rows`);

    // Step 2: Update the correct student record to use the profile ID
    const [updateResult] = await pool.execute(`
      UPDATE students SET user_id = ? WHERE id = ?
    `, [profileId, studentIdWithMarks]);

    console.log(`✅ Updated correct student record: ${updateResult.affectedRows} rows affected`);

    // Step 3: Update user_roles table
    const [roleResult] = await pool.execute(`
      UPDATE user_roles SET user_id = ? WHERE user_id = ?
    `, [profileId, studentIdWithMarks]);

    console.log(`✅ Updated user role: ${roleResult.affectedRows} rows affected`);

    console.log('\n🎉 SUCCESS! Duplicate student mapping has been fixed!');
    console.log('👤 Now shettyrishab35@gmail.com should map to the correct student ID with marks');

    await pool.end();
  } catch (error) {
    console.error('Fix duplicate student error:', error);
  }
}

fixDuplicateStudent();

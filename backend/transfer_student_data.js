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

async function transferStudentData() {
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

    console.log('=== TRANSFERRING STUDENT DATA ===\n');

    // Student IDs
    const sourceStudentId = '98148061-85bb-406b-98d4-a0b87b3e1938'; // Has marks and belongs to shettyrishab035@gmail.com
    const targetStudentId = 'f395254f-6c98-4451-8ac0-42c4e10bb2dc'; // Correct mapping for shettyrishab35@gmail.com

    console.log('🔄 Transferring data...');
    console.log(`  From: ${sourceStudentId}`);
    console.log(`  To: ${targetStudentId}`);

    // Transfer marks
    const [marksResult] = await pool.execute(`
      UPDATE marks SET student_id = ? WHERE student_id = ?
    `, [targetStudentId, sourceStudentId]);

    console.log(`✅ Transferred marks: ${marksResult.affectedRows} records`);

    // Transfer enrollments
    const [enrollmentResult] = await pool.execute(`
      UPDATE enrollments SET student_id = ? WHERE student_id = ?
    `, [targetStudentId, sourceStudentId]);

    console.log(`✅ Transferred enrollments: ${enrollmentResult.affectedRows} records`);

    // Transfer attendance
    const [attendanceResult] = await pool.execute(`
      UPDATE attendance SET student_id = ? WHERE student_id = ?
    `, [targetStudentId, sourceStudentId]);

    console.log(`✅ Transferred attendance: ${attendanceResult.affectedRows} records`);

    console.log('\n🎉 SUCCESS! All student data has been transferred!');
    console.log('👤 Now shettyrishab35@gmail.com should see all marks, attendance, and enrollment data');

    await pool.end();
  } catch (error) {
    console.error('Transfer student data error:', error);
  }
}

transferStudentData();

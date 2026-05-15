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

async function transferToCorrectStudent() {
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

    console.log('=== TRANSFERRING DATA TO CORRECT STUDENT ===\n');

    // Transfer from shettyrishab035@gmail.com to shettyrishab35@gmail.com
    const sourceStudentId = '98148061-85bb-406b-98d4-a0b87b3e1938'; // shettyrishab035@gmail.com (has data)
    const targetStudentId = 'f395254f-6c98-4451-8ac0-42c4e10bb2dc'; // shettyrishab35@gmail.com (needs data)

    console.log('🔄 Transferring all data...');
    console.log(`  From: ${sourceStudentId} (shettyrishab035@gmail.com)`);
    console.log(`  To: ${targetStudentId} (shettyrishab35@gmail.com)`);

    // Check current data first
    const [marksCheck] = await pool.execute('SELECT COUNT(*) as count FROM marks WHERE student_id = ?', [sourceStudentId]);
    const [enrollmentsCheck] = await pool.execute('SELECT COUNT(*) as count FROM enrollments WHERE student_id = ?', [sourceStudentId]);
    const [attendanceCheck] = await pool.execute('SELECT COUNT(*) as count FROM attendance WHERE student_id = ?', [sourceStudentId]);

    console.log(`📊 Current data in source student:`);
    console.log(`  Marks: ${marksCheck[0].count}`);
    console.log(`  Enrollments: ${enrollmentsCheck[0].count}`);
    console.log(`  Attendance: ${attendanceCheck[0].count}`);

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

    // Verify transfer
    const [targetMarksCheck] = await pool.execute('SELECT COUNT(*) as count FROM marks WHERE student_id = ?', [targetStudentId]);
    const [targetEnrollmentsCheck] = await pool.execute('SELECT COUNT(*) as count FROM enrollments WHERE student_id = ?', [targetStudentId]);
    const [targetAttendanceCheck] = await pool.execute('SELECT COUNT(*) as count FROM attendance WHERE student_id = ?', [targetStudentId]);

    console.log(`\n📊 New data in target student:`);
    console.log(`  Marks: ${targetMarksCheck[0].count}`);
    console.log(`  Enrollments: ${targetEnrollmentsCheck[0].count}`);
    console.log(`  Attendance: ${targetAttendanceCheck[0].count}`);

    console.log('\n🎉 SUCCESS! All data has been transferred to shettyrishab35@gmail.com!');
    console.log('👤 Please login again to see all your marks, attendance, and enrollment data');

    await pool.end();
  } catch (error) {
    console.error('Transfer error:', error);
  }
}

transferToCorrectStudent();

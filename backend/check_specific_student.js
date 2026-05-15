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

async function checkSpecificStudent() {
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

    console.log('=== CHECKING SPECIFIC STUDENT ===\n');

    const email = 'shettyrishab035@gmail.com';
    console.log(`🔍 Checking student: ${email}`);

    // Get profile info
    const [profileInfo] = await pool.execute(`
      SELECT id, name, email FROM profiles WHERE email = ?
    `, [email]);

    if (profileInfo.length === 0) {
      console.log('❌ Profile not found');
      return;
    }

    const profile = profileInfo[0];
    console.log(`📧 Profile ID: ${profile.id}`);
    console.log(`👤 Name: ${profile.name}`);

    // Get student info
    const [studentInfo] = await pool.execute(`
      SELECT s.id, s.user_id, s.roll_number 
      FROM students s 
      WHERE s.user_id = ?
    `, [profile.id]);

    if (studentInfo.length === 0) {
      console.log('❌ Student record not found for this profile');
      return;
    }

    const student = studentInfo[0];
    console.log(`🆔 Student ID: ${student.id}`);
    console.log(`📋 Roll Number: ${student.roll_number}`);

    // Check marks
    const [marksInfo] = await pool.execute(`
      SELECT COUNT(*) as count, SUM(marks_obtained) as total_marks
      FROM marks WHERE student_id = ?
    `, [student.id]);

    console.log(`📊 Marks: ${marksInfo[0].count} records, Total: ${marksInfo[0].total_marks}`);

    // Check enrollments
    const [enrollmentInfo] = await pool.execute(`
      SELECT e.subject_id, s.name as subject_name, s.code as subject_code
      FROM enrollments e
      JOIN subjects s ON e.subject_id = s.id
      WHERE e.student_id = ?
    `, [student.id]);

    console.log(`📚 Enrollments: ${enrollmentInfo.length} subjects`);
    enrollmentInfo.forEach(enrollment => {
      console.log(`  - ${enrollment.subject_name} (${enrollment.subject_code})`);
    });

    // Check attendance
    const [attendanceInfo] = await pool.execute(`
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present
      FROM attendance WHERE student_id = ?
    `, [student.id]);

    const attendanceRate = attendanceInfo[0].total > 0 
      ? Math.round((attendanceInfo[0].present / attendanceInfo[0].total) * 100) 
      : 0;

    console.log(`📅 Attendance: ${attendanceInfo[0].present}/${attendanceInfo[0].total} (${attendanceRate}%)`);

    console.log('\n✅ Student data found! Should be visible in frontend.');

    await pool.end();
  } catch (error) {
    console.error('Check specific student error:', error);
  }
}

checkSpecificStudent();

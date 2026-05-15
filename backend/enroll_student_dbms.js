const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
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

async function enrollStudentInDBMS() {
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

    console.log('=== ENROLLING STUDENT IN DATABASE MANAGEMENT SYSTEM ===\n');

    // Get student and subject info
    const studentEmail = 'shettyrishab035@gmail.com';
    const [studentInfo] = await pool.execute(`
      SELECT s.id as student_id, p.name as student_name, p.email 
      FROM students s
      JOIN profiles p ON s.user_id = p.id
      WHERE p.email = ?
    `, [studentEmail]);

    if (studentInfo.length === 0) {
      console.log('❌ Student not found:', studentEmail);
      return;
    }

    const student = studentInfo[0];
    console.log(`👤 Student Found: ${student.student_name} (${student.email})`);
    console.log(`🆔 Student ID: ${student.student_id}`);

    // Get Database Management System subject
    const [subjectInfo] = await pool.execute(`
      SELECT id, name, code FROM subjects WHERE code = '20CS321'
    `);

    if (subjectInfo.length === 0) {
      console.log('❌ Database Management System subject not found');
      return;
    }

    const subject = subjectInfo[0];
    console.log(`📚 Subject: ${subject.name} (${subject.code})`);
    console.log(`🆔 Subject ID: ${subject.id}`);

    // Check if already enrolled
    const [existingEnrollment] = await pool.execute(`
      SELECT COUNT(*) as count FROM enrollments 
      WHERE student_id = ? AND subject_id = ?
    `, [student.student_id, subject.id]);

    if (existingEnrollment[0].count > 0) {
      console.log('ℹ️ Student already enrolled in this subject');
    } else {
      // Enroll in subject
      const enrollmentId = uuidv4();
      await pool.execute(`
        INSERT INTO enrollments (id, student_id, subject_id, status, enrollment_date) 
        VALUES (?, ?, ?, ?, NOW())
      `, [enrollmentId, student.student_id, subject.id, 'enrolled']);

      console.log(`✅ Enrolled successfully! Enrollment ID: ${enrollmentId}`);
    }

    // Add sample marks
    const marksData = [
      { type: 'assignment', name: 'Assignment 1', obtained: 22, total: 25 },
      { type: 'assignment', name: 'Assignment 2', obtained: 24, total: 30 },
      { type: 'final', name: 'Unit Test 1', obtained: 28, total: 30 },
      { type: 'final', name: 'Mid Term', obtained: 45, total: 50 },
      { type: 'final', name: 'Final Exam', obtained: 85, total: 100 }
    ];

    console.log('\n📊 Adding marks...');
    for (const mark of marksData) {
      const markId = uuidv4();
      await pool.execute(`
        INSERT INTO marks (id, student_id, subject_id, exam_type, assessment_type, assessment_name, marks_obtained, total_marks, exam_date) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `, [markId, student.student_id, subject.id, mark.type, mark.type, mark.name, mark.obtained, mark.total]);
      
      console.log(`  ✅ ${mark.name}: ${mark.obtained}/${mark.total}`);
    }

    // Add attendance records
    const attendanceDates = [
      '2026-03-01', '2026-03-08', '2026-03-15', '2026-03-22',
      '2026-03-29', '2026-04-05', '2026-04-12', '2026-04-19',
      '2026-04-26', '2026-05-03', '2026-05-10', '2026-05-17'
    ];

    console.log('\n📅 Adding attendance...');
    for (const date of attendanceDates) {
      const attendanceId = uuidv4();
      const status = Math.random() > 0.1 ? 'present' : 'absent'; // 90% attendance rate
      
      await pool.execute(`
        INSERT INTO attendance (id, student_id, subject_id, attendance_date, status) 
        VALUES (?, ?, ?, ?, ?)
      `, [attendanceId, student.student_id, subject.id, date, status]);
      
      console.log(`  ✅ ${date}: ${status}`);
    }

    // Verify data
    const [marksCount] = await pool.execute(`
      SELECT COUNT(*) as count, SUM(marks_obtained) as total 
      FROM marks WHERE student_id = ? AND subject_id = ?
    `, [student.student_id, subject.id]);

    const [attendanceCount] = await pool.execute(`
      SELECT COUNT(*) as total, SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present
      FROM attendance WHERE student_id = ? AND subject_id = ?
    `, [student.student_id, subject.id]);

    console.log('\n📈 Summary:');
    console.log(`  📊 Total Marks: ${marksCount[0].count} records`);
    console.log(`  💯 Total Obtained: ${marksCount[0].total}`);
    console.log(`  📅 Total Attendance: ${attendanceCount[0].present}/${attendanceCount[0].total}`);
    console.log(`  📊 Attendance Rate: ${Math.round((attendanceCount[0].present / attendanceCount[0].total) * 100)}%`);

    console.log('\n🎉 SUCCESS! Student has been enrolled in Database Management System!');
    console.log('👤 Student can now login and view all marks and attendance data');

    await pool.end();
  } catch (error) {
    console.error('Enrollment error:', error);
  }
}

enrollStudentInDBMS();

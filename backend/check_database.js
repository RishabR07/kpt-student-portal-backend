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

async function checkDatabase() {
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

    console.log('=== DATABASE CONTENTS ===\n');

    // Check students table
    console.log('📚 STUDENTS:');
    const [students] = await pool.execute('SELECT id, user_id, roll_number, semester FROM students');
    students.forEach(student => {
      console.log(`  ID: ${student.id}, User ID: ${student.user_id}, Roll: ${student.roll_number}, Semester: ${student.semester}`);
    });

    // Check subjects table
    console.log('\n📖 SUBJECTS:');
    const [subjects] = await pool.execute('SELECT id, code, name, credits FROM subjects');
    subjects.forEach(subject => {
      console.log(`  ID: ${subject.id}, Code: ${subject.code}, Name: ${subject.name}, Credits: ${subject.credits}`);
    });

    // Check marks table
    console.log('\n📊 MARKS:');
    const [marks] = await pool.execute(`
      SELECT m.id, m.marks_obtained, m.total_marks, m.student_id, m.subject_id, s.name as subject_name
      FROM marks m
      LEFT JOIN subjects s ON m.subject_id = s.id
    `);
    marks.forEach(mark => {
      const percentage = mark.total_marks > 0 ? Math.round((mark.marks_obtained / mark.total_marks) * 100) : 0;
      console.log(`  ID: ${mark.id}, Student ID: ${mark.student_id}, Subject: ${mark.subject_name}, Marks: ${mark.marks_obtained}/${mark.total_marks} (${percentage}%)`);
    });

    // Check attendance table
    console.log('\n📅 ATTENDANCE:');
    const [attendance] = await pool.execute(`
      SELECT a.id, a.student_id, a.subject_id, a.date, a.status, s.name as subject_name
      FROM attendance a
      LEFT JOIN subjects s ON a.subject_id = s.id
    `);
    attendance.forEach(record => {
      console.log(`  ID: ${record.id}, Student ID: ${record.student_id}, Subject: ${record.subject_name}, Date: ${record.date}, Status: ${record.status}`);
    });

    // Check announcements table
    console.log('\n📢 ANNOUNCEMENTS:');
    const [announcements] = await pool.execute('SELECT id, title, target_audience, published_at FROM announcements ORDER BY published_at DESC');
    announcements.forEach(announcement => {
      console.log(`  ID: ${announcement.id}, Title: ${announcement.title}, Target: ${announcement.target_audience}, Date: ${announcement.published_at}`);
    });

    // Check user_roles table
    console.log('\n👤 USER ROLES:');
    const [userRoles] = await pool.execute('SELECT user_id, role FROM user_roles');
    userRoles.forEach(role => {
      console.log(`  User ID: ${role.user_id}, Role: ${role.role}`);
    });

    console.log('\n=== END DATABASE CONTENTS ===');

    await pool.end();
  } catch (error) {
    console.error('Database check error:', error);
  }
}

checkDatabase();

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

async function fixMarksMapping() {
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

    console.log('Connected to database');

    // Your currently logged in user (from server logs)
    const currentUser = '2c9d65fb-5b93-4f7d-ab78-670a4261ecef';
    const currentStudentId = '15582e11-0786-49f5-a3ce-870f569270ab';

    // Student that has marks (shettyrishab35@gmail.com)
    const marksStudentId = 'f395254f-6c98-4451-8ac0-42c4e10bb2dc';

    console.log('🔍 Current User:', currentUser);
    console.log('🔍 Current Student ID:', currentStudentId);
    console.log('🔍 Student with Marks:', marksStudentId);

    // Transfer all marks to your current student account
    const [result] = await pool.execute(
      'UPDATE marks SET student_id = ? WHERE student_id = ?',
      [currentStudentId, marksStudentId]
    );

    console.log(`✅ Transferred ${result.affectedRows} marks records to your current student account`);

    // Transfer enrollments
    const [enrollmentResult] = await pool.execute(
      'UPDATE enrollments SET student_id = ? WHERE student_id = ?',
      [currentStudentId, marksStudentId]
    );

    console.log(`✅ Transferred ${enrollmentResult.affectedRows} enrollment records to your current student account`);

    // Transfer attendance
    const [attendanceResult] = await pool.execute(
      'UPDATE attendance SET student_id = ? WHERE student_id = ?',
      [currentStudentId, marksStudentId]
    );

    console.log(`✅ Transferred ${attendanceResult.affectedRows} attendance records to your current student account`);

    console.log('\n🎉 SUCCESS! All marks data is now available for your current login!');
    console.log('👤 Your User ID:', currentUser);
    console.log('🎓 Your Student ID:', currentStudentId);
    console.log('📚 Now refresh the marks page to see your data');

    await pool.end();
  } catch (error) {
    console.error('Error fixing marks mapping:', error);
  }
}

fixMarksMapping();

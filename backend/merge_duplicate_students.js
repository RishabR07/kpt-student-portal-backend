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

async function mergeDuplicateStudents() {
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

    console.log('=== MERGING DUPLICATE STUDENTS ===\n');

    // Target: Clerk-created student (where user logs in)
    const targetStudentId = '15582e11-0786-49f5-a3ce-870f569270ab';
    const targetUserId = '55eaa670-993c-41c4-ac63-ef6b3e6b361c';

    // Source: Frontend-created student (where marks are stored)
    const sourceStudentId = '00298307-5388-4c03-8670-75a2d3f1728c';
    const sourceUserId = '69217b2c-111e-4e9e-a72a-6e00126d7604';

    console.log('🔄 Merging data...');
    console.log(`  Target (Clerk login): ${targetStudentId} (${targetUserId})`);
    console.log(`  Source (Frontend): ${sourceStudentId} (${sourceUserId})`);

    // Check current data before merge
    const [sourceMarks] = await pool.execute(
      'SELECT COUNT(*) as count FROM marks WHERE student_id = ?',
      [sourceStudentId]
    );

    const [targetMarks] = await pool.execute(
      'SELECT COUNT(*) as count FROM marks WHERE student_id = ?',
      [targetStudentId]
    );

    console.log(`\n📊 Before merge:`);
    console.log(`  Source marks: ${sourceMarks[0].count}`);
    console.log(`  Target marks: ${targetMarks[0].count}`);

    // Transfer marks
    const [marksResult] = await pool.execute(
      'UPDATE marks SET student_id = ? WHERE student_id = ?',
      [targetStudentId, sourceStudentId]
    );

    console.log(`\n✅ Transferred marks: ${marksResult.affectedRows} records`);

    // Transfer enrollments
    const [enrollmentResult] = await pool.execute(
      'UPDATE enrollments SET student_id = ? WHERE student_id = ?',
      [targetStudentId, sourceStudentId]
    );

    console.log(`✅ Transferred enrollments: ${enrollmentResult.affectedRows} records`);

    // Transfer attendance
    const [attendanceResult] = await pool.execute(
      'UPDATE attendance SET student_id = ? WHERE student_id = ?',
      [targetStudentId, sourceStudentId]
    );

    console.log(`✅ Transferred attendance: ${attendanceResult.affectedRows} records`);

    // Delete the duplicate student record
    const [deleteResult] = await pool.execute(
      'DELETE FROM students WHERE id = ?',
      [sourceStudentId]
    );

    console.log(`✅ Deleted duplicate student: ${deleteResult.affectedRows} records`);

    // Update profile to use correct email
    const [profileResult] = await pool.execute(
      'UPDATE profiles SET email = ? WHERE id = ?',
      ['shettyrishab035@gmail.com', targetUserId]
    );

    console.log(`✅ Updated profile email: ${profileResult.affectedRows} records`);

    // Verify final state
    const [finalMarks] = await pool.execute(
      'SELECT COUNT(*) as count FROM marks WHERE student_id = ?',
      [targetStudentId]
    );

    console.log(`\n🎉 After merge:`);
    console.log(`  Total marks for shettyrishab035@gmail.com: ${finalMarks[0].count}`);
    console.log(`  Student ID: ${targetStudentId}`);
    console.log(`  Roll Number: STU3469`);

    console.log('\n✅ SUCCESS! All data has been merged!');
    console.log('👤 Now when you login as shettyrishab035@gmail.com via Clerk, you should see all marks!');

    await pool.end();
  } catch (error) {
    console.error('Merge duplicate students error:', error);
  }
}

mergeDuplicateStudents();

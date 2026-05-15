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

async function quickCheckMarks() {
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

    console.log('=== QUICK MARKS CHECK ===\n');

    // Check marks by student
    const [marksByStudent] = await pool.execute(`
      SELECT student_id, COUNT(*) as count, SUM(marks_obtained) as total
      FROM marks 
      GROUP BY student_id
    `);

    console.log('📊 MARKS BY STUDENT:');
    marksByStudent.forEach(row => {
      console.log(`  Student ID: ${row.student_id}`);
      console.log(`  Marks Count: ${row.count}`);
      console.log(`  Total Marks: ${row.total}`);
      console.log('  ---');
    });

    // Check enrollments by student
    const [enrollmentsByStudent] = await pool.execute(`
      SELECT student_id, COUNT(*) as count
      FROM enrollments 
      GROUP BY student_id
    `);

    console.log('\n📋 ENROLLMENTS BY STUDENT:');
    enrollmentsByStudent.forEach(row => {
      console.log(`  Student ID: ${row.student_id}`);
      console.log(`  Enrollment Count: ${row.count}`);
      console.log('  ---');
    });

    await pool.end();
  } catch (error) {
    console.error('Quick check error:', error);
  }
}

quickCheckMarks();

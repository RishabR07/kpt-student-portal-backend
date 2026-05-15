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

async function checkUserMapping() {
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

    console.log('=== USER MAPPING ANALYSIS ===\n');

    // Check profiles and their associated students
    const [profiles] = await pool.execute(`
      SELECT p.id, p.email, p.name, s.id as student_id, s.roll_number
      FROM profiles p
      LEFT JOIN students s ON p.id = s.user_id
      ORDER BY p.email
    `);

    console.log('👥 PROFILES & STUDENT MAPPING:');
    profiles.forEach(row => {
      console.log(`  Email: ${row.email}`);
      console.log(`  Profile ID: ${row.id}`);
      console.log(`  Student ID: ${row.student_id}`);
      console.log(`  Roll Number: ${row.roll_number}`);
      console.log('  ---');
    });

    // Check marks for each student
    const [marks] = await pool.execute(`
      SELECT s.roll_number, COUNT(m.id) as marks_count, SUM(m.marks_obtained) as total_marks
      FROM students s
      LEFT JOIN marks m ON s.id = m.student_id
      GROUP BY s.id, s.roll_number
      ORDER BY s.roll_number
    `);

    console.log('\n📊 MARKS BY STUDENT:');
    marks.forEach(row => {
      console.log(`  Roll: ${row.roll_number} - Marks: ${row.marks_count} - Total: ${row.total_marks}`);
    });

    console.log('\n=== END USER MAPPING ANALYSIS ===');

    await pool.end();
  } catch (error) {
    console.error('User mapping check error:', error);
  }
}

checkUserMapping();

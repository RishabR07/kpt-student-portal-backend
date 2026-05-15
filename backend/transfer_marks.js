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

async function transferMarks() {
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

    // Transfer marks from old student to your student
    const oldStudentId = 'cdf57f47-c39b-42e1-b473-dd67d560eb61';
    const yourStudentId = 'f395254f-6c98-4451-8ac0-42c4e10bb2dc';

    // Update existing marks to your student ID
    const [result] = await pool.execute(
      'UPDATE marks SET student_id = ? WHERE student_id = ?',
      [yourStudentId, oldStudentId]
    );

    console.log(`✅ Transferred ${result.affectedRows} marks records to your student account`);

    // Transfer enrollments as well
    const [enrollmentResult] = await pool.execute(
      'UPDATE enrollments SET student_id = ? WHERE student_id = ?',
      [yourStudentId, oldStudentId]
    );

    console.log(`✅ Transferred ${enrollmentResult.affectedRows} enrollment records to your student account`);

    // Delete the old student record (optional)
    await pool.execute('DELETE FROM students WHERE id = ?', [oldStudentId]);
    console.log('✅ Removed old student record');

    console.log('\n🎉 Successfully transferred all marks to your account!');
    console.log('👤 Your Student ID:', yourStudentId);
    console.log('📧 Your Email: shettyrishab35@gmail.com');
    console.log('📚 Now you should see marks for Data Base Management System');

    await pool.end();
  } catch (error) {
    console.error('Error transferring marks:', error);
  }
}

transferMarks();

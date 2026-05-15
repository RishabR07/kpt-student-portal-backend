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

async function listStudentAccounts() {
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

    console.log('=== STUDENT ACCOUNTS ===\n');

    // Get all student accounts
    const [studentRows] = await pool.execute(`
      SELECT 
        u.id as user_id,
        u.email,
        u.clerk_user_id,
        p.name,
        p.email as profile_email,
        s.id as student_id,
        s.roll_number,
        ur.role
      FROM users u
      JOIN profiles p ON u.id = p.id
      JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN students s ON u.id = s.user_id
      WHERE ur.role = 'student'
      ORDER BY p.name ASC
    `);

    console.log('👨‍🎓 Available Student Accounts:');
    console.log('─'.repeat(80));
    console.log('📧 Email'.padEnd(35) + '👤 Name'.padEnd(25) + '🆔 Roll Number'.padEnd(20) + '📊 Data');
    console.log('─'.repeat(80));

    // Check marks for each student
    for (const row of studentRows) {
      const [marksRows] = await pool.execute(
        'SELECT COUNT(*) as count FROM marks WHERE student_id = ?', 
        [row.student_id]
      );
      
      const hasMarks = marksRows[0].count > 0 ? '✅ Has Marks' : '❌ No Marks';
      const email = row.profile_email || row.email || 'N/A';
      const name = row.name || 'N/A';
      const rollNumber = row.roll_number || 'N/A';
      
      console.log(
        email.padEnd(35) + 
        name.padEnd(25) + 
        rollNumber.padEnd(20) + 
        hasMarks
      );
    }

    console.log('\n💡 To test student data:');
    console.log('1. Login with any of the above student email addresses');
    console.log('2. Check Student Dashboard, Marks, and Attendance pages');
    console.log('3. The system should show real data from MySQL database');

    await pool.end();
  } catch (error) {
    console.error('List student accounts error:', error);
  }
}

listStudentAccounts();

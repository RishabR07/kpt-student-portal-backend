const mysql = require('mysql2/promise');
const { loadEnvFile } = require('node:process');
const path = require('path');

// Load environment variables
loadEnvFile(path.join(__dirname, '.env'));

async function checkTables() {
  try {
    const pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'kpt_student_portal',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('Checking subjects table structure...');
    const [subjectColumns] = await pool.execute('DESCRIBE subjects');
    console.log('Subjects table columns:');
    subjectColumns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));

    console.log('\nChecking announcements table structure...');
    const [columns] = await pool.execute('DESCRIBE announcements');
    console.log('Announcements table columns:');
    columns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));

    console.log('\nChecking if there are any announcements...');
    const [rows] = await pool.execute('SELECT * FROM announcements LIMIT 5');
    console.log('Sample announcements:', rows);

    await pool.end();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTables();

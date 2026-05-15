const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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

async function checkAndFixTable() {
  try {
    const pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'kpt_student_portal',
      waitForConnections: true,
      connectionLimit: 10,
    });

    console.log('Connected to database');

    // Check current columns
    const [columns] = await pool.execute('DESCRIBE marks');
    console.log('Current marks table columns:');
    columns.forEach(col => console.log(`  - ${col.Field}: ${col.Type}`));

    // Check if exam_type exists
    const hasExamType = columns.some(col => col.Field === 'exam_type');
    
    if (!hasExamType) {
      console.log('\nAdding exam_type column...');
      await pool.execute('ALTER TABLE marks ADD COLUMN exam_type VARCHAR(30) NOT NULL DEFAULT "final" AFTER subject_id');
      console.log('Added exam_type column');
    } else {
      console.log('\nexam_type column already exists');
    }

    await pool.end();
    console.log('\nDone!');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAndFixTable();

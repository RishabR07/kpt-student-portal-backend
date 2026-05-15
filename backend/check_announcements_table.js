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

async function checkAnnouncementsTable() {
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

    console.log('=== ANNOUNCEMENTS TABLE ANALYSIS ===\n');

    // Check announcements table
    console.log('📢 ANNOUNCEMENTS:');
    const [announcements] = await pool.execute('SELECT * FROM announcements ORDER BY published_at DESC');
    announcements.forEach(announcement => {
      console.log(`  ID: ${announcement.id}`);
      console.log(`  Title: ${announcement.title}`);
      console.log(`  Content: ${announcement.content}`);
      console.log(`  Target Audience: ${announcement.target_audience}`);
      console.log(`  Published: ${announcement.published_at}`);
      console.log('  ---');
    });

    console.log('\n=== END ANNOUNCEMENTS ANALYSIS ===');

    await pool.end();
  } catch (error) {
    console.error('Announcements table check error:', error);
  }
}

checkAnnouncementsTable();

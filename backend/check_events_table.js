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

async function checkEventsTable() {
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

    console.log('=== EVENTS TABLE ANALYSIS ===\n');

    // Check events table structure
    console.log('📅 EVENTS:');
    const [events] = await pool.execute('SELECT * FROM events');
    events.forEach(event => {
      console.log(`  ID: ${event.id}`);
      console.log(`  Title: ${event.title}`);
      console.log(`  Date: ${event.event_date}`);
      console.log(`  Venue: ${event.venue}`);
      console.log(`  Target Audience: ${event.target_audience}`);
      console.log(`  Created: ${event.created_at}`);
      console.log('  ---');
    });

    // Check event_enrollments table
    console.log('\n📋 EVENT ENROLLMENTS:');
    const [enrollments] = await pool.execute('SELECT * FROM event_enrollments');
    enrollments.forEach(enrollment => {
      console.log(`  Event ID: ${enrollment.event_id}`);
      console.log(`  User ID: ${enrollment.user_id}`);
      console.log(`  Enrolled: ${enrollment.enrolled_at}`);
      console.log('  ---');
    });

    console.log('\n=== END EVENTS ANALYSIS ===');

    await pool.end();
  } catch (error) {
    console.error('Events table check error:', error);
  }
}

checkEventsTable();

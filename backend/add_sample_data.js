const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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

async function addSampleData() {
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

    // Get student ID
    const [students] = await pool.execute('SELECT id FROM students WHERE user_id = ? LIMIT 1', ['2c9d65fb-5b93-4f7d-ab78-670a4261ecef']);
    
    if (students.length === 0) {
      console.log('Student not found, creating student record...');
      const studentId = uuidv4();
      await pool.execute(
        'INSERT INTO students (id, user_id, roll_number, semester) VALUES (?, ?, ?, ?)',
        [studentId, '2c9d65fb-5b93-4f7d-ab78-670a4261ecef', 'STU1001', 1]
      );
      console.log('Student created with ID:', studentId);
    } else {
      console.log('Student found with ID:', students[0].id);
    }

    // Get or create subjects
    const subjectId1 = uuidv4();
    const subjectId2 = uuidv4();
    
    await pool.execute(`
      INSERT IGNORE INTO subjects (id, code, name, description, credits, semester, teacher_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [subjectId1, 'CS101', 'Computer Science Fundamentals', 'Basic computer science concepts', 3, 1, '3df08d42-09d7-4946-a0ca-9c874fd713f4']);
    
    await pool.execute(`
      INSERT IGNORE INTO subjects (id, code, name, description, credits, semester, teacher_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [subjectId2, 'MATH101', 'Mathematics I', 'Basic mathematics', 4, 1, '3df08d42-09d7-4946-a0ca-9c874fd713f4']);

    // Add sample marks
    const [studentRecord] = await pool.execute('SELECT id FROM students WHERE user_id = ? LIMIT 1', ['2c9d65fb-5b93-4f7d-ab78-670a4261ecef']);
    const studentId = studentRecord[0].id;

    const mark1 = uuidv4();
    const mark2 = uuidv4();
    
    await pool.execute(`
      INSERT IGNORE INTO marks (id, student_id, subject_id, exam_type, marks_obtained, total_marks) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [mark1, studentId, subjectId1, 'final', 85, 100]);

    await pool.execute(`
      INSERT IGNORE INTO marks (id, student_id, subject_id, exam_type, marks_obtained, total_marks) 
      VALUES (?, ?, ?, ?, ?, ?)
    `, [mark2, studentId, subjectId2, 'final', 78, 100]);

    // Add sample attendance
    const attendance1 = uuidv4();
    const attendance2 = uuidv4();
    
    await pool.execute(`
      INSERT IGNORE INTO attendance (id, student_id, subject_id, date, status) 
      VALUES (?, ?, ?, ?, ?)
    `, [attendance1, studentId, subjectId1, '2026-01-15', 'present']);

    await pool.execute(`
      INSERT IGNORE INTO attendance (id, student_id, subject_id, date, status) 
      VALUES (?, ?, ?, ?, ?)
    `, [attendance2, studentId, subjectId2, '2026-01-16', 'present']);

    // Add sample announcements
    const announcement1 = uuidv4();
    const announcement2 = uuidv4();
    
    await pool.execute(`
      INSERT IGNORE INTO announcements (id, title, content, target_audience, published_at) 
      VALUES (?, ?, ?, ?, ?)
    `, [announcement1, 'Welcome to Student Portal', 'Your student portal is now connected to the backend database!', 'students', '2026-01-01 10:00:00']);

    await pool.execute(`
      INSERT IGNORE INTO announcements (id, title, content, target_audience, published_at) 
      VALUES (?, ?, ?, ?, ?)
    `, [announcement2, 'Exam Schedule', 'Final exams will start next week. Please prepare accordingly.', 'all', '2026-01-15 09:00:00']);

    console.log('Sample data added successfully!');
    console.log('- Added subjects: CS101, MATH101');
    console.log('- Added marks for student');
    console.log('- Added attendance records');
    console.log('- Added announcements');

    await pool.end();
  } catch (error) {
    console.error('Error adding sample data:', error);
  }
}

addSampleData();

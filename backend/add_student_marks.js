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

async function addStudentMarks() {
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

    // Your student details
    const yourStudentId = '15582e11-0786-49f5-a3ce-870f569270ab';
    const yourUserId = '2c9d65fb-5b93-4f7d-ab78-670a4261ecef';

    // Add subjects if they don't exist
    const cs101Id = uuidv4();
    const math101Id = uuidv4();
    
    await pool.execute(`
      INSERT IGNORE INTO subjects (id, code, name, description, credits, semester, teacher_id, max_students) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [cs101Id, 'CS101', 'Computer Science Fundamentals', 'Basic computer science concepts', 3, 1, '3df08d42-09d7-4946-a0ca-9c874fd713f4', 60]);
    
    await pool.execute(`
      INSERT IGNORE INTO subjects (id, code, name, description, credits, semester, teacher_id, max_students) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [math101Id, 'MATH101', 'Mathematics I', 'Basic mathematics', 4, 1, '3df08d42-09d7-4946-a0ca-9c874fd713f4', 60]);

    // Add enrollments for your student
    await pool.execute(`
      INSERT IGNORE INTO enrollments (id, student_id, subject_id, status, enrollment_date) 
      VALUES (?, ?, ?, ?, ?)
    `, [uuidv4(), yourStudentId, cs101Id, 'enrolled', '2026-02-18']);

    await pool.execute(`
      INSERT IGNORE INTO enrollments (id, student_id, subject_id, status, enrollment_date) 
      VALUES (?, ?, ?, ?, ?)
    `, [uuidv4(), yourStudentId, math101Id, 'enrolled', '2026-02-18']);

    // Add marks for your student
    const mark1 = uuidv4();
    const mark2 = uuidv4();
    const mark3 = uuidv4();
    const mark4 = uuidv4();
    
    await pool.execute(`
      INSERT IGNORE INTO marks (id, student_id, subject_id, exam_type, assessment_type, assessment_name, marks_obtained, total_marks, exam_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [mark1, yourStudentId, cs101Id, 'final', 'internals', 'Unit Test 1', 22.00, 25.00, '2026-03-16']);

    await pool.execute(`
      INSERT IGNORE INTO marks (id, student_id, subject_id, exam_type, assessment_type, assessment_name, marks_obtained, total_marks, exam_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [mark2, yourStudentId, cs101Id, 'final', 'assignment', 'Assignment 1', 28.00, 30.00, '2026-03-17']);

    await pool.execute(`
      INSERT IGNORE INTO marks (id, student_id, subject_id, exam_type, assessment_type, assessment_name, marks_obtained, total_marks, exam_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [mark3, yourStudentId, cs101Id, 'final', 'assignment', 'Assignment 2', 24.00, 25.00, '2026-03-17']);

    await pool.execute(`
      INSERT IGNORE INTO marks (id, student_id, subject_id, exam_type, assessment_type, assessment_name, marks_obtained, total_marks, exam_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [mark4, yourStudentId, math101Id, 'final', 'internals', 'Unit Test 1', 78.00, 100.00, '2026-03-16']);

    console.log('✅ Successfully added marks for your student account!');
    console.log('📚 Computer Science Fundamentals: 22/25, 28/30, 24/25');
    console.log('🔢 Mathematics I: 78/100');
    console.log('👤 Student ID:', yourStudentId);
    console.log('🔑 User ID:', yourUserId);

    await pool.end();
  } catch (error) {
    console.error('Error adding student marks:', error);
  }
}

addStudentMarks();

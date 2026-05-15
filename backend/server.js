const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const {
  setupLoginEndpoint,
  setupChangePasswordEndpoint,
  setupCreateStudentEndpoint,
  verifyJWT
} = require('./auth-endpoints');

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

const app = express();
const PORT = process.env.PORT || 8081;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection pool (initialized in startServer)
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: process.env.MYSQL_PORT || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'kpt_student_portal',
  waitForConnections: true,
  connectionLimit: 10,
});

// ─── Auth routes (no JWT required) ───────────────────────────────────────────
setupLoginEndpoint(app, pool);
setupCreateStudentEndpoint(app, pool);

app.get('/api/auth/me', verifyJWT, async (req, res) => {
  try {
    const userId = req.user.userId;

    const [userRows] = await pool.execute(
      'SELECT id, email, must_change_password FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    if (userRows.length === 0) return res.status(404).json({ error: 'User not found' });

    const [roleRows] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? LIMIT 1',
      [userId]
    );

    const [profileRows] = await pool.execute(
      'SELECT name, department FROM profiles WHERE id = ? LIMIT 1',
      [userId]
    );

    const user = userRows[0];
    const role = roleRows.length > 0 ? roleRows[0].role : 'student';
    const profile = profileRows.length > 0 ? profileRows[0] : {};

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role,
        name: profile.name || null,
        department: profile.department || null,
        mustChangePassword: !!user.must_change_password
      }
    });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Change password endpoint (protected)
setupChangePasswordEndpoint(app, pool);

// ─── Protected routes (JWT required) ─────────────────────────────────────────
app.use('/api/', verifyJWT);

// ─── Admin dashboard ─────────────────────────────────────────────────────────
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    // Total students
    const [studentRows] = await pool.execute(
      "SELECT COUNT(*) as count FROM user_roles WHERE role = 'student'"
    );

    // Total teachers
    const [teacherRows] = await pool.execute(
      "SELECT COUNT(*) as count FROM user_roles WHERE role = 'teacher'"
    );

    // Total subjects
    const [subjectRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM subjects'
    );

    // Attendance rate
    const [attendanceRows] = await pool.execute(
      "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present FROM attendance"
    );
    const att = attendanceRows[0];
    const attendanceRate = att.total > 0
      ? Number(((att.present / att.total) * 100).toFixed(1))
      : 0;

    // Recent announcements
    const [announcementRows] = await pool.execute(
      'SELECT a.id, a.title, a.created_at, p.name as author_name FROM announcements a LEFT JOIN profiles p ON a.author_id = p.id ORDER BY a.created_at DESC LIMIT 3'
    );

    // Department stats (students per department)
    const [deptStudents] = await pool.execute(
      'SELECT department, COUNT(*) as studentCount FROM profiles WHERE department IS NOT NULL GROUP BY department'
    );

    res.json({
      data: {
        stats: {
          totalStudents: studentRows[0].count,
          totalTeachers: teacherRows[0].count,
          totalSubjects: subjectRows[0].count,
          attendanceRate
        },
        announcements: announcementRows || [],
        departments: deptStudents.map(row => ({
          department: row.department,
          studentCount: row.studentCount,
          subjectCount: 0 // Subjects don't have department info in current schema
        }))
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ─── Admin: user management ──────────────────────────────────────────────────
app.get('/api/admin/users', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const [rows] = await pool.execute(`
      SELECT u.id, u.email, u.created_at, ur.role, p.name, p.department
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN profiles p ON u.id = p.id
      ORDER BY u.created_at DESC
    `);

    res.json({ users: rows || [] });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/admin/users', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { name, email, password, role, department, employeeId } = req.body;
    
    // Generate temporary password for teachers if not provided
    let finalPassword = password;
    if (!password && role === 'teacher') {
      finalPassword = 'Temp@123'; // Default temporary password
    }
    if (!password && role === 'student') {
      finalPassword = 'Student@123'; // Default temporary password for students
    }
    
    if (!name || !email || !finalPassword || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    const bcrypt = require('bcrypt');
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1',
      [normalizedEmail]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(finalPassword, 10);

    // Create user
    await pool.execute(
      'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
      [userId, normalizedEmail, hashedPassword]
    );

    // Create profile
    await pool.execute(
      'INSERT INTO profiles (id, name, email, department, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [userId, name, normalizedEmail, department || 'General']
    );

    // Create role
    await pool.execute(
      'INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, NOW())',
      [uuidv4(), userId, role]
    );

    // If student, create student record
    if (role === 'student') {
      const rollNumber = req.body.rollNumber || `AUTO${Date.now().toString().slice(-6)}`;
      await pool.execute(
        'INSERT INTO students (id, user_id, roll_number, semester, created_at) VALUES (?, ?, ?, ?, NOW())',
        [uuidv4(), userId, rollNumber, req.body.semester || 1]
      );
      
      // Set must_change_password for students with temporary password
      if (!password) {
        await pool.execute(
          'UPDATE users SET must_change_password = 1 WHERE id = ?',
          [userId]
        );
      }
    }

    // If teacher, create teacher record
    if (role === 'teacher') {
      const finalEmployeeId = employeeId || `TCH${Date.now().toString().slice(-6)}`;
      await pool.execute(
        'INSERT INTO teachers (id, user_id, employee_id, created_at) VALUES (?, ?, ?, NOW())',
        [uuidv4(), userId, finalEmployeeId]
      );
      
      // Set must_change_password for teachers with temporary password
      if (!password) {
        await pool.execute(
          'UPDATE users SET must_change_password = 1 WHERE id = ?',
          [userId]
        );
      }
    }

    // Create response with temporary password if auto-generated
    const responseData = { success: true, user: { id: userId, name, email: normalizedEmail, role } };
    
    // Include temporary password in response if it was auto-generated
    if (!password && (role === 'teacher' || role === 'student')) {
      responseData.temporaryPassword = finalPassword;
      responseData.message = `${role === 'teacher' ? 'Teacher' : 'Student'} created successfully with temporary password.`;
    } else {
      responseData.message = 'User created successfully.';
    }
    
    res.json(responseData);
  } catch (error) {
    console.error('Admin create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Reset user password
app.post('/api/admin/users/:id/reset-password', verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { id } = req.params;
    const [roleRows] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? LIMIT 1',
      [id]
    );

    if (roleRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate random temporary password
    const tempPassword = Math.random().toString(36).slice(-8).toUpperCase();
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Update password in users table
    await pool.execute(
      'UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?',
      [hashedPassword, id]
    );

    res.json({ 
      success: true,
      message: 'Password reset successfully',
      tempPassword
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Update user
app.put('/api/admin/users/:id', verifyJWT, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { id } = req.params;
    const { name, email, department, role } = req.body;

    // Check if user exists
    const [userRows] = await pool.execute(
      'SELECT id FROM users WHERE id = ? LIMIT 1',
      [id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user basic info
    await pool.execute(
      'UPDATE users SET email = ?, updated_at = NOW() WHERE id = ?',
      [email?.toLowerCase().trim(), id]
    );

    // Update profile
    await pool.execute(
      'UPDATE profiles SET name = ?, department = ?, updated_at = NOW() WHERE id = ?',
      [name, department, id]
    );

    // Update role if provided
    if (role) {
      await pool.execute(
        'UPDATE user_roles SET role = ? WHERE user_id = ?',
        [role, id]
      );
    }

    res.json({ 
      success: true, 
      message: 'User updated successfully' 
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const userId = req.params.id;

    // Delete dependent records first
    await pool.execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM profiles WHERE id = ?', [userId]);
    await pool.execute('DELETE FROM students WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM teachers WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ─── Admin: subjects ─────────────────────────────────────────────────────────
app.get('/api/admin/subjects', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const [rows] = await pool.execute(`
      SELECT s.id, s.name, s.code, s.department, s.description, s.credits,
             p.name as teacherName, t.id as teacherId
      FROM subjects s
      LEFT JOIN teachers t ON s.teacher_id = t.id
      LEFT JOIN profiles p ON t.user_id = p.id
      ORDER BY s.name
    `);

    res.json({ subjects: rows || [] });
  } catch (error) {
    console.error('Admin subjects error:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

app.post('/api/admin/subjects', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { name, code, department, description, credits, teacherId } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Subject name and code are required' });
    }

    const subjectId = uuidv4();
    await pool.execute(
      'INSERT INTO subjects (id, name, code, department, description, credits, teacher_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())',
      [subjectId, name, code, department || null, description || null, credits || 3, teacherId || null]
    );

    res.json({ success: true, subject: { id: subjectId, name, code } });
  } catch (error) {
    console.error('Admin create subject error:', error);
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

app.delete('/api/admin/subjects/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    await pool.execute('DELETE FROM subjects WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete subject error:', error);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

// ─── Admin: announcements ────────────────────────────────────────────────────
app.get('/api/admin/announcements', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const [rows] = await pool.execute(
      'SELECT id, title, content, author_name, target_audience, created_at FROM announcements ORDER BY created_at DESC'
    );

    res.json({ announcements: rows || [] });
  } catch (error) {
    console.error('Admin announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

app.post('/api/admin/announcements', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { title, content, target_audience } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // Get author name from profile
    const [profileRows] = await pool.execute(
      'SELECT name FROM profiles WHERE id = ? LIMIT 1',
      [req.user.userId]
    );
    const authorName = profileRows.length > 0 ? profileRows[0].name : 'Admin';

    const id = uuidv4();
    await pool.execute(
      'INSERT INTO announcements (id, title, content, author_name, target_audience, published_at, created_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [id, title, content, authorName, target_audience || 'all']
    );

    res.json({ success: true, announcement: { id, title, content, author_name: authorName } });
  } catch (error) {
    console.error('Admin create announcement error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

app.delete('/api/admin/announcements/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    await pool.execute('DELETE FROM announcements WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin delete announcement error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// ─── Admin: attendance overview ──────────────────────────────────────────────
app.get('/api/admin/attendance', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const [rows] = await pool.execute(`
      SELECT a.id, a.attendance_date, a.status,
             p.name as studentName, s.code as subjectCode, s.name as subjectName
      FROM attendance a
      JOIN students st ON a.student_id = st.id
      JOIN profiles p ON st.user_id = p.id
      JOIN subjects s ON a.subject_id = s.id
      ORDER BY a.attendance_date DESC
      LIMIT 100
    `);

    res.json({ attendance: rows || [] });
  } catch (error) {
    console.error('Admin attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// ─── Admin: marks overview ───────────────────────────────────────────────────
app.get('/api/admin/marks', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const [rows] = await pool.execute(`
      SELECT m.id, m.assessment_name, m.exam_type, m.marks_obtained, m.total_marks, m.exam_date,
             p.name as studentName, s.code as subjectCode, s.name as subjectName
      FROM marks m
      JOIN students st ON m.student_id = st.id
      JOIN profiles p ON st.user_id = p.id
      JOIN subjects s ON m.subject_id = s.id
      ORDER BY m.exam_date DESC
      LIMIT 100
    `);

    res.json({ marks: rows || [] });
  } catch (error) {
    console.error('Admin marks error:', error);
    res.status(500).json({ error: 'Failed to fetch marks' });
  }
});

// ─── Admin: enrollments ──────────────────────────────────────────────────────
app.get('/api/admin/enrollments', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const [rows] = await pool.execute(`
      SELECT e.id, e.enrollment_date, e.status,
             p.name as studentName, s.code as subjectCode, s.name as subjectName
      FROM enrollments e
      JOIN students st ON e.student_id = st.id
      JOIN profiles p ON st.user_id = p.id
      JOIN subjects s ON e.subject_id = s.id
      ORDER BY e.enrollment_date DESC
      LIMIT 100
    `);

    res.json({ enrollments: rows || [] });
  } catch (error) {
    console.error('Admin enrollments error:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

// ─── Admin: teachers list (for subject assignment) ───────────────────────────
app.get('/api/admin/teachers', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const [rows] = await pool.execute(`
      SELECT t.id, t.employee_id, p.name, p.email
      FROM teachers t
      JOIN profiles p ON t.user_id = p.id
      ORDER BY p.name
    `);

    res.json({ teachers: rows || [] });
  } catch (error) {
    console.error('Admin teachers error:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// ─── Student endpoints ───────────────────────────────────────────────────────
app.get('/api/student/dashboard', async (req, res) => {
  try {
    const userId = req.user.userId;
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Access denied. Student role required.' });
    }

    const [studentRows] = await pool.execute('SELECT id FROM students WHERE user_id = ?', [userId]);
    if (studentRows.length === 0) return res.status(404).json({ error: 'Student record not found' });

    const studentId = studentRows[0].id;

    const [attendanceRows] = await pool.execute(
      "SELECT COUNT(*) as total, SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present FROM attendance WHERE student_id = ?",
      [studentId]
    );

    const [marksRows] = await pool.execute(
      'SELECT COUNT(*) as total_assessments, SUM(marks_obtained) as total_obtained, SUM(total_marks) as total_possible FROM marks WHERE student_id = ?',
      [studentId]
    );

    const [enrollmentRows] = await pool.execute(
      "SELECT COUNT(*) as enrolled_subjects FROM enrollments WHERE student_id = ? AND status = 'enrolled'",
      [studentId]
    );

    // Get recent marks with subject details
    const [recentMarksRows] = await pool.execute(
      `SELECT m.id, m.marks_obtained, m.total_marks, m.assessment_type, s.name as subject_name 
       FROM marks m 
       JOIN subjects s ON m.subject_id = s.id 
       WHERE m.student_id = ? 
       ORDER BY m.created_at DESC 
       LIMIT 5`,
      [studentId]
    );

    // Get latest announcements
    const [announcementRows] = await pool.execute(
      `SELECT a.id, a.title, a.content, a.created_at 
       FROM announcements a 
       WHERE a.target_audience IN ('all', 'students') 
       ORDER BY a.created_at DESC 
       LIMIT 3`
    );

    const attendance = attendanceRows[0];
    const marks = marksRows[0];
    const enrollments = enrollmentRows[0];

    // Format recent marks
    const recentMarks = recentMarksRows.map(m => ({
      id: m.id,
      subjectName: m.subject_name,
      assessmentType: m.assessment_type,
      maxMarks: m.total_marks,
      obtainedMarks: m.marks_obtained,
      percentage: m.total_marks > 0 ? Math.round((m.marks_obtained / m.total_marks) * 100) : 0
    }));

    // Format announcements
    const latestAnnouncements = announcementRows.map(a => ({
      id: a.id,
      title: a.title,
      content: a.content,
      createdAt: a.created_at
    }));

    res.json({
      attendanceRate: attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0,
      averageMarks: marks.total_possible > 0 ? Math.round((marks.total_obtained / marks.total_possible) * 100) : 0,
      subjectsCount: enrollments.enrolled_subjects,
      announcementsCount: announcementRows.length,
      recentMarks: recentMarks || [],
      latestAnnouncements: latestAnnouncements || []
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

app.get('/api/student/marks', async (req, res) => {
  try {
    const userId = req.user.userId;
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Access denied' });

    const [studentRows] = await pool.execute('SELECT id FROM students WHERE user_id = ?', [userId]);
    if (studentRows.length === 0) return res.status(404).json({ error: 'Student record not found' });

    const [marksRows] = await pool.execute(`
      SELECT m.marks_obtained as obtainedMarks, m.total_marks as maxMarks,
             m.assessment_name as assessmentName, m.exam_type as examType,
             s.name as subjectName, s.code as subjectCode
      FROM marks m JOIN subjects s ON m.subject_id = s.id
      WHERE m.student_id = ? ORDER BY m.exam_date DESC
    `, [studentRows[0].id]);

    res.json({ marks: marksRows || [] });
  } catch (error) {
    console.error('Student marks error:', error);
    res.status(500).json({ error: 'Failed to fetch marks data' });
  }
});

app.get('/api/student/attendance', async (req, res) => {
  try {
    const userId = req.user.userId;
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Access denied' });

    const [studentRows] = await pool.execute('SELECT id FROM students WHERE user_id = ?', [userId]);
    if (studentRows.length === 0) return res.status(404).json({ error: 'Student record not found' });

    const [rows] = await pool.execute(`
      SELECT a.attendance_date as date, a.status, s.name as subjectName, s.code as subjectCode
      FROM attendance a JOIN subjects s ON a.subject_id = s.id
      WHERE a.student_id = ? ORDER BY a.attendance_date DESC
    `, [studentRows[0].id]);

    res.json({ attendanceHistory: rows || [] });
  } catch (error) {
    console.error('Student attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance data' });
  }
});

app.get('/api/student/announcements', async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Access denied' });

    const [rows] = await pool.execute(
      "SELECT id, title, content, published_at FROM announcements WHERE target_audience IN ('students', 'all') ORDER BY published_at DESC LIMIT 10"
    );

    res.json({ announcements: (rows || []).map(a => ({ id: a.id, title: a.title, content: a.content, createdAt: a.published_at })) });
  } catch (error) {
    console.error('Student announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// ─── Teacher endpoints ───────────────────────────────────────────────────────
app.get('/api/teacher/me', async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Access denied' });

    const [teacherRows] = await pool.execute('SELECT id, employee_id FROM teachers WHERE user_id = ?', [req.user.userId]);
    if (teacherRows.length === 0) return res.status(404).json({ error: 'Teacher record not found' });

    const [profileRows] = await pool.execute('SELECT name, email, department FROM profiles WHERE id = ?', [req.user.userId]);

    res.json({
      profile: {
        name: profileRows[0]?.name || null,
        email: profileRows[0]?.email || null,
        department: profileRows[0]?.department || null,
      },
      teacher: {
        id: teacherRows[0].id,
        employeeId: teacherRows[0].employee_id,
      }
    });
  } catch (error) {
    console.error('Teacher me error:', error);
    res.status(500).json({ error: 'Failed to fetch teacher info' });
  }
});

app.get('/api/teacher/dashboard', async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Access denied' });

    const [teacherRows] = await pool.execute('SELECT id FROM teachers WHERE user_id = ?', [req.user.userId]);
    if (teacherRows.length === 0) return res.status(404).json({ error: 'Teacher record not found' });

    const teacherId = teacherRows[0].id;

    // Fetch subjects with enrolled student counts
    const [subjects] = await pool.execute(`
      SELECT s.id, s.code, s.name, s.semester, s.credits,
        (SELECT COUNT(*) FROM enrollments e WHERE e.subject_id = s.id) as enrolledStudents
      FROM subjects s WHERE s.teacher_id = ? ORDER BY s.name
    `, [teacherId]);

    // Calculate totals from subjects
    const totalSubjects = subjects.length;
    const totalStudents = subjects.reduce((sum, s) => sum + Number(s.enrolledStudents || 0), 0);

    // Fetch recent announcements for teachers
    const [announcements] = await pool.execute(`
      SELECT id, title, content, created_at
      FROM announcements
      WHERE target_audience IN ('all', 'teachers')
      ORDER BY created_at DESC LIMIT 5
    `);

    res.json({
      data: {
        subjects: (subjects || []).map(s => ({
          id: s.id,
          code: s.code,
          name: s.name,
          semester: s.semester,
          credits: s.credits,
          enrolledStudents: Number(s.enrolledStudents || 0),
        })),
        totalStudents,
        totalSubjects,
        announcements: (announcements || []).map(a => ({
          id: a.id,
          title: a.title,
          content: a.content,
          created_at: a.created_at,
        })),
      }
    });
  } catch (error) {
    console.error('Teacher dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

app.get('/api/teacher/subjects', async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Access denied' });

    const [teacherRows] = await pool.execute('SELECT id FROM teachers WHERE user_id = ?', [req.user.userId]);
    if (teacherRows.length === 0) return res.status(404).json({ error: 'Teacher record not found' });

    const [rows] = await pool.execute('SELECT id, name, code, description FROM subjects WHERE teacher_id = ? ORDER BY name', [teacherRows[0].id]);

    res.json({ subjects: rows || [] });
  } catch (error) {
    console.error('Teacher subjects error:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Create new subject endpoint
app.post('/api/teacher/subjects', async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Access denied' });

    const { code, name, description, credits = 3, semester = 1, max_students = 60 } = req.body;
    
    if (!code || !name) {
      return res.status(400).json({ error: 'Subject code and name are required' });
    }

    // Get teacher record
    const [teacherRows] = await pool.execute('SELECT id FROM teachers WHERE user_id = ?', [req.user.userId]);
    if (teacherRows.length === 0) return res.status(404).json({ error: 'Teacher record not found' });

    const teacherId = teacherRows[0].id;

    // Check if subject code already exists
    const [existingRows] = await pool.execute('SELECT id FROM subjects WHERE code = ? LIMIT 1', [code]);
    if (existingRows.length > 0) {
      return res.status(400).json({ error: 'Subject code already exists' });
    }

    // Generate UUID for subject
    const { v4: uuidv4 } = require('uuid');
    const subjectId = uuidv4();

    // Create subject
    await pool.execute(
      'INSERT INTO subjects (id, code, name, description, credits, semester, teacher_id, max_students, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [subjectId, code, name, description || null, credits, semester, teacherId, max_students]
    );

    res.json({ 
      success: true, 
      message: 'Subject created successfully',
      subject: {
        id: subjectId,
        code,
        name,
        description,
        credits,
        semester,
        max_students
      }
    });
  } catch (error) {
    console.error('Create subject error:', error);
    res.status(500).json({ error: 'Failed to create subject' });
  }
});

// ─── Start server ────────────────────────────────────────────────────────────
async function startServer() {
  try {
    const [test] = await pool.execute('SELECT 1 as test');
    console.log('✅ Connected to MySQL database:', test[0]);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }

  // Debug endpoint to check server connectivity
  app.get('/debug/connectivity', (req, res) => {
    res.json({ 
      message: 'Debug endpoint working',
      timestamp: new Date().toISOString()
    });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Node.js API server running on http://localhost:${PORT}`);
    console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
    console.log('🔐 Authentication: Email/Password (no Clerk)');
  });
}

startServer().catch(console.error);

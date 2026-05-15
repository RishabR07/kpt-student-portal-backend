const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
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
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // ignore env file errors
  }
}

// Allow configuring DB/API locally without extra dependencies (reads backend/.env if present).
loadEnvFile(path.join(__dirname, '.env'));

const app = express();
const PORT = Number(process.env.API_PORT || process.env.PORT || 8081);

// Middleware
app.use(cors({
  origin: process.env.API_CORS_ORIGIN || true,
  credentials: true,
}));
app.use(express.json());

// MySQL Connection
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'kpt_student_portal',
  port: Number(process.env.MYSQL_PORT || 3306),
};

let pool;

async function initDB() {
  try {
    pool = mysql.createPool(dbConfig);
    console.log('✅ Connected to MySQL database');
    
    // Test connection
    const [rows] = await pool.execute('SELECT 1 as test');
    console.log('✅ Database test passed:', rows[0]);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || '';

// Helper functions
function generateJWT(userId, role) {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '24h' });
}

function mapAssessmentToExamType(assessment) {
  const value = String(assessment || '').toLowerCase();
  if (value.includes('assignment')) return 'assignment';
  if (value.includes('mid')) return 'midterm';
  if (value.includes('end') || value.includes('final')) return 'final';
  return 'internals';
}

function decodeJwtPayloadUnsafe(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function verifyClerkToken(token) {
  if (!token) return null;

  if (CLERK_SECRET_KEY) {
    const res = await fetch('https://api.clerk.com/v1/tokens/verify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.sub || null;
  }

  // DEV fallback only: decode without signature verification.
  const payload = decodeJwtPayloadUnsafe(token);
  if (!payload) return null;
  if (payload.exp && typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload.sub || null;
}

function normalizeEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  return value || null;
}

function getClerkTokenClaims(token) {
  const payload = decodeJwtPayloadUnsafe(token);
  if (!payload) return {};

  const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
  const publicMetadata = payload.public_metadata && typeof payload.public_metadata === 'object' ? payload.public_metadata : {};
  const unsafeMetadata = payload.unsafe_metadata && typeof payload.unsafe_metadata === 'object' ? payload.unsafe_metadata : {};

  const fullName =
    typeof payload.name === 'string' && payload.name.trim()
      ? payload.name.trim()
      : [payload.given_name, payload.family_name].filter(Boolean).join(' ').trim();

  const email = normalizeEmail(
    payload.email ||
      payload.email_address ||
      payload.primary_email_address ||
      publicMetadata.email ||
      unsafeMetadata.email ||
      (Array.isArray(payload.email_addresses) ? payload.email_addresses[0]?.email_address : null)
  );

  return {
    email,
    name: fullName || null,
    role: metadata.role || publicMetadata.role || null,
  };
}

async function fetchClerkUserMetadata(clerkUserId) {
  if (!CLERK_SECRET_KEY) return {};
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
      headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
    });
    if (!res.ok) return {};
    const data = await res.json();
    return {
      role: data.public_metadata?.role || null,
      name: [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || null,
      email: normalizeEmail(data.email_addresses?.[0]?.email_address),
    };
  } catch {
    return {};
  }
}

async function resolveClerkIdentity(clerkUserId, token) {
  const tokenClaims = getClerkTokenClaims(token);
  const clerkMeta = await fetchClerkUserMetadata(clerkUserId);
  const email = normalizeEmail(clerkMeta.email || tokenClaims.email);
  const name = clerkMeta.name || tokenClaims.name || (email ? email.split('@')[0] : 'User');
  const role = clerkMeta.role || tokenClaims.role || 'student';

  return { email, name, role };
}

async function ensureUserFromClerk(clerkUserId, clerkIdentity) {
  try {
    const [rows] = await pool.execute('SELECT id FROM users WHERE clerk_user_id = ? LIMIT 1', [clerkUserId]);
    if (rows.length > 0) return rows[0].id;

    const { email, name, role } = clerkIdentity;

    if (email) {
      const [emailRows] = await pool.execute(
        'SELECT id, clerk_user_id FROM users WHERE LOWER(email) = ? LIMIT 1',
        [email]
      );

      if (emailRows.length > 0) {
        const existingUser = emailRows[0];

        if (!existingUser.clerk_user_id || existingUser.clerk_user_id === clerkUserId) {
          if (!existingUser.clerk_user_id) {
            await pool.execute('UPDATE users SET clerk_user_id = ? WHERE id = ?', [clerkUserId, existingUser.id]);
            console.log(`[Auth] Linked Clerk user ${clerkUserId} to existing local user ${existingUser.id} via email ${email}`);
          }

          const [profileRows] = await pool.execute('SELECT id FROM profiles WHERE id = ? LIMIT 1', [existingUser.id]);
          if (profileRows.length === 0) {
            await pool.execute('INSERT INTO profiles (id, name, email) VALUES (?, ?, ?)', [existingUser.id, name, email]);
          } else {
            await pool.execute('UPDATE profiles SET name = ?, email = ? WHERE id = ?', [name, email, existingUser.id]);
          }

          return existingUser.id;
        }

        console.warn(`[Auth] Email ${email} is already linked to a different Clerk user (${existingUser.clerk_user_id}); creating a separate local user for ${clerkUserId}.`);
      }
    }

    const internalId = uuidv4();
    const finalEmail = email || `${clerkUserId}@clerk.local`;

    await pool.execute(
      'INSERT INTO users (id, email, password_hash, clerk_user_id) VALUES (?, ?, ?, ?)',
      [internalId, finalEmail, 'clerk', clerkUserId]
    );

    await pool.execute(
      'INSERT INTO profiles (id, name, email) VALUES (?, ?, ?)',
      [internalId, name, finalEmail]
    );

    await pool.execute(
      'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)',
      [uuidv4(), internalId, role]
    );

    if (role === 'teacher') {
      await pool.execute(
        'INSERT INTO teachers (id, user_id, employee_id) VALUES (?, ?, ?)',
        [uuidv4(), internalId, 'EMP' + Math.floor(Math.random() * 10000)]
      );
    } else if (role === 'student') {
      await pool.execute(
        'INSERT INTO students (id, user_id, roll_number) VALUES (?, ?, ?)',
        [uuidv4(), internalId, 'STU' + Math.floor(Math.random() * 10000)]
      );
    }

    return internalId;
  } catch (error) {
    if (error && error.code === 'ER_BAD_FIELD_ERROR') {
      throw new Error('Database missing users.clerk_user_id. Run: ALTER TABLE users ADD COLUMN clerk_user_id VARCHAR(191) NULL UNIQUE;');
    }
    throw error;
  }
}

async function verifyJWT(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch {
    // fall through to Clerk
  }

  try {
    const clerkSub = await verifyClerkToken(token);
    if (!clerkSub) return res.status(401).json({ error: 'Invalid token' });

    const clerkIdentity = await resolveClerkIdentity(clerkSub, token);
    const internalId = await ensureUserFromClerk(clerkSub, clerkIdentity);
    const user = await getUserById(internalId);
    const currentRole = clerkIdentity.role || user?.role || 'student';

    console.log(`[Auth] Clerk user ${clerkSub} → internal ${internalId}, role: ${currentRole} (email: ${clerkIdentity.email || 'n/a'}, db: ${user?.role || 'n/a'})`);

    req.user = {
      userId: internalId,
      role: currentRole,
      clerkSub,
      email: clerkIdentity.email || user?.email || null,
      name: clerkIdentity.name || null,
    };
    return next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: error?.message || 'Invalid token' });
  }
}

// Helper to get user from database
async function getUserById(userId) {
  const [userRows] = await pool.execute(
    'SELECT u.id, u.email, ur.role FROM users u JOIN user_roles ur ON u.id = ur.user_id WHERE u.id = ?',
    [userId]
  );
  return userRows[0];
}

// Routes
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    // For testing with the subject owner
    if (email === 'test@teacher.com') {
      const userId = '8e66d351-fba0-4b75-8b18-d46be50bcdac'; // User ID that owns the subject
      
      // Check if user exists
      const [userRows] = await pool.execute(
        'SELECT id FROM users WHERE id = ?',
        [userId]
      );
      
      if (userRows.length === 0) {
        // Create user with specific ID
        await pool.execute(
          'INSERT INTO users (id, email, password_hash, clerk_user_id) VALUES (?, ?, ?, ?)',
          [userId, email, 'mock-password-hash', 'user_3AsY276SCfWZjXTHIz5iwydj94E']
        );
        
        // Create user role
        await pool.execute(
          'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)',
          [uuidv4(), userId, 'teacher']
        );
      }
      
      // Create teacher record if not exists
      const [teacherRows] = await pool.execute(
        'SELECT id FROM teachers WHERE user_id = ?',
        [userId]
      );
      
      if (teacherRows.length === 0) {
        const teacherId = '3df08d42-09d7-4946-a0ca-9c874fd713f4'; // Teacher ID that owns the subject
        await pool.execute(
          'INSERT INTO teachers (id, user_id, department) VALUES (?, ?, ?)',
          [teacherId, userId, 'Computer Science']
        );
      }
      
      const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, userId });
    }
    
    // For other emails, create new user
    const userId = uuidv4();
    
    // Check if user exists, if not create
    const [userRows] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    
    let user;
    if (userRows.length === 0) {
      // Create user
      await pool.execute(
        'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
        [userId, email, 'mock-password-hash']
      );
      
      // Determine role based on email
      let userRole = 'student'; // default to student
      if (email === 'shettyrishab10@gmail.com') {
        userRole = 'admin';
      }
      
      // Create user role
      await pool.execute(
        'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)',
        [uuidv4(), userId, userRole]
      );
      
      // Create corresponding record based on role
      if (userRole === 'admin') {
        // Admin users don't need teacher records
        user = { id: userId, role: 'admin' };
      } else if (userRole === 'teacher') {
        // Create teacher
        await pool.execute(
          'INSERT INTO teachers (id, user_id, employee_id) VALUES (?, ?, ?)',
          [uuidv4(), userId, 'EMP' + Math.floor(Math.random() * 10000)]
        );
        
        user = { id: userId, role: 'teacher' };
      } else {
        // Create student
        await pool.execute(
          'INSERT INTO students (id, user_id, roll_number, semester) VALUES (?, ?, ?, ?)',
          [uuidv4(), userId, 'ROLL' + Math.floor(Math.random() * 10000), 1]
        );
        
        user = { id: userId, role: 'student' };
      }
    } else {
      user = await getUserById(userRows[0].id);
      
      // Prioritize Clerk metadata role over database role
      if (req.body.clerkMetadata && req.body.clerkMetadata.role) {
        user.role = req.body.clerkMetadata.role;
      }
    }
    
    const token = generateJWT(user.id, user.role);
    res.json({ success: true, token, user });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', verifyJWT, async (req, res) => {
  try {
    let user = await getUserById(req.user.userId);
    if (!user) {
      // User not found in MySQL, create basic record from JWT payload
      const email = req.user.email || 'unknown@example.com';
      const name = req.user.name || email.split('@')[0];
      
      // Create user record
      await pool.execute(
        'INSERT INTO users (id, email) VALUES (?, ?)',
        [req.user.userId, email]
      );
      
      // Create role record based on JWT payload or default to student
      const role = req.user.role || 'student';
      await pool.execute(
        'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)',
        [uuidv4(), req.user.userId, role]
      );
      
      // Create corresponding record based on role
      if (role === 'student') {
        await pool.execute(
          'INSERT INTO students (id, user_id, roll_number, semester) VALUES (?, ?, ?, ?)',
          [uuidv4(), req.user.userId, 'STU' + Math.floor(Math.random() * 10000), 1]
        );
      } else if (role === 'teacher') {
        await pool.execute(
          'INSERT INTO teachers (id, user_id, employee_id) VALUES (?, ?, ?)',
          [uuidv4(), req.user.userId, 'EMP' + Math.floor(Math.random() * 10000)]
        );
      }
      
      user = { id: req.user.userId, email, name, role };
    }
    res.json({ user });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// Teacher Subjects Routes (with authentication)
app.get('/api/teacher/subjects', verifyJWT, async (req, res) => {
  try {
    // Get teacher record from user_id
    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ?',
      [req.user.userId]
    );
    
    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    const teacherId = teacherRows[0].id;
    
    // Get subjects for this teacher
    const [subjects] = await pool.execute(`
      SELECT s.*, 
             (SELECT COUNT(*) FROM enrollments e WHERE e.subject_id = s.id AND e.status = 'enrolled') as enrolledStudents
      FROM subjects s 
      WHERE s.teacher_id = ?
      ORDER BY s.created_at DESC
    `, [teacherId]);
    
    res.json({ subjects });
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

app.post('/api/teacher/subjects', verifyJWT, async (req, res) => {
  try {
    const { code, name, description, credits = 3, semester = 1, max_students = 60 } = req.body;
    
    if (!code || !name) {
      return res.status(400).json({ error: 'Subject code and name are required' });
    }
    
    // Get teacher record
    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ?',
      [req.user.userId]
    );
    
    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    const teacherId = teacherRows[0].id;
    const subjectId = uuidv4();
    
    await pool.execute(`
      INSERT INTO subjects (id, code, name, description, credits, semester, teacher_id, max_students)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [subjectId, code, name, description || null, credits, semester, teacherId, max_students]);
    
    res.status(201).json({
      message: 'Subject created successfully',
      data: { id: subjectId, code, name, description, credits, semester, max_students }
    });
  } catch (error) {
    console.error('Error creating subject:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Subject code already exists' });
    } else {
      res.status(500).json({ error: 'Failed to create subject' });
    }
  }
});

app.delete('/api/teacher/subjects/:id', verifyJWT, async (req, res) => {
  try {
    const subjectId = req.params.id;
    
    // Verify subject belongs to this teacher
    const [subjectRows] = await pool.execute(`
      SELECT s.id FROM subjects s
      JOIN teachers t ON s.teacher_id = t.id
      WHERE s.id = ? AND t.user_id = ?
    `, [subjectId, req.user.userId]);
    
    if (subjectRows.length === 0) {
      return res.status(404).json({ error: 'Subject not found or access denied' });
    }
    
    await pool.execute('DELETE FROM subjects WHERE id = ?', [subjectId]);
    
    res.json({ message: 'Subject deleted successfully' });
  } catch (error) {
    console.error('Error deleting subject:', error);
    res.status(500).json({ error: 'Failed to delete subject' });
  }
});

app.get('/api/teacher/subjects/:id/students', verifyJWT, async (req, res) => {
  try {
    const subjectId = req.params.id;

    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherRows[0].id;

    const [subjectRows] = await pool.execute(
      'SELECT id FROM subjects WHERE id = ? AND teacher_id = ? LIMIT 1',
      [subjectId, teacherId]
    );

    if (subjectRows.length === 0) {
      return res.status(404).json({ error: 'Subject not found or access denied' });
    }

    const [rows] = await pool.execute(
      `
      SELECT
        st.id AS studentId,
        st.user_id AS userId,
        st.roll_number AS rollNumber,
        p.name AS name,
        p.email AS email
      FROM enrollments e
      JOIN students st ON st.id = e.student_id
      JOIN profiles p ON p.id = st.user_id
      WHERE e.subject_id = ? AND e.status = 'enrolled'
      ORDER BY st.roll_number ASC, p.name ASC
      `,
      [subjectId]
    );

    res.json({ students: rows || [] });
  } catch (error) {
    console.error('Error fetching enrolled students:', error);
    res.status(500).json({ error: 'Failed to fetch enrolled students' });
  }
});

// Get available students for enrollment (not already enrolled in this subject)
app.get('/api/teacher/subjects/:id/available-students', verifyJWT, async (req, res) => {
  try {
    const subjectId = req.params.id;

    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherRows[0].id;

    const [subjectRows] = await pool.execute(
      'SELECT id FROM subjects WHERE id = ? AND teacher_id = ? LIMIT 1',
      [subjectId, teacherId]
    );

    if (subjectRows.length === 0) {
      return res.status(404).json({ error: 'Subject not found or access denied' });
    }

    // Get students not already enrolled in this subject
    const [rows] = await pool.execute(
      `
      SELECT 
        st.id,
        p.name,
        p.email
      FROM students st
      JOIN profiles p ON p.id = st.user_id
      WHERE st.id NOT IN (
        SELECT student_id FROM enrollments WHERE subject_id = ?
      )
      ORDER BY p.name ASC
      `,
      [subjectId]
    );

    res.json({ students: rows || [] });
  } catch (error) {
    console.error('Error fetching available students:', error);
    res.status(500).json({ error: 'Failed to fetch available students' });
  }
});

// Enroll a single student in a subject
app.post('/api/teacher/subjects/:id/enroll-student', verifyJWT, async (req, res) => {
  try {
    const subjectId = req.params.id;
    const { studentId, studentEmail } = req.body;

    if (!studentId && !studentEmail) {
      return res.status(400).json({ error: 'studentId or studentEmail is required' });
    }

    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherRows[0].id;

    const [subjectRows] = await pool.execute(
      'SELECT id, code FROM subjects WHERE id = ? AND teacher_id = ? LIMIT 1',
      [subjectId, teacherId]
    );

    if (subjectRows.length === 0) {
      return res.status(404).json({ error: 'Subject not found or access denied' });
    }

    // Find student ID from email if not provided
    let resolvedStudentId = studentId;
    if (!resolvedStudentId && studentEmail) {
      const [userRows] = await pool.execute(
        'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1',
        [studentEmail.toLowerCase()]
      );
      
      if (userRows.length === 0) {
        return res.status(404).json({ error: 'Student user not found' });
      }

      const [studentRows] = await pool.execute(
        'SELECT id FROM students WHERE user_id = ? LIMIT 1',
        [userRows[0].id]
      );

      if (studentRows.length === 0) {
        return res.status(404).json({ error: 'Student record not found' });
      }

      resolvedStudentId = studentRows[0].id;
    }

    // Check if already enrolled
    const [existingEnrollment] = await pool.execute(
      'SELECT id FROM enrollments WHERE student_id = ? AND subject_id = ? LIMIT 1',
      [resolvedStudentId, subjectId]
    );

    if (existingEnrollment.length > 0) {
      return res.status(400).json({ error: 'Student already enrolled in this subject' });
    }

    // Create enrollment
    const [result] = await pool.execute(
      'INSERT INTO enrollments (student_id, subject_id, enrollment_date, status) VALUES (?, ?, NOW(), ?)',
      [resolvedStudentId, subjectId, 'enrolled']
    );

    res.json({ success: true, message: 'Student enrolled successfully', enrollmentId: result.insertId });
  } catch (error) {
    console.error('Error enrolling student:', error);
    res.status(500).json({ error: 'Failed to enroll student' });
  }
});

// Create a new student and enroll them in a subject
app.post('/api/teacher/subjects/:id/create-and-enroll', verifyJWT, async (req, res) => {
  // Helper function to generate UUID
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  try {
    const subjectId = req.params.id;
    const { name, email, department, rollNumber, semester } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required' });
    }

    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherRows[0].id;

    const [subjectRows] = await pool.execute(
      'SELECT id, code FROM subjects WHERE id = ? AND teacher_id = ? LIMIT 1',
      [subjectId, teacherId]
    );

    if (subjectRows.length === 0) {
      return res.status(404).json({ error: 'Subject not found or access denied' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    let [userRows] = await pool.execute(
      'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1',
      [normalizedEmail]
    );

    let userId;
    if (userRows.length > 0) {
      userId = userRows[0].id;
    } else {
      // Create new user with UUID
      userId = generateUUID();
      const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
      // Note: Using bcrypt hash format for compatibility
      const passwordHash = '$2a$10$' + tempPassword; // Placeholder hash
      
      await pool.execute(
        'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, NOW())',
        [userId, normalizedEmail, passwordHash]
      );
    }

    // Create or update profile
    await pool.execute(
      'INSERT INTO profiles (id, name, email, department) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = ?, department = ?',
      [userId, name, normalizedEmail, department || 'General', name, department || 'General']
    );

    // Ensure user has student role
    const [roleRows] = await pool.execute(
      'SELECT id FROM user_roles WHERE user_id = ? LIMIT 1',
      [userId]
    );
    if (roleRows.length > 0) {
      await pool.execute(
        'UPDATE user_roles SET role = ? WHERE user_id = ?',
        ['student', userId]
      );
    } else {
      await pool.execute(
        'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)',
        [generateUUID(), userId, 'student']
      );
    }

    // Check if student record exists
    let [studentRows] = await pool.execute(
      'SELECT id, roll_number FROM students WHERE user_id = ? LIMIT 1',
      [userId]
    );

    let studentId;
    let finalRollNumber = rollNumber || `AUTO${Date.now().toString().slice(-6)}`;
    
    if (studentRows.length > 0) {
      studentId = studentRows[0].id;
      // Check if roll number needs to be updated (only if provided and different)
      if (rollNumber && rollNumber !== studentRows[0].roll_number) {
        await pool.execute(
          'UPDATE students SET roll_number = ?, semester = ? WHERE id = ?',
          [finalRollNumber, semester || 1, studentId]
        );
      }
    } else {
      // Create new student record with UUID - handle potential roll_number collision
      studentId = generateUUID();
      try {
        await pool.execute(
          'INSERT INTO students (id, user_id, roll_number, semester) VALUES (?, ?, ?, ?)',
          [studentId, userId, finalRollNumber, semester || 1]
        );
      } catch (rollError) {
        // If roll_number collision, generate a new one
        finalRollNumber = `AUTO${Date.now().toString().slice(-6)}${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
        await pool.execute(
          'INSERT INTO students (id, user_id, roll_number, semester) VALUES (?, ?, ?, ?)',
          [studentId, userId, finalRollNumber, semester || 1]
        );
      }
    }

    // Check if already enrolled
    const [existingEnrollment] = await pool.execute(
      'SELECT id FROM enrollments WHERE student_id = ? AND subject_id = ? LIMIT 1',
      [studentId, subjectId]
    );

    if (existingEnrollment.length > 0) {
      return res.json({ success: true, message: 'Student already enrolled in this subject', enrollmentId: existingEnrollment[0].id });
    }

    // Create enrollment
    const enrollmentId = generateUUID();
    await pool.execute(
      'INSERT INTO enrollments (id, student_id, subject_id, enrollment_date, status) VALUES (?, ?, ?, NOW(), ?)',
      [enrollmentId, studentId, subjectId, 'enrolled']
    );

    res.json({ success: true, message: 'Student created and enrolled successfully', enrollmentId });
  } catch (error) {
    console.error('Error creating and enrolling student:', error);
    res.status(500).json({ error: 'Failed to create and enroll student' });
  }
});

app.post('/api/teacher/subjects/:id/bulk-enroll', verifyJWT, async (req, res) => {
  const subjectId = req.params.id;

  try {
    const enrollments = Array.isArray(req.body?.enrollments) ? req.body.enrollments : null;
    if (!enrollments || enrollments.length === 0) {
      return res.status(400).json({ error: 'enrollments is required' });
    }

    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherRows[0].id;

    const [subjectRows] = await pool.execute(
      'SELECT id, code FROM subjects WHERE id = ? AND teacher_id = ? LIMIT 1',
      [subjectId, teacherId]
    );

    if (subjectRows.length === 0) {
      return res.status(404).json({ error: 'Subject not found or access denied' });
    }

    const subjectCode = subjectRows[0].code;

    const result = {
      success: 0,
      failed: 0,
      errors: [],
    };

    const nowYear = new Date().getFullYear();
    const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const defaultNameFromEmail = (email) =>
      email
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Student';

    const generateRollNumber = () => {
      const base = Date.now().toString().slice(-6);
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      return `AUTO${base}${rand}`;
    };

    for (let i = 0; i < enrollments.length; i++) {
      const rowNum = i + 2; // header row + 1-based data rows
      const enrollment = enrollments[i] || {};
      const email = normalizeEmail(enrollment.studentEmail || enrollment.email);
      const status = (String(enrollment.status || 'enrolled').toLowerCase() || 'enrolled');
      const enrollmentDate = enrollment.enrollmentDate || null;

      if (!email || !isValidEmail(email)) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          email: enrollment.studentEmail || '',
          subject: enrollment.subjectCode || subjectCode,
          error: `Invalid email: ${enrollment.studentEmail || ''}`,
        });
        continue;
      }

      if (!['enrolled', 'dropped', 'completed'].includes(status)) {
        result.failed++;
        result.errors.push({
          row: rowNum,
          email,
          subject: enrollment.subjectCode || subjectCode,
          error: `Invalid status: ${status}`,
        });
        continue;
      }

      try {
        // Find or create user by email
        let userId = null;
        const [userRows] = await pool.execute('SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1', [email]);
        if (userRows.length > 0) {
          userId = userRows[0].id;
        } else {
          userId = uuidv4();
          const passwordHash = 'generated-' + Math.random().toString(36).slice(2);
          await pool.execute('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)', [userId, email, passwordHash]);
        }

        // Ensure profile
        const [profileRows] = await pool.execute('SELECT id FROM profiles WHERE id = ? LIMIT 1', [userId]);
        if (profileRows.length === 0) {
          const name = String(enrollment.name || '').trim() || defaultNameFromEmail(email);
          const department = enrollment.department ? String(enrollment.department).trim() : 'General';
          await pool.execute(
            'INSERT INTO profiles (id, name, email, department) VALUES (?, ?, ?, ?)',
            [userId, name, email, department]
          );
        }

        // Ensure student role
        const [roleRows] = await pool.execute('SELECT role FROM user_roles WHERE user_id = ? LIMIT 1', [userId]);
        if (roleRows.length === 0) {
          await pool.execute('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)', [uuidv4(), userId, 'student']);
        } else if (roleRows[0].role !== 'student') {
          // Do not auto-escalate roles; treat as failure for safety.
          result.failed++;
          result.errors.push({
            row: rowNum,
            email,
            subject: enrollment.subjectCode || subjectCode,
            error: `User role is '${roleRows[0].role}', not 'student'`,
          });
          continue;
        }

        // Ensure student record
        let studentId = null;
        const [studentRows] = await pool.execute('SELECT id FROM students WHERE user_id = ? LIMIT 1', [userId]);
        if (studentRows.length > 0) {
          studentId = studentRows[0].id;
        } else {
          studentId = uuidv4();
          const semester = Number.isFinite(Number(enrollment.semester)) ? Number(enrollment.semester) : 1;
          const rollNumber = String(enrollment.rollNumber || '').trim() || generateRollNumber();

          try {
            await pool.execute(
              'INSERT INTO students (id, user_id, roll_number, semester) VALUES (?, ?, ?, ?)',
              [studentId, userId, rollNumber, semester]
            );
          } catch (e) {
            if (e && e.code === 'ER_DUP_ENTRY') {
              // Roll number collision; retry once with a different roll number.
              const retryRoll = generateRollNumber();
              await pool.execute(
                'INSERT INTO students (id, user_id, roll_number, semester) VALUES (?, ?, ?, ?)',
                [studentId, userId, retryRoll, semester]
              );
            } else {
              throw e;
            }
          }
        }

        // Create enrollment
        const enrollmentId = uuidv4();
        const sql = enrollmentDate
          ? 'INSERT INTO enrollments (id, student_id, subject_id, enrollment_date, status) VALUES (?, ?, ?, ?, ?)'
          : 'INSERT INTO enrollments (id, student_id, subject_id, status) VALUES (?, ?, ?, ?)';
        const params = enrollmentDate
          ? [enrollmentId, studentId, subjectId, enrollmentDate, status]
          : [enrollmentId, studentId, subjectId, status];

        await pool.execute(sql, params);
        result.success++;
      } catch (e) {
        if (e && e.code === 'ER_DUP_ENTRY') {
          result.failed++;
          result.errors.push({
            row: rowNum,
            email,
            subject: enrollment.subjectCode || subjectCode,
            error: 'Student already enrolled in this subject',
          });
          continue;
        }

        result.failed++;
        result.errors.push({
          row: rowNum,
          email,
          subject: enrollment.subjectCode || subjectCode,
          error: e?.message || 'Bulk enrollment failed',
        });
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Bulk enroll error:', error);
    res.status(500).json({ error: 'Bulk enrollment failed' });
  }
});

// Teacher dashboard helpers
app.get('/api/teacher/me', verifyJWT, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT name, email, department FROM profiles WHERE id = ? LIMIT 1',
      [req.user.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Get teacher record
    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    res.json({ 
      profile: rows[0],
      teacher: teacherRows.length > 0 ? { id: teacherRows[0].id } : null
    });
  } catch (error) {
    console.error('Teacher me error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.get('/api/teacher/dashboard', verifyJWT, async (req, res) => {
  try {
    // Get teacher record from user_id
    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherRows[0].id;

    // Fetch all subjects for this teacher with enrolled counts
    const [subjects] = await pool.execute(`
      SELECT s.id, s.code, s.name, s.credits, s.semester,
             (SELECT COUNT(*) FROM enrollments e WHERE e.subject_id = s.id AND e.status = 'enrolled') as enrolledStudents
      FROM subjects s
      WHERE s.teacher_id = ?
      ORDER BY s.created_at DESC
    `, [teacherId]);

    const totalStudents = (subjects || []).reduce((sum, s) => sum + Number(s.enrolledStudents || 0), 0);

    // Recent announcements for teachers
    const [announcements] = await pool.execute(`
      SELECT id, title, content, published_at as created_at
      FROM announcements
      WHERE (target_audience = 'teacher' OR target_audience = 'all' OR target_audience IS NULL)
      ORDER BY published_at DESC
      LIMIT 5
    `);

    res.json({
      data: {
        subjects: subjects || [],
        totalStudents,
        totalSubjects: (subjects || []).length,
        announcements: announcements || [],
      },
    });
  } catch (error) {
    console.error('Teacher dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Student dashboard
app.get('/api/student/dashboard', verifyJWT, async (req, res) => {
  try {
    const userRole = req.user.role;
    console.log(`[StudentDashboard] userId=${req.user.userId}, role=${userRole}, clerkSub=${req.user.clerkSub}`);
    
    // If role in token is not student, deny access
    if (userRole && userRole !== 'student') {
      console.log(`[StudentDashboard] Access denied: role is '${userRole}', expected 'student'. Check Clerk public_metadata and MySQL user_roles table.`);
      return res.status(403).json({ error: `Access denied. Your role is '${userRole}' but student role is required. Check your Clerk public_metadata.role setting.` });
    }

    // Get student record
    let [studentRows] = await pool.execute(
      'SELECT id FROM students WHERE user_id = ?',
      [req.user.userId]
    );

    // If no student record, create one
    if (studentRows.length === 0) {
      const studentId = uuidv4();
      await pool.execute(
        'INSERT INTO students (id, user_id, roll_number, semester) VALUES (?, ?, ?, ?)',
        [studentId, req.user.userId, 'STU' + Math.floor(Math.random() * 10000), 1]
      );
      studentRows = [{ id: studentId }];
    }

    const studentId = studentRows[0].id;

    // Get attendance data
    const [attendanceRows] = await pool.execute(`
      SELECT 
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        COUNT(*) as total
      FROM attendance
      WHERE student_id = ?
    `, [studentId]);

    const attendance = attendanceRows[0] || { present: 0, total: 0 };
    const attendanceRate = attendance.total > 0 
      ? Math.round((attendance.present / attendance.total) * 100) 
      : 0;

    // Get marks data
    const [marksRows] = await pool.execute(`
      SELECT 
        m.marks_obtained,
        m.total_marks,
        s.name as subject_name,
        m.id
      FROM marks m
      JOIN subjects s ON m.subject_id = s.id
      WHERE m.student_id = ?
      ORDER BY m.created_at DESC
      LIMIT 10
    `, [studentId]);

    const recentMarks = (marksRows || []).map((m) => {
      const percentage = m.total_marks > 0 
        ? Math.round((m.marks_obtained / m.total_marks) * 100) 
        : 0;
      return {
        id: m.id,
        subjectName: m.subject_name,
        assessmentType: 'Exam', // Default value since exam_type column doesn't exist
        maxMarks: m.total_marks,
        obtainedMarks: m.marks_obtained,
        percentage
      };
    });

    const averageMarks = recentMarks.length > 0
      ? Math.round(recentMarks.reduce((sum, m) => sum + m.percentage, 0) / recentMarks.length)
      : 0;

    // Get enrolled subjects count
    const [enrollmentRows] = await pool.execute(
      'SELECT COUNT(*) as count FROM enrollments WHERE student_id = ? AND status = ?',
      [studentId, 'enrolled']
    );

    const subjectsCount = enrollmentRows[0]?.count || 0;

    // Get announcements for students
    const [announcementRows] = await pool.execute(`
      SELECT id, title, content, published_at
      FROM announcements
      WHERE target_audience IN ('students', 'all') OR target_audience IS NULL
      ORDER BY published_at DESC
      LIMIT 5
    `);

    const latestAnnouncements = (announcementRows || []).slice(0, 3).map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content || '',
      createdAt: a.published_at || a.created_at
    }));

    res.json({
      attendanceRate,
      averageMarks,
      subjectsCount,
      announcementsCount: announcementRows?.length || 0,
      recentMarks,
      latestAnnouncements
    });
  } catch (error) {
    console.error('Student dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Student marks endpoint
app.get('/api/student/marks', verifyJWT, async (req, res) => {
  try {
    // Use role from JWT token (which comes from Clerk metadata)
    const userRole = req.user.role;
    
    // If role in token is not student, deny access
    if (userRole && userRole !== 'student') {
      return res.status(403).json({ error: 'Access denied. Student role required.' });
    }

    // Get student record
    let [studentRows] = await pool.execute(
      'SELECT id FROM students WHERE user_id = ?',
      [req.user.userId]
    );

    // If no student record, create one
    if (studentRows.length === 0) {
      const studentId = uuidv4();
      await pool.execute(
        'INSERT INTO students (id, user_id, roll_number, semester) VALUES (?, ?, ?, ?)',
        [studentId, req.user.userId, 'STU' + Math.floor(Math.random() * 10000), 1]
      );
      studentRows = [{ id: studentId }];
    }

    const studentId = studentRows[0].id;

    // Get marks data
    const [marksRows] = await pool.execute(`
      SELECT 
        m.marks_obtained,
        m.total_marks,
        m.exam_type,
        m.assessment_name,
        s.name as subject_name,
        m.id
      FROM marks m
      JOIN subjects s ON m.subject_id = s.id
      WHERE m.student_id = ?
      ORDER BY m.created_at DESC
    `, [studentId]);

    const marks = (marksRows || []).map((m) => ({
      id: m.id,
      subjectName: m.subject_name,
      assessmentType: m.assessment_name || m.exam_type || 'Exam',
      maxMarks: m.total_marks,
      obtainedMarks: m.marks_obtained,
      percentage: m.total_marks > 0 
        ? Math.round((m.marks_obtained / m.total_marks) * 100) 
        : 0
    }));

    res.json({ marks });
  } catch (error) {
    console.error('Student marks error:', error);
    res.status(500).json({ error: 'Failed to fetch marks data' });
  }
});

// Student attendance endpoint
app.get('/api/student/attendance', verifyJWT, async (req, res) => {
  try {
    // Use role from JWT token (which comes from Clerk metadata)
    const userRole = req.user.role;
    
    // If role in token is not student, deny access
    if (userRole && userRole !== 'student') {
      return res.status(403).json({ error: 'Access denied. Student role required.' });
    }

    // Get student record
    let [studentRows] = await pool.execute(
      'SELECT id FROM students WHERE user_id = ?',
      [req.user.userId]
    );

    // If no student record, create one
    if (studentRows.length === 0) {
      const studentId = uuidv4();
      await pool.execute(
        'INSERT INTO students (id, user_id, roll_number, semester) VALUES (?, ?, ?, ?)',
        [studentId, req.user.userId, 'STU' + Math.floor(Math.random() * 10000), 1]
      );
      studentRows = [{ id: studentId }];
    }

    const studentId = studentRows[0].id;

    // Get attendance data with subject info
    const [attendanceRows] = await pool.execute(`
      SELECT 
        a.id,
        a.attendance_date as date,
        a.status,
        s.name as subject_name,
        s.code as subject_code
      FROM attendance a
      JOIN subjects s ON a.subject_id = s.id
      WHERE a.student_id = ?
      ORDER BY a.attendance_date DESC
    `, [studentId]);

    const attendanceHistory = (attendanceRows || []).map((a) => ({
      id: a.id,
      date: a.date,
      subjectName: a.subject_name,
      subjectCode: a.subject_code,
      status: a.status
    }));

    // Calculate subject-wise stats
    const subjectMap = new Map();
    (attendanceRows || []).forEach((a) => {
      const key = a.subject_name;
      if (!subjectMap.has(key)) {
        subjectMap.set(key, { id: key, name: a.subject_name, code: a.subject_code, present: 0, total: 0, rate: 0 });
      }
      const stats = subjectMap.get(key);
      stats.total++;
      if (a.status === 'present') stats.present++;
      stats.rate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
    });

    const subjectStats = Array.from(subjectMap.values());

    res.json({ attendanceHistory, subjectStats });
  } catch (error) {
    console.error('Student attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance data' });
  }
});

// Student announcements endpoint
app.get('/api/student/announcements', verifyJWT, async (req, res) => {
  try {
    // Use role from JWT token (which comes from Clerk metadata)
    const userRole = req.user.role;
    
    // If role in token is not student, deny access
    if (userRole && userRole !== 'student') {
      return res.status(403).json({ error: 'Access denied. Student role required.' });
    }

    // Get announcements for students and general announcements
    const [announcementRows] = await pool.execute(`
      SELECT id, title, content, published_at
      FROM announcements
      WHERE target_audience IN ('students', 'all')
      ORDER BY published_at DESC
      LIMIT 10
    `);

    const announcements = (announcementRows || []).map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      createdAt: a.published_at
    }));

    res.json({ announcements });
  } catch (error) {
    console.error('Student announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements data' });
  }
});

// Admin dashboard
app.get('/api/admin/dashboard', verifyJWT, async (req, res) => {
  try {
    const [roleRows] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (roleRows.length === 0 || roleRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const [
      studentCountRows,
      teacherCountRows,
      subjectCountRows,
      attendanceRows,
      announcementRows,
      studentDeptRows,
      subjectDeptRows
    ] = await Promise.all([
      pool.execute("SELECT COUNT(*) AS count FROM user_roles WHERE role = 'student'"),
      pool.execute("SELECT COUNT(*) AS count FROM user_roles WHERE role = 'teacher'"),
      pool.execute("SELECT COUNT(*) AS count FROM subjects"),
      pool.execute(`
        SELECT
          SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS presentCount,
          COUNT(*) AS totalCount
        FROM attendance
      `),
      pool.execute(`
        SELECT a.id, a.title,
               COALESCE(p.name, 'System') AS author_name,
               COALESCE(a.published_at, a.created_at) AS created_at
        FROM announcements a
        LEFT JOIN profiles p ON p.id = a.author_id
        ORDER BY a.published_at DESC
        LIMIT 3
      `),
      pool.execute(`
        SELECT p.department, COUNT(*) AS studentCount
        FROM profiles p
        JOIN user_roles ur ON ur.user_id = p.id
        WHERE ur.role = 'student' AND p.department IS NOT NULL AND p.department <> ''
        GROUP BY p.department
      `),
      pool.execute(`
        SELECT p.department, COUNT(*) AS subjectCount
        FROM subjects s
        JOIN teachers t ON s.teacher_id = t.id
        JOIN profiles p ON t.user_id = p.id
        WHERE p.department IS NOT NULL AND p.department <> ''
        GROUP BY p.department
      `),
    ]);

    const studentCount = Number((studentCountRows[0] && studentCountRows[0][0]?.count) || 0);
    const teacherCount = Number((teacherCountRows[0] && teacherCountRows[0][0]?.count) || 0);
    const subjectCount = Number((subjectCountRows[0] && subjectCountRows[0][0]?.count) || 0);

    const attendanceRow = attendanceRows[0] && attendanceRows[0][0] ? attendanceRows[0][0] : { presentCount: 0, totalCount: 0 };
    const totalCount = Number(attendanceRow.totalCount || 0);
    const presentCount = Number(attendanceRow.presentCount || 0);
    const attendanceRate = totalCount > 0 ? Number(((presentCount / totalCount) * 100).toFixed(1)) : 0;

    const studentDeptMap = new Map();
    (studentDeptRows[0] || []).forEach((row) => {
      if (!row.department) return;
      studentDeptMap.set(String(row.department), {
        department: String(row.department),
        studentCount: Number(row.studentCount || 0),
        subjectCount: 0,
      });
    });

    (subjectDeptRows[0] || []).forEach((row) => {
      if (!row.department) return;
      const key = String(row.department);
      const existing = studentDeptMap.get(key) || {
        department: key,
        studentCount: 0,
        subjectCount: 0,
      };
      existing.subjectCount = Number(row.subjectCount || 0);
      studentDeptMap.set(key, existing);
    });

    const departments = Array.from(studentDeptMap.values()).sort((a, b) =>
      String(a.department).localeCompare(String(b.department))
    );

    res.json({
      data: {
        stats: {
          totalStudents: studentCount,
          totalTeachers: teacherCount,
          totalSubjects: subjectCount,
          attendanceRate,
        },
        announcements: announcementRows[0] || [],
        departments,
      },
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch admin dashboard data' });
  }
});

// Admin user management endpoints
app.get('/api/admin/users', verifyJWT, async (req, res) => {
  try {
    const [roleRows] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (roleRows.length === 0 || roleRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const search = req.query.search ? String(req.query.search) : '';
    const roleFilter = req.query.role ? String(req.query.role) : '';

    let query = `
      SELECT 
        p.id,
        p.name,
        p.email,
        p.department,
        p.created_at,
        COALESCE(ur.role, 'student') as role,
        s.roll_number,
        s.semester,
        t.employee_id
      FROM profiles p
      LEFT JOIN user_roles ur ON p.id = ur.user_id
      LEFT JOIN students s ON p.id = s.user_id
      LEFT JOIN teachers t ON p.id = t.user_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (p.name LIKE ? OR p.email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (roleFilter) {
      query += ` AND ur.role = ?`;
      params.push(roleFilter);
    }

    query += ` ORDER BY p.created_at DESC`;

    const [users] = await pool.execute(query, params);

    res.json({ 
      users: (users || []).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        department: u.department || 'Not specified',
        role: u.role || 'student',
        created_at: u.created_at,
        roll_number: u.roll_number,
        semester: u.semester,
        employee_id: u.employee_id
      }))
    });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create new user
app.post('/api/admin/users', verifyJWT, async (req, res) => {
  try {
    const [roleRows] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (roleRows.length === 0 || roleRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { name, email, role, department, roll_number, semester, employee_id } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Check if email already exists
    const [existing] = await pool.execute('SELECT id FROM profiles WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const userId = crypto.randomUUID();
    const passwordHash = 'temp-' + Math.random().toString(36).slice(2);

    // Create user
    await pool.execute(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      [userId, email, passwordHash]
    );

    // Create profile
    await pool.execute(
      'INSERT INTO profiles (id, name, email, department) VALUES (?, ?, ?, ?)',
      [userId, name, email, department || null]
    );

    // Create role
    await pool.execute(
      'INSERT INTO user_roles (user_id, role) VALUES (?, ?)',
      [userId, role || 'student']
    );

    // Create role-specific record
    if (role === 'student') {
      await pool.execute(
        'INSERT INTO students (user_id, roll_number, semester, enrollment_year) VALUES (?, ?, ?, ?)',
        [userId, roll_number || null, semester ? parseInt(semester) : null, new Date().getFullYear()]
      );
    } else if (role === 'teacher') {
      await pool.execute(
        'INSERT INTO teachers (user_id, employee_id) VALUES (?, ?)',
        [userId, employee_id || null]
      );
    }

    const tempPassword = Math.random().toString(36).slice(-8) + "A1!";

    res.json({ 
      success: true,
      user: {
        id: userId,
        name,
        email,
        role: role || 'student',
        department: department || 'Not specified'
      },
      tempPassword
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
app.put('/api/admin/users/:id', verifyJWT, async (req, res) => {
  try {
    const [roleRows] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (roleRows.length === 0 || roleRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const userId = req.params.id;
    const { name, email, role, department, roll_number, semester, employee_id } = req.body;

    // Update profile
    await pool.execute(
      'UPDATE profiles SET name = ?, email = ?, department = ? WHERE id = ?',
      [name, email, department || null, userId]
    );

    // Update role
    const [existingRole] = await pool.execute('SELECT user_id FROM user_roles WHERE user_id = ?', [userId]);
    if (existingRole.length > 0) {
      await pool.execute('UPDATE user_roles SET role = ? WHERE user_id = ?', [role || 'student', userId]);
    } else {
      await pool.execute('INSERT INTO user_roles (user_id, role) VALUES (?, ?)', [userId, role || 'student']);
    }

    // Update role-specific records
    if (role === 'student') {
      const [existingStudent] = await pool.execute('SELECT user_id FROM students WHERE user_id = ?', [userId]);
      if (existingStudent.length > 0) {
        await pool.execute(
          'UPDATE students SET roll_number = ?, semester = ? WHERE user_id = ?',
          [roll_number || null, semester ? parseInt(semester) : null, userId]
        );
      } else {
        await pool.execute(
          'INSERT INTO students (user_id, roll_number, semester, enrollment_year) VALUES (?, ?, ?, ?)',
          [userId, roll_number || null, semester ? parseInt(semester) : null, new Date().getFullYear()]
        );
      }
    } else if (role === 'teacher') {
      const [existingTeacher] = await pool.execute('SELECT user_id FROM teachers WHERE user_id = ?', [userId]);
      if (existingTeacher.length > 0) {
        await pool.execute('UPDATE teachers SET employee_id = ? WHERE user_id = ?', [employee_id || null, userId]);
      } else {
        await pool.execute('INSERT INTO teachers (user_id, employee_id) VALUES (?, ?)', [userId, employee_id || null]);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
app.delete('/api/admin/users/:id', verifyJWT, async (req, res) => {
  try {
    const [roleRows] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (roleRows.length === 0 || roleRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const userId = req.params.id;

    // Delete in correct order due to foreign keys
    await pool.execute('DELETE FROM students WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM teachers WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);
    await pool.execute('DELETE FROM profiles WHERE id = ?', [userId]);
    await pool.execute('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Reset user password
app.post('/api/admin/users/:id/reset-password', verifyJWT, async (req, res) => {
  try {
    const [roleRows] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (roleRows.length === 0 || roleRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const userId = req.params.id;
    const tempPassword = Math.random().toString(36).slice(-8) + "A1!";

    // Update password in users table
    await pool.execute(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      ['reset-' + tempPassword, userId]
    );

    res.json({ 
      success: true,
      tempPassword
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Admin announcement endpoints
app.get('/api/admin/announcements', verifyJWT, async (req, res) => {
  try {
    const [roleRows] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (roleRows.length === 0 || roleRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const [announcements] = await pool.execute(`
      SELECT 
        a.id,
        a.title,
        a.content,
        a.target_audience,
        a.published_at,
        a.created_at,
        COALESCE(p.name, 'System') AS author_name
      FROM announcements a
      LEFT JOIN profiles p ON p.id = a.author_id
      ORDER BY a.published_at DESC, a.created_at DESC
    `);

    res.json({ 
      announcements: (announcements || []).map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        target_role: a.target_audience,
        created_at: a.published_at || a.created_at,
        profiles: { name: a.author_name }
      }))
    });
  } catch (error) {
    console.error('Admin announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

app.post('/api/admin/announcements', verifyJWT, async (req, res) => {
  try {
    const [roleRows] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (roleRows.length === 0 || roleRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const { title, content, target_audience } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    if (!target_audience || !['all', 'students', 'teachers', 'admin'].includes(target_audience)) {
      return res.status(400).json({ error: 'Invalid target audience' });
    }

    const announcementId = uuidv4();
    const now = new Date().toISOString();

    await pool.execute(
      'INSERT INTO announcements (id, title, content, target_audience, author_id, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [announcementId, title, content, target_audience, req.user.userId, now, now]
    );

    res.json({ 
      success: true,
      id: announcementId,
      title,
      content,
      target_audience,
      published_at: now
    });
  } catch (error) {
    console.error('Create admin announcement error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

app.delete('/api/admin/announcements/:id', verifyJWT, async (req, res) => {
  try {
    const [roleRows] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (roleRows.length === 0 || roleRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const announcementId = req.params.id;

    const [result] = await pool.execute('DELETE FROM announcements WHERE id = ?', [announcementId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete admin announcement error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// Admin analytics endpoint
app.get('/api/admin/analytics', verifyJWT, async (req, res) => {
  try {
    const [roleRows] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (roleRows.length === 0 || roleRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    // Fetch all necessary data in parallel
    const [
      attendanceResult,
      marksResult,
      subjectsResult,
      enrollmentsResult,
      studentsResult,
      profilesResult
    ] = await Promise.all([
      // Attendance data
      pool.execute('SELECT status, attendance_date FROM attendance'),
      
      // Marks data for pass rate
      pool.execute('SELECT marks_obtained, total_marks, student_id FROM marks'),
      
      // Active subjects
      pool.execute('SELECT COUNT(*) as count FROM subjects'),
      
      // Total enrollments
      pool.execute('SELECT COUNT(*) as count FROM enrollments WHERE status = "enrolled"'),
      
      // Students data with department info
      pool.execute(`
        SELECT s.id, p.department 
        FROM students s 
        LEFT JOIN profiles p ON s.user_id = p.id
      `),
      
      // Profiles for department stats
      pool.execute('SELECT department FROM profiles WHERE department IS NOT NULL AND department != ""')
    ]);

    // Extract data from results
    const attendance = attendanceResult[0] || [];
    const marks = marksResult[0] || [];
    const activeCourses = subjectsResult[0][0]?.count || 0;
    const totalEnrollment = enrollmentsResult[0][0]?.count || 0;
    const students = studentsResult[0] || [];
    const profiles = profilesResult[0] || [];

    // Calculate analytics
    const analytics = {
      avgAttendance: calculateAverageAttendance(attendance),
      passRate: calculatePassRate(marks),
      activeCourses,
      totalEnrollment,
      attendanceTrends: calculateAttendanceTrends(attendance),
      departmentPerformance: calculateDepartmentPerformance(students, marks)
    };

    res.json(analytics);
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics data' });
  }
});

// Helper functions for analytics calculations
function calculateAverageAttendance(attendance) {
  if (!attendance.length) return 0;
  
  const presentCount = attendance.filter(a => a.status === 'present').length;
  return Math.round((presentCount / attendance.length) * 100);
}

function calculatePassRate(marks) {
  if (!marks.length) return 0;
  
  const passCount = marks.filter(m => {
    const percentage = m.total_marks > 0 ? (m.marks_obtained / m.total_marks) * 100 : 0;
    return percentage >= 40;
  }).length;
  
  return Math.round((passCount / marks.length) * 100);
}

function calculateAttendanceTrends(attendance) {
  const now = new Date();
  const trends = [];
  
  for (let i = 3; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = monthDate.toLocaleDateString('en-US', { month: 'long' });
    
    const monthAttendance = attendance.filter(a => {
      const attendanceDate = new Date(a.attendance_date);
      return attendanceDate.getMonth() === monthDate.getMonth() && 
             attendanceDate.getFullYear() === monthDate.getFullYear();
    });
    
    const rate = monthAttendance.length > 0 
      ? Math.round((monthAttendance.filter(a => a.status === 'present').length / monthAttendance.length) * 100)
      : 0;
    
    trends.push({ month: monthName, rate });
  }
  
  return trends;
}

function calculateDepartmentPerformance(students, marks) {
  // Group students by department
  const departmentGroups = students.reduce((acc, student) => {
    const dept = student.department || 'Unknown';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(student);
    return acc;
  }, {});

  // Calculate performance for each department
  return Object.entries(departmentGroups).map(([dept, deptStudents]) => {
    const studentIds = deptStudents.map(s => s.id);
    
    // Get marks for students in this department
    const deptMarks = marks.filter(m => studentIds.includes(m.student_id));
    
    // Calculate average marks
    const avgMarks = deptMarks.length > 0
      ? Math.round(
          deptMarks.reduce((sum, m) => {
            const percentage = m.total_marks > 0 ? (m.marks_obtained / m.total_marks) * 100 : 0;
            return sum + percentage;
          }, 0) / deptMarks.length
        )
      : 0;
    
    return {
      dept,
      avg: avgMarks,
      students: deptStudents.length
    };
  }).sort((a, b) => b.avg - a.avg); // Sort by performance (highest first)
}

// Admin attendance endpoints
app.get('/api/admin/attendance', verifyJWT, async (req, res) => {
  try {
    const [roleRows] = await pool.execute(
      'SELECT role FROM user_roles WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (roleRows.length === 0 || roleRows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }

    const limit = req.query.limit ? parseInt(String(req.query.limit)) : 50;
    const date = req.query.date ? String(req.query.date) : null;

    let query = `
      SELECT 
        a.id,
        a.attendance_date as date,
        a.status,
        COALESCE(p.name, s.roll_number, 'Unknown Student') as student_name,
        sub.name as subject_name
      FROM attendance a
      LEFT JOIN students s ON a.student_id = s.id
      LEFT JOIN profiles p ON s.user_id = p.id
      LEFT JOIN subjects sub ON a.subject_id = sub.id
      WHERE 1=1
    `;
    const params = [];

    if (date) {
      query += ` AND a.attendance_date = ?`;
      params.push(date);
    }

    query += ` ORDER BY a.attendance_date DESC LIMIT ?`;
    params.push(limit);

    const [records] = await pool.execute(query, params);

    // Get today's stats
    const today = new Date().toISOString().split('T')[0];
    const [todayStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent
      FROM attendance
      WHERE attendance_date = ?
    `, [today]);

    const stats = todayStats[0] || { total: 0, present: 0, absent: 0 };

    res.json({ 
      records: (records || []).map((r) => ({
        id: r.id,
        student_name: r.student_name,
        subject_name: r.subject_name || 'Unknown Subject',
        date: r.date,
        status: r.status
      })),
      stats: {
        todayRecords: Number(stats.total || 0),
        presentToday: Number(stats.present || 0),
        absentToday: Number(stats.absent || 0)
      }
    });
  } catch (error) {
    console.error('Admin attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance data' });
  }
});

// Teacher announcement endpoints
app.get('/api/teacher/announcements', verifyJWT, async (req, res) => {
  try {
    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherRows[0].id;

    // Get teacher's announcements and global announcements
    const [announcements] = await pool.execute(`
      SELECT id, title, content, target_audience, published_at as created_at
      FROM announcements
      WHERE author_id = ? OR target_audience IN ('all', 'teacher')
      ORDER BY published_at DESC
      LIMIT 50
    `, [teacherId]);

    res.json({ announcements: announcements || [] });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

app.post('/api/teacher/announcements', verifyJWT, async (req, res) => {
  try {
    const { title, content, target_audience } = req.body;

    console.log('🔍 Creating announcement:', {
      title: title?.substring(0, 50),
      contentLength: content?.length,
      target_audience,
      userId: req.user.userId
    });

    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content are required' });
    }

    // Validate target_audience
    const validAudiences = ['all', 'students', 'teachers', 'admin'];
    const finalAudience = target_audience || 'all';
    
    if (!validAudiences.includes(finalAudience)) {
      console.log('❌ Invalid target_audience:', finalAudience, 'Valid options:', validAudiences);
      return res.status(400).json({ 
        error: 'Invalid target audience', 
        validOptions: validAudiences,
        received: finalAudience
      });
    }

    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherRows[0].id;
    const announcementId = uuidv4();

    console.log('✅ Validated announcement data:', {
      announcementId,
      teacherId,
      finalAudience
    });

    // Use user_id as author_id (foreign key constraint)
    await pool.execute(`
      INSERT INTO announcements (id, title, content, author_id, target_audience, published_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `, [announcementId, title, content, req.user.userId, finalAudience]);

    res.json({ success: true, id: announcementId });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

app.delete('/api/teacher/announcements/:id', verifyJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherRows[0].id;

    // Delete only if the announcement belongs to this teacher
    const [result] = await pool.execute(
      'DELETE FROM announcements WHERE id = ? AND author_id = ?',
      [id, teacherId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Announcement not found or not authorized' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// Teacher marks endpoints
app.get('/api/teacher/subjects/:id/marks', verifyJWT, async (req, res) => {
  try {
    const { id: subjectId } = req.params;
    const { assessment } = req.query;

    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherRows[0].id;

    // Verify subject belongs to teacher
    const [subjectRows] = await pool.execute(
      'SELECT id FROM subjects WHERE id = ? AND teacher_id = ? LIMIT 1',
      [subjectId, teacherId]
    );

    if (subjectRows.length === 0) {
      return res.status(404).json({ error: 'Subject not found or access denied' });
    }

    let query = `
      SELECT m.id, m.student_id, m.subject_id, m.assessment_name as assessment, 
             m.marks_obtained AS obtained_marks, m.total_marks AS max_marks, m.exam_date,
             s.roll_number, p.name as student_name, p.email
      FROM marks m
      JOIN students s ON m.student_id = s.id
      JOIN profiles p ON s.user_id = p.id
      WHERE m.subject_id = ?
    `;
    const params = [subjectId];

    if (assessment) {
      query += ' AND m.assessment_name = ?';
      params.push(assessment);
    }

    query += ' ORDER BY s.roll_number';

    const [marks] = await pool.execute(query, params);
    res.json({ marks: marks || [] });
  } catch (error) {
    console.error('Get marks error:', error);
    res.status(500).json({ error: 'Failed to fetch marks' });
  }
});

app.post('/api/teacher/marks', verifyJWT, async (req, res) => {
  try {
    const { marks: marksData } = req.body;

    if (!Array.isArray(marksData) || marksData.length === 0) {
      return res.status(400).json({ error: 'Marks data is required' });
    }

    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const validationErrors = [];
    for (const mark of marksData) {
      if (!mark?.studentId || !mark?.subjectId) {
        validationErrors.push('Each mark entry must include studentId and subjectId');
        continue;
      }

      const [authorizedRows] = await pool.execute(
        `
        SELECT s.id AS subject_id, e.student_id
        FROM subjects s
        JOIN teachers t ON t.id = s.teacher_id
        LEFT JOIN enrollments e
          ON e.subject_id = s.id
         AND e.student_id = ?
         AND e.status = 'enrolled'
        WHERE s.id = ? AND t.user_id = ?
        LIMIT 1
        `,
        [mark.studentId, mark.subjectId, req.user.userId]
      );

      if (authorizedRows.length === 0) {
        validationErrors.push(`Subject ${mark.subjectId} not found or access denied`);
        continue;
      }

      if (!authorizedRows[0].student_id) {
        validationErrors.push(`Student ${mark.studentId} is not enrolled in subject ${mark.subjectId}`);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({ error: validationErrors[0] });
    }

    const results = [];
    for (const mark of marksData) {
      const markId = uuidv4();
      
      try {
        // First check if mark already exists
        const [existingMarks] = await pool.execute(
          'SELECT id FROM marks WHERE student_id = ? AND subject_id = ? AND assessment_name = ?',
          [mark.studentId, mark.subjectId, mark.assessment]
        );

        const assessmentType = mapAssessmentToExamType(mark.assessment);

        if (existingMarks.length > 0) {
          // Update existing mark
          await pool.execute(
            'UPDATE marks SET marks_obtained = ?, total_marks = ?, exam_date = NOW() WHERE student_id = ? AND subject_id = ? AND assessment_name = ?',
            [mark.obtainedMarks, mark.maxMarks, mark.studentId, mark.subjectId, mark.assessment]
          );
        } else {
          // Insert new mark
          await pool.execute(`
            INSERT INTO marks (id, student_id, subject_id, assessment_type, assessment_name, marks_obtained, total_marks, exam_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
          `, [markId, mark.studentId, mark.subjectId, assessmentType, mark.assessment, mark.obtainedMarks, mark.maxMarks]);
        }
        
        results.push({ success: true, studentId: mark.studentId });
      } catch (error) {
        console.error('Error saving mark for student', mark.studentId, error);
        results.push({
          success: false,
          studentId: mark.studentId,
          error: error instanceof Error ? error.message : 'Failed to save mark',
        });
      }
    }

    const failedResults = results.filter((result) => !result.success);
    if (failedResults.length > 0) {
      return res.status(400).json({
        error: failedResults[0].error || 'Failed to save one or more marks',
        results,
      });
    }

    res.json({ results });
  } catch (error) {
    console.error('Save marks error:', error);
    res.status(500).json({ error: 'Failed to save marks' });
  }
});

// Teacher attendance endpoints
app.post('/api/teacher/attendance', verifyJWT, async (req, res) => {
  try {
    const { attendance: attendanceData } = req.body;

    console.log('🔍 Attendance request received:', {
      userId: req.user.userId,
      attendanceData: attendanceData
    });

    if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
      return res.status(400).json({ error: 'Attendance data is required' });
    }

    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherRows[0].id;
    console.log('🔍 Teacher ID:', teacherId);

    // Verify all subjects belong to teacher
    const subjectIds = [...new Set(attendanceData.map(a => a.subjectId))];
    console.log('🔍 Subject IDs to verify:', subjectIds);
    
    // Use individual queries instead of IN clause for better debugging
    const subjectQueries = subjectIds.map(subjectId => 
      pool.execute('SELECT id FROM subjects WHERE id = ? AND teacher_id = ?', [subjectId, teacherId])
    );
    
    const subjectResults = await Promise.all(subjectQueries);
    const foundSubjects = subjectResults.flatMap(([rows]) => rows).map(row => row.id);
    
    console.log('🔍 Found subjects:', foundSubjects);
    console.log('🔍 Expected:', subjectIds, 'Found:', foundSubjects);

    if (foundSubjects.length !== subjectIds.length) {
      return res.status(404).json({ error: 'One or more subjects not found or access denied' });
    }

    const results = [];
    for (const attendance of attendanceData) {
      const attendanceId = uuidv4();
      
      try {
        // Check if attendance already exists
        const [existingAttendance] = await pool.execute(
          'SELECT id FROM attendance WHERE student_id = ? AND subject_id = ? AND attendance_date = ?',
          [attendance.studentId, attendance.subjectId, attendance.date]
        );

        if (existingAttendance.length > 0) {
          // Update existing attendance
          await pool.execute(
            'UPDATE attendance SET status = ? WHERE student_id = ? AND subject_id = ? AND attendance_date = ?',
            [attendance.status, attendance.studentId, attendance.subjectId, attendance.date]
          );
        } else {
          // Insert new attendance
          await pool.execute(`
            INSERT INTO attendance (id, student_id, subject_id, attendance_date, status)
            VALUES (?, ?, ?, ?, ?)
          `, [attendanceId, attendance.studentId, attendance.subjectId, attendance.date, attendance.status]);
        }
        
        results.push({ success: true, studentId: attendance.studentId });
      } catch (error) {
        console.error('Error saving attendance for student', attendance.studentId, error);
        results.push({
          success: false,
          studentId: attendance.studentId,
          error: error instanceof Error ? error.message : 'Failed to save attendance',
        });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Save attendance error:', error);
    res.status(500).json({ error: 'Failed to save attendance' });
  }
});

app.get('/api/teacher/subjects/:id/attendance', verifyJWT, async (req, res) => {
  try {
    const { id: subjectId } = req.params;
    const { date } = req.query;

    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherRows[0].id;

    // Verify subject belongs to teacher
    const [subjectRows] = await pool.execute(
      'SELECT id FROM subjects WHERE id = ? AND teacher_id = ? LIMIT 1',
      [subjectId, teacherId]
    );

    if (subjectRows.length === 0) {
      return res.status(404).json({ error: 'Subject not found or access denied' });
    }

    let query = `
      SELECT a.id, a.student_id, a.subject_id, a.attendance_date, a.status,
             s.roll_number, p.name as student_name, p.email
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN profiles p ON s.user_id = p.id
      WHERE a.subject_id = ?
    `;
    const params = [subjectId];

    if (date) {
      query += ' AND a.attendance_date = ?';
      params.push(date);
    }

    query += ' ORDER BY a.attendance_date DESC, s.roll_number';

    const [attendance] = await pool.execute(query, params);
    res.json({ attendance: attendance || [] });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

app.get('/api/teacher/subjects/:id/attendance/history', verifyJWT, async (req, res) => {
  try {
    const { id: subjectId } = req.params;

    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherRows[0].id;

    // Verify subject belongs to teacher
    const [subjectRows] = await pool.execute(
      'SELECT id FROM subjects WHERE id = ? AND teacher_id = ? LIMIT 1',
      [subjectId, teacherId]
    );

    if (subjectRows.length === 0) {
      return res.status(404).json({ error: 'Subject not found or access denied' });
    }

    const [attendance] = await pool.execute(`
      SELECT a.id, a.student_id, a.subject_id, a.attendance_date, a.status,
             s.roll_number, p.name as student_name, p.email
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN profiles p ON s.user_id = p.id
      WHERE a.subject_id = ?
      ORDER BY a.attendance_date DESC, s.roll_number
    `, [subjectId]);

    res.json({ attendance: attendance || [] });
  } catch (error) {
    console.error('Get attendance history error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
});

app.get('/api/teacher/subjects/:id/attendance/range', verifyJWT, async (req, res) => {
  try {
    const { id: subjectId } = req.params;
    const { from: fromDate, to: toDate } = req.query;

    const [teacherRows] = await pool.execute(
      'SELECT id FROM teachers WHERE user_id = ? LIMIT 1',
      [req.user.userId]
    );

    if (teacherRows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }

    const teacherId = teacherRows[0].id;

    // Verify subject belongs to teacher
    const [subjectRows] = await pool.execute(
      'SELECT id FROM subjects WHERE id = ? AND teacher_id = ? LIMIT 1',
      [subjectId, teacherId]
    );

    if (subjectRows.length === 0) {
      return res.status(404).json({ error: 'Subject not found or access denied' });
    }

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'From date and to date are required' });
    }

    const [attendance] = await pool.execute(`
      SELECT a.id, a.student_id, a.subject_id, a.attendance_date, a.status,
             s.roll_number, p.name as student_name, p.email
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN profiles p ON s.user_id = p.id
      WHERE a.subject_id = ? AND a.attendance_date BETWEEN ? AND ?
      ORDER BY a.attendance_date ASC, s.roll_number
    `, [subjectId, fromDate, toDate]);

    res.json({ attendance: attendance || [] });
  } catch (error) {
    console.error('Get attendance range error:', error);
    res.status(500).json({ error: 'Failed to fetch attendance range' });
  }
});

// Events endpoints
app.get('/api/events', async (req, res) => {
  try {
    const [events] = await pool.execute(`
      SELECT id, title, description, event_date, venue, 
             organizer_id, target_audience, created_at, updated_at
      FROM events
      ORDER BY event_date ASC
    `);
    res.json({ events: events || [] });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

app.post('/api/events', verifyJWT, async (req, res) => {
  try {
    const { title, description, event_type, event_date, venue, capacity, status } = req.body;

    if (!title || !event_date) {
      return res.status(400).json({ error: 'Title and date are required' });
    }

    // Validate title length
    if (title && title.length > 255) {
      return res.status(400).json({ error: 'Title must be 255 characters or less' });
    }

    // Convert ISO date to DATE format if needed
    let formattedDate = event_date;
    if (event_date && event_date.includes('T')) {
      // Extract date part from ISO string
      formattedDate = event_date.split('T')[0];
    }

    const eventId = uuidv4();
    const organizerId = req.user.userId;

    console.log('🔍 Creating event:', {
      eventId,
      title: title.substring(0, 50) + (title.length > 50 ? '...' : ''),
      titleLength: title.length,
      originalDate: event_date,
      formattedDate,
      venue,
      organizerId
    });

    await pool.execute(`
      INSERT INTO events (id, title, description, event_date, venue, organizer_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [eventId, title, description || null, formattedDate, venue || null, organizerId]);

    res.json({ success: true, id: eventId });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

app.put('/api/events/:id', verifyJWT, async (req, res) => {
  try {
    const { id: eventId } = req.params;
    const { title, description, event_type, event_date, venue, capacity, status } = req.body;

    if (!title || !event_date) {
      return res.status(400).json({ error: 'Title and date are required' });
    }

    // Convert ISO date to DATE format if needed
    let formattedDate = event_date;
    if (event_date && event_date.includes('T')) {
      // Extract date part from ISO string
      formattedDate = event_date.split('T')[0];
    }

    await pool.execute(`
      UPDATE events 
      SET title = ?, description = ?, event_date = ?, venue = ?, updated_at = NOW()
      WHERE id = ?
    `, [title, description || null, formattedDate, venue || null, eventId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

app.delete('/api/events/:id', verifyJWT, async (req, res) => {
  try {
    const { id: eventId } = req.params;

    await pool.execute('DELETE FROM events WHERE id = ?', [eventId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Start server
async function startServer() {
  await initDB();

  const server = app.listen(PORT, () => {
    console.log(`🚀 Node.js API server running on http://localhost:${PORT}`);
    console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use. Stop the existing process on that port or change API_PORT in backend/.env.`);
      return process.exit(1);
    }

    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

startServer().catch(console.error);

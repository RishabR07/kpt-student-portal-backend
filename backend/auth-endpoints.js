const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Helper functions
function generateTempPassword() {
  return Math.random().toString(36).slice(-8) + 'A1!';
}

function generateJWT(userId, email, role) {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );
}

// Login endpoint
function setupLoginEndpoint(app, pool) {
  app.post('/api/auth/login', async (req, res) => {
    try {
      console.log('🔐 Login attempt:', { body: req.body, headers: req.headers });
      
      // Handle body parsing manually if needed
      let email, password;
      if (req.body && typeof req.body === 'object') {
        email = req.body.email;
        password = req.body.password;
      } else {
        console.log('❌ Invalid request body:', req.body);
        return res.status(400).json({ error: 'Invalid request format' });
      }

      if (!email || !password) {
        console.log('❌ Missing email or password');
        return res.status(400).json({ error: 'Email and password are required' });
      }

      // Find user by email
      const [userRows] = await pool.execute(
        'SELECT id, email, password_hash, password_changed_at FROM users WHERE LOWER(email) = ? LIMIT 1',
        [email.toLowerCase().trim()]
      );

      console.log('👤 User query result:', userRows.length, 'records found');

      if (userRows.length === 0) {
        console.log('❌ User not found');
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const user = userRows[0];
      console.log('🔐 User found:', { id: user.id, email: user.email, hasPassword: !!user.password_hash });

      // Check password
      try {
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        console.log('🔍 Password match:', passwordMatch);

        if (!passwordMatch) {
          console.log('❌ Password does not match');
          return res.status(401).json({ error: 'Invalid email or password' });
        }
      } catch (bcryptError) {
        console.error('❌ bcrypt comparison error:', bcryptError);
        return res.status(500).json({ error: 'Password verification failed' });
      }

      // Get user role
      const [roleRows] = await pool.execute(
        'SELECT role FROM user_roles WHERE user_id = ? LIMIT 1',
        [user.id]
      );

      const role = roleRows.length > 0 ? roleRows[0].role : 'student';

      // If user is teacher, get teacher info
      let teacherInfo = null;
      if (role === 'teacher') {
        const [teacherRows] = await pool.execute(
          'SELECT id, employee_id FROM teachers WHERE user_id = ?',
          [user.id]
        );

        if (teacherRows.length > 0) {
          const [profileRows] = await pool.execute(
            'SELECT name, email FROM profiles WHERE id = ?',
            [user.id]
          );

          if (profileRows.length > 0) {
            teacherInfo = {
              id: teacherRows[0].id,
              name: profileRows[0].name,
              email: profileRows[0].email,
              employeeId: teacherRows[0].employee_id
            };
          }
        }
      }

      // Generate JWT
      const token = generateJWT(user.id, user.email, role);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          role,
          mustChangePassword: !user.password_changed_at,
          teacherInfo // Include teacher info if applicable
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });
}

// Change password endpoint
function setupChangePasswordEndpoint(app, pool) {
  app.post('/api/auth/change-password', verifyJWT, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      // Get user from JWT token
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!newPassword) {
        return res.status(400).json({ error: 'New password is required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      // Get user info including must_change_password flag
      const [userRows] = await pool.execute(
        'SELECT password_hash, must_change_password FROM users WHERE id = ? LIMIT 1',
        [userId]
      );

      if (userRows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = userRows[0];

      // If user must change password (first-time login), allow without current password
      if (user.must_change_password) {
        console.log('Allowing first-time password change without current password');
      } else {
        // For regular password changes, verify current password
        if (!currentPassword) {
          return res.status(400).json({ error: 'Current password is required' });
        }

        const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
        if (!passwordMatch) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update password and clear must_change_password flag
      await pool.execute(
        'UPDATE users SET password_hash = ?, password_changed_at = NOW(), must_change_password = 0 WHERE id = ?',
        [newPasswordHash, userId]
      );

      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  });
}

// Create student with temp password endpoint
function setupCreateStudentEndpoint(app, pool) {
  app.post('/api/teacher/create-student', async (req, res) => {
    try {
      const { name, email, department, rollNumber, semester } = req.body;

      if (!name || !email) {
        return res.status(400).json({ error: 'Name and email are required' });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if user already exists
      const [existingUsers] = await pool.execute(
        'SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1',
        [normalizedEmail]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({ error: 'Student with this email already exists' });
      }

      // Generate temporary password
      const tempPassword = generateTempPassword();
      const hashedPassword = await bcrypt.hash(tempPassword, 10);

      const userId = uuidv4();

      // Create user with temporary password
      await pool.execute(
        'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, NOW())',
        [userId, normalizedEmail, hashedPassword]
      );

      // Create profile
      await dbPool.execute(
        'INSERT INTO profiles (id, name, email, department) VALUES (?, ?, ?, ?)',
        [userId, name, normalizedEmail, department || 'General']
      );

      // Create student role
      await pool.execute(
        'INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)',
        [uuidv4(), userId, 'student']
      );

      // Create student record
      const studentId = uuidv4();
      const finalRollNumber = rollNumber || `AUTO${Date.now().toString().slice(-6)}`;

      await pool.execute(
        'INSERT INTO students (id, user_id, roll_number, semester) VALUES (?, ?, ?, ?)',
        [studentId, userId, finalRollNumber, semester || 1]
      );

      res.json({
        success: true,
        student: {
          id: studentId,
          name,
          email: normalizedEmail,
          rollNumber: finalRollNumber,
          temporaryPassword: tempPassword
        },
        message: 'Student created successfully. Share the temporary password with the student.'
      });
    } catch (error) {
      console.error('Create student error:', error);
      res.status(500).json({ error: 'Failed to create student' });
    }
  });
}

// JWT verification middleware
function verifyJWT(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = {
  setupLoginEndpoint,
  setupChangePasswordEndpoint,
  setupCreateStudentEndpoint,
  verifyJWT,
  generateTempPassword
};

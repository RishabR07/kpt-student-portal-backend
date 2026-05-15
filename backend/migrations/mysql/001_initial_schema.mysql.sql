-- ============================================================================
-- KPT Student Portal - MySQL Initial Schema (Hostinger)
-- ============================================================================
-- Notes:
-- - This is a MySQL/MariaDB-friendly translation of `backend/migrations/001_initial_schema.sql`.
-- - Supabase-specific features (auth.users references, RLS) are removed/replaced.
-- - IDs are stored as CHAR(36) UUID strings. Generate UUIDs in your backend/app layer.
--   (You can switch to BINARY(16) later for performance if needed.)
--
-- Recommended engine/charset:
--   ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 0. USERS TABLE (Replaces Supabase auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 1. PROFILES TABLE (User Profile Data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  department VARCHAR(255),
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_profiles_email (email),
  CONSTRAINT fk_profiles_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. USER ROLES TABLE (Role Assignment)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  role VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_roles_user_id (user_id),
  CONSTRAINT chk_user_roles_role CHECK (role IN ('admin', 'teacher', 'student')),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. STUDENTS TABLE (Student-Specific Info)
-- ============================================================================
CREATE TABLE IF NOT EXISTS students (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  roll_number VARCHAR(50) NOT NULL,
  semester INT,
  enrollment_year INT,
  gpa DECIMAL(3, 2),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_students_user_id (user_id),
  UNIQUE KEY uq_students_roll_number (roll_number),
  CONSTRAINT chk_students_semester CHECK (semester IS NULL OR (semester >= 1 AND semester <= 8)),
  CONSTRAINT chk_students_status CHECK (status IN ('active', 'inactive', 'suspended')),
  CONSTRAINT fk_students_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. TEACHERS TABLE (Teacher-Specific Info)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teachers (
  id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  employee_id VARCHAR(50) NOT NULL,
  qualification VARCHAR(255),
  specialization VARCHAR(255),
  office_location VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_teachers_user_id (user_id),
  UNIQUE KEY uq_teachers_employee_id (employee_id),
  CONSTRAINT chk_teachers_status CHECK (status IN ('active', 'inactive', 'on_leave')),
  CONSTRAINT fk_teachers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. SUBJECTS TABLE (Course Information)
-- ============================================================================
CREATE TABLE IF NOT EXISTS subjects (
  id CHAR(36) NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  credits INT,
  semester INT,
  teacher_id CHAR(36),
  max_students INT DEFAULT 60,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subjects_code (code),
  KEY idx_subjects_teacher_id (teacher_id),
  CONSTRAINT chk_subjects_credits CHECK (credits IS NULL OR credits > 0),
  CONSTRAINT chk_subjects_semester CHECK (semester IS NULL OR (semester >= 1 AND semester <= 8)),
  CONSTRAINT fk_subjects_teacher FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. ENROLLMENTS TABLE (Subject-Student Mapping)
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrollments (
  id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  subject_id CHAR(36) NOT NULL,
  enrollment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'enrolled',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_enrollments_student_subject (student_id, subject_id),
  KEY idx_enrollments_student_id (student_id),
  KEY idx_enrollments_subject_id (subject_id),
  CONSTRAINT chk_enrollments_status CHECK (status IN ('enrolled', 'dropped', 'completed')),
  CONSTRAINT fk_enrollments_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_enrollments_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. ATTENDANCE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance (
  id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  subject_id CHAR(36) NOT NULL,
  attendance_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  remarks TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_student_subject_date (student_id, subject_id, attendance_date),
  KEY idx_attendance_student_id (student_id),
  KEY idx_attendance_subject_id (subject_id),
  KEY idx_attendance_date (attendance_date),
  CONSTRAINT chk_attendance_status CHECK (status IN ('present', 'absent', 'leave')),
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. MARKS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS marks (
  id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  subject_id CHAR(36) NOT NULL,
  exam_type VARCHAR(30) NOT NULL,
  marks_obtained DECIMAL(5, 2) NOT NULL,
  total_marks DECIMAL(5, 2) NOT NULL DEFAULT 100,
  percentage DECIMAL(5, 2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_marks_student_subject_exam (student_id, subject_id, exam_type),
  KEY idx_marks_student_id (student_id),
  KEY idx_marks_subject_id (subject_id),
  CONSTRAINT chk_marks_exam_type CHECK (exam_type IN ('internals', 'midterm', 'assignment', 'final')),
  CONSTRAINT fk_marks_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_marks_subject FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. EVENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS events (
  id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(20),
  event_date DATETIME NOT NULL,
  location VARCHAR(255),
  organizer_id CHAR(36),
  capacity INT,
  enrolled_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'upcoming',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_events_event_date (event_date),
  CONSTRAINT chk_events_event_type CHECK (event_type IS NULL OR event_type IN ('academic', 'workshop', 'sports', 'cultural', 'other')),
  CONSTRAINT chk_events_status CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  CONSTRAINT fk_events_organizer FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. EVENT ENROLLMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS event_enrollments (
  id CHAR(36) NOT NULL,
  event_id CHAR(36) NOT NULL,
  student_id CHAR(36) NOT NULL,
  enrollment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'enrolled',
  PRIMARY KEY (id),
  UNIQUE KEY uq_event_enrollments_event_student (event_id, student_id),
  KEY idx_event_enrollments_event_id (event_id),
  KEY idx_event_enrollments_student_id (student_id),
  CONSTRAINT chk_event_enrollments_status CHECK (status IN ('enrolled', 'attended', 'dropped')),
  CONSTRAINT fk_event_enrollments_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT fk_event_enrollments_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. ANNOUNCEMENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS announcements (
  id CHAR(36) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  announced_by CHAR(36) NOT NULL,
  target_role VARCHAR(20),
  priority VARCHAR(20) DEFAULT 'normal',
  published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_announcements_target_role (target_role),
  KEY idx_announcements_published_at (published_at),
  CONSTRAINT chk_announcements_target_role CHECK (target_role IS NULL OR target_role IN ('admin', 'teacher', 'student', 'all')),
  CONSTRAINT chk_announcements_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT fk_announcements_user FOREIGN KEY (announced_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 12. ANNOUNCEMENT READS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS announcement_reads (
  id CHAR(36) NOT NULL,
  announcement_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  read_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_announcement_reads_announcement_user (announcement_id, user_id),
  KEY idx_announcement_reads_user_id (user_id),
  CONSTRAINT fk_announcement_reads_announcement FOREIGN KEY (announcement_id) REFERENCES announcements(id) ON DELETE CASCADE,
  CONSTRAINT fk_announcement_reads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

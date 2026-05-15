-- ============================================================================
-- KPT Student Portal - Insert Test Users (Profiles & Roles)
-- ============================================================================
-- IMPORTANT: Before running this, create auth users in Supabase dashboard
-- and replace the UUID values below

-- Step 1: Get the UUIDs
-- Go to: Supabase Dashboard → Authentication → Users
-- Create these 3 users:
--   - admin@kpt.edu / admin123
--   - teacher@kpt.edu / teacher123  
--   - student@kpt.edu / student123
-- Note down their UUIDs

-- Step 2: Replace UUIDs in this script
-- Step 3: Run this entire script in SQL Editor

-- ============================================================================
-- ADMIN USER
-- ============================================================================
-- Replace: ADMIN_UUID_HERE with actual admin UUID
-- Insert profile for the auth user with email admin@kpt.edu
INSERT INTO profiles (id, name, email, department)
SELECT id, 'Admin User', 'admin@kpt.edu', 'Administration'
FROM auth.users
WHERE email = 'admin@kpt.edu'
ON CONFLICT (id) DO NOTHING;

-- Insert role for that user (lookup user id by email)
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'admin@kpt.edu'
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- TEACHER USER
-- ============================================================================
-- Replace: TEACHER_UUID_HERE with actual teacher UUID
-- Insert profile for the auth user with email teacher@kpt.edu
INSERT INTO profiles (id, name, email, department)
SELECT id, 'Dr. John Doe', 'teacher@kpt.edu', 'Computer Science'
FROM auth.users
WHERE email = 'teacher@kpt.edu'
ON CONFLICT (id) DO NOTHING;

-- Insert role for that user
INSERT INTO user_roles (user_id, role)
SELECT id, 'teacher' FROM auth.users WHERE email = 'teacher@kpt.edu'
ON CONFLICT (user_id) DO NOTHING;

-- Insert teacher record (lookup user id)
INSERT INTO teachers (user_id, employee_id, qualification, specialization, office_location)
SELECT id, 'EMP001', 'M.Tech', 'Web Development', 'Block A, Room 201'
FROM auth.users
WHERE email = 'teacher@kpt.edu'
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- STUDENT USER
-- ============================================================================
-- Replace: STUDENT_UUID_HERE with actual student UUID
-- Insert profile for the auth user with email student@kpt.edu
INSERT INTO profiles (id, name, email, department)
SELECT id, 'Alice Johnson', 'student@kpt.edu', 'Computer Science'
FROM auth.users
WHERE email = 'student@kpt.edu'
ON CONFLICT (id) DO NOTHING;

-- Insert role for that user
INSERT INTO user_roles (user_id, role)
SELECT id, 'student' FROM auth.users WHERE email = 'student@kpt.edu'
ON CONFLICT (user_id) DO NOTHING;

-- Insert student record (lookup user id)
INSERT INTO students (user_id, roll_number, semester, enrollment_year, status)
SELECT id, 'CS2024001', 3, 2024, 'active' FROM auth.users WHERE email = 'student@kpt.edu'
ON CONFLICT (user_id) DO NOTHING;

COMMIT;

-- ============================================================================
-- KPT Student Portal - Sample Data / Seed Script
-- ============================================================================
-- This script creates sample data for testing
-- Run this AFTER all migrations and RLS policies are in place
-- Note: Uncomment and modify as needed

-- ============================================================================
-- IMPORTANT: First create users in Supabase Auth manually
-- ============================================================================
-- 1. Go to Supabase Dashboard → Authentication → Users
-- 2. Create test users:
--    - Admin: admin@kpt.edu / admin123
--    - Teacher: teacher@kpt.edu / teacher123
--    - Student: student@kpt.edu / student123
-- 
-- 3. Note down their UUIDs after creation
-- 4. Replace the UUID values below with your actual UUIDs

-- ============================================================================
-- SAMPLE DATA (Replace UUIDs with your actual ones from Auth)
-- ============================================================================

-- Admin User (get this from Supabase Auth > Users)
-- UPDATE: Replace 'admin-uuid-here' with actual UUID
-- INSERT INTO profiles (id, name, email, department)
-- VALUES ('admin-uuid-here', 'Admin User', 'admin@kpt.edu', 'Administration')
-- ON CONFLICT (id) DO NOTHING;

-- INSERT INTO user_roles (user_id, role)
-- VALUES ('admin-uuid-here', 'admin')
-- ON CONFLICT (user_id) DO NOTHING;

-- Teacher User
-- UPDATE: Replace 'teacher-uuid-here' with actual UUID
-- INSERT INTO profiles (id, name, email, department)
-- VALUES ('teacher-uuid-here', 'Dr. John Doe', 'teacher@kpt.edu', 'Computer Science')
-- ON CONFLICT (id) DO NOTHING;

-- INSERT INTO user_roles (user_id, role)
-- VALUES ('teacher-uuid-here', 'teacher')
-- ON CONFLICT (user_id) DO NOTHING;

-- INSERT INTO teachers (user_id, employee_id, qualification, specialization, office_location)
-- VALUES ('teacher-uuid-here', 'EMP001', 'M.Tech', 'Web Development', 'Block A, Room 201')
-- ON CONFLICT (user_id) DO NOTHING;

-- Student User
-- UPDATE: Replace 'student-uuid-here' with actual UUID
-- INSERT INTO profiles (id, name, email, department)
-- VALUES ('student-uuid-here', 'Alice Johnson', 'student@kpt.edu', 'Computer Science')
-- ON CONFLICT (id) DO NOTHING;

-- INSERT INTO user_roles (user_id, role)
-- VALUES ('student-uuid-here', 'student')
-- ON CONFLICT (user_id) DO NOTHING;

-- INSERT INTO students (user_id, roll_number, semester, enrollment_year, status)
-- VALUES ('student-uuid-here', 'CS2024001', 3, 2024, 'active')
-- ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- SAMPLE SUBJECTS
-- ============================================================================
-- INSERT INTO subjects (code, name, description, credits, semester, max_students)
-- VALUES 
--     ('CS201', 'Web Development', 'Learn modern web technologies', 4, 3, 60),
--     ('CS202', 'Database Management', 'SQL and NoSQL databases', 4, 3, 60),
--     ('CS203', 'Data Structures', 'Advanced DSA concepts', 4, 3, 60)
-- ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- SAMPLE EVENTS
-- ============================================================================
-- INSERT INTO events (title, description, event_type, event_date, location, capacity, status)
-- VALUES 
--     (
--         'Tech Workshop',
--         'Learn about latest web technologies',
--         'workshop',
--         NOW() + INTERVAL '7 days',
--         'Auditorium',
--         100,
--         'upcoming'
--     ),
--     (
--         'Sports Day',
--         'Annual sports event',
--         'sports',
--         NOW() + INTERVAL '14 days',
--         'Sports Complex',
--         500,
--         'upcoming'
--     );

-- ============================================================================
-- SAMPLE ANNOUNCEMENTS
-- ============================================================================
-- INSERT INTO announcements (title, content, announced_by, target_role, priority)
-- VALUES 
--     (
--         'Semester Exam Schedule Released',
--         'The schedule for mid-semester exams has been released. Check the portal for details.',
--         'admin-uuid-here',
--         'all',
--         'high'
--     ),
--     (
--         'Lab Maintenance',
--         'Computer labs will be closed on Saturday for maintenance.',
--         'admin-uuid-here',
--         'all',
--         'normal'
--     );

-- ============================================================================
-- INSTRUCTIONS TO USE THIS FILE
-- ============================================================================
-- 1. Create test users in Supabase Auth first (see instructions above)
-- 2. Copy their UUIDs
-- 3. Replace the placeholder UUIDs in this file
-- 4. Uncomment the INSERT statements
-- 5. Run this script in Supabase SQL Editor

COMMIT;

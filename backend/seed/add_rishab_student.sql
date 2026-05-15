-- Add Rishab student for testing bulk enrollment
-- First create the user in Supabase Auth, then run this with their UUID

-- Replace 'rishab-uuid-here' with the actual UUID from Auth users table
INSERT INTO profiles (id, name, email, department)
VALUES ('rishab-uuid-here', 'Rishab', 'rishab@gmail.com', 'Computer Science')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES ('rishab-uuid-here', 'student')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO students (user_id, roll_number, semester, enrollment_year, status)
VALUES ('rishab-uuid-here', 'CS2024002', 5, 2024, 'active')
ON CONFLICT (user_id) DO NOTHING;

-- Also make sure the subject exists
INSERT INTO subjects (code, name, description, credits, semester, max_students)
VALUES ('20CS502', 'Database Management System', 'Database Management Systems Course', 4, 5, 60)
ON CONFLICT (code) DO NOTHING;

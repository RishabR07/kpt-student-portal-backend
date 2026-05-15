-- Add test students for bulk enrollment testing
-- First create these users in Supabase Auth, then run this with their UUIDs

-- Replace the UUIDs below with actual UUIDs from Auth users table
INSERT INTO profiles (id, name, email, department)
VALUES 
    ('student1-uuid-here', 'Test Student 1', 'student1@example.com', 'Computer Science'),
    ('student2-uuid-here', 'Test Student 2', 'student2@example.com', 'Computer Science'),
    ('student3-uuid-here', 'Test Student 3', 'student3@example.com', 'Computer Science')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES 
    ('student1-uuid-here', 'student'),
    ('student2-uuid-here', 'student'),
    ('student3-uuid-here', 'student')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO students (user_id, roll_number, semester, enrollment_year, status)
VALUES 
    ('student1-uuid-here', 'CS2024003', 5, 2024, 'active'),
    ('student2-uuid-here', 'CS2024004', 5, 2024, 'active'),
    ('student3-uuid-here', 'CS2024005', 5, 2024, 'active')
ON CONFLICT (user_id) DO NOTHING;

-- Make sure the subject exists and is assigned to a teacher
INSERT INTO subjects (code, name, description, credits, semester, max_students)
VALUES ('20CS502', 'Database Management System', 'Database Management Systems Course', 4, 5, 60)
ON CONFLICT (code) DO NOTHING;

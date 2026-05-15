-- Ensure the subject exists and is assigned to current teacher
-- This script makes sure 20CS502 exists for bulk enrollment

INSERT INTO subjects (code, name, description, credits, semester, max_students)
VALUES ('20CS502', 'Database Management System', 'Database Management Systems Course', 4, 5, 60)
ON CONFLICT (code) DO NOTHING;

-- If you have a teacher, assign them to this subject
-- UPDATE subjects SET teacher_id = 'teacher-uuid-here' WHERE code = '20CS502';

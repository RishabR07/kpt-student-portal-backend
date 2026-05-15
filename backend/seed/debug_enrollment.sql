-- Debug script to check enrollment issues

-- 1. Check if subject exists
SELECT * FROM subjects WHERE code = '20CS502';

-- 2. Check current teacher
SELECT 
    t.id as teacher_id,
    t.employee_id,
    p.name,
    p.email
FROM teachers t
JOIN profiles p ON t.user_id = p.id
WHERE t.user_id = auth.uid();

-- 3. Check if teacher owns the subject
SELECT 
    s.*,
    p.name as teacher_name,
    p.email as teacher_email
FROM subjects s
LEFT JOIN teachers t ON s.teacher_id = t.id
LEFT JOIN profiles p ON t.user_id = p.id
WHERE s.code = '20CS502';

-- 4. Assign subject to current teacher (if needed)
-- UPDATE subjects 
-- SET teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
-- WHERE code = '20CS502';

-- 5. Check RLS policies on subjects
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'subjects';

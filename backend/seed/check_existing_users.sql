-- Check what users exist in your database
SELECT 
    p.id,
    p.name,
    p.email,
    ur.role,
    s.roll_number
FROM profiles p
LEFT JOIN user_roles ur ON p.id = ur.user_id
LEFT JOIN students s ON p.id = s.user_id
ORDER BY p.email;

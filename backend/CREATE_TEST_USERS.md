# Creating Test Users - Step by Step

## Part 1: Create Auth Users in Supabase Dashboard

1. Go to **[Your Supabase Dashboard](https://app.supabase.com)**
2. Select project: **mufpdrysxrmbdexlrsjf**
3. Go to **Authentication** → **Users**
4. Click **Add user**

### User 1: Admin

- **Email:** admin@kpt.edu
- **Password:** admin123
- Click **Create user**
- **Copy the UUID** (appears in the list after creation)

### User 2: Teacher

- **Email:** teacher@kpt.edu
- **Password:** teacher123
- Click **Create user**
- **Copy the UUID**

### User 3: Student

- **Email:** student@kpt.edu
- **Password:** student123
- Click **Create user**
- **Copy the UUID**

---

## Part 2: Insert Profiles and Roles

1. Go to **SQL Editor** → **New Query**
2. Replace the UUIDs below with your actual UUIDs from Part 1
3. Copy and paste the SQL below
4. Click **Run**

```sql
-- ============================================================================
-- INSERT ADMIN USER
-- ============================================================================
-- Replace 'ADMIN_UUID_HERE' with the actual admin UUID
INSERT INTO profiles (id, name, email, department)
VALUES ('ADMIN_UUID_HERE', 'Admin User', 'admin@kpt.edu', 'Administration')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES ('ADMIN_UUID_HERE', 'admin')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- INSERT TEACHER USER
-- ============================================================================
-- Replace 'TEACHER_UUID_HERE' with the actual teacher UUID
INSERT INTO profiles (id, name, email, department)
VALUES ('TEACHER_UUID_HERE', 'Dr. John Doe', 'teacher@kpt.edu', 'Computer Science')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES ('TEACHER_UUID_HERE', 'teacher')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO teachers (user_id, employee_id, qualification, specialization, office_location)
VALUES ('TEACHER_UUID_HERE', 'EMP001', 'M.Tech', 'Web Development', 'Block A, Room 201')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- INSERT STUDENT USER
-- ============================================================================
-- Replace 'STUDENT_UUID_HERE' with the actual student UUID
INSERT INTO profiles (id, name, email, department)
VALUES ('STUDENT_UUID_HERE', 'Alice Johnson', 'student@kpt.edu', 'Computer Science')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES ('STUDENT_UUID_HERE', 'student')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO students (user_id, roll_number, semester, enrollment_year, status)
VALUES ('STUDENT_UUID_HERE', 'CS2024001', 3, 2024, 'active')
ON CONFLICT (user_id) DO NOTHING;
```

---

## Part 3: Verify & Test

1. Check **Table Editor** → **profiles** - Should see 3 profiles
2. Check **Table Editor** → **user_roles** - Should see 3 roles
3. Check **Table Editor** → **students** - Should see 1 student
4. Go back to your React app
5. Try signing in with: `admin@kpt.edu` / `admin123`

---

## Next Steps After Testing

Once login works:
1. Build Admin Dashboard features
2. Build Teacher Dashboard features
3. Build Student Dashboard features
4. Create sample data (subjects, events, etc.)

# KPT Student Portal - Supabase Backend Setup Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step-by-Step Setup](#step-by-step-setup)
3. [Database Schema](#database-schema)
4. [Testing the Setup](#testing-the-setup)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Supabase account (free tier is fine)
- Project already created on Supabase
- Access to Supabase Dashboard

---

## Step-by-Step Setup

### Step 1: Access Supabase SQL Editor

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New Query**

### Step 2: Create Database Schema

1. Copy the entire contents of **`backend/migrations/001_initial_schema.sql`**
2. Paste into the SQL Editor
3. Click **Run** (or press `Ctrl+Enter`)
4. Wait for it to complete (should show "✓ Executed successfully")

**What this does:**
- Creates all necessary tables (profiles, students, teachers, subjects, etc.)
- Sets up indexes for performance
- Enables Row Level Security (RLS) on all tables

### Step 3: Set Up Row Level Security (RLS) Policies

1. Create another **New Query**
2. Copy the entire contents of **`backend/migrations/002_rls_policies.sql`**
3. Paste into the SQL Editor
4. Click **Run**
5. Wait for completion

**What this does:**
- Sets up security policies so users only see their own data
- Admins can see everything
- Teachers can see their students' data
- Students can only see their own data

### Step 4: Disable Email Confirmation (For Development)

Since we're in development, let's disable email confirmation:

1. Go to **Authentication** (left sidebar)
2. Click **Providers** → **Email**
3. Toggle **OFF**: "Confirm email"
4. Scroll down and click **Save**

This allows users to sign in immediately after signup without email verification.

### Step 5: Create Test Users

1. Go to **Authentication** → **Users**
2. Click **Add user**
3. Create these test accounts:

   **Admin:**
   - Email: `admin@kpt.edu`
   - Password: `admin123`
   - Click **Create user**

   **Teacher:**
   - Email: `teacher@kpt.edu`
   - Password: `teacher123`
   - Click **Create user**

   **Student:**
   - Email: `student@kpt.edu`
   - Password: `student123`
   - Click **Create user**

4. **Note the UUIDs** of these users (shown in the Users list)

### Step 6: Insert User Profiles and Roles

1. Create another **New Query**
2. Modify `backend/seed/sample_data.sql` by replacing the UUID placeholders with your actual UUIDs
3. Uncomment the INSERT statements
4. Run the query

Example (replace with your UUIDs):
```sql
INSERT INTO profiles (id, name, email, department)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Admin User', 'admin@kpt.edu', 'Administration')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'admin')
ON CONFLICT (user_id) DO NOTHING;
```

### Step 7: Insert Sample Data (Optional)

To test the app with sample data:

1. Create another **New Query**
2. Copy and run the sample data queries from `backend/seed/sample_data.sql`
3. Modify the UUIDs to match your test users

---

## Database Schema

### Core Tables

#### 1. **profiles**
- User profile information
- Linked to Supabase Auth users
- Fields: name, email, department, avatar_url, bio

#### 2. **user_roles**
- Maps users to roles (admin, teacher, student)
- One role per user

#### 3. **students**
- Student-specific information
- Fields: roll_number, semester, enrollment_year, gpa, status

#### 4. **teachers**
- Teacher-specific information
- Fields: employee_id, qualification, specialization, office_location

#### 5. **subjects**
- Course information
- Fields: code, name, credits, semester, teacher_id

#### 6. **enrollments**
- Maps students to subjects
- Tracks enrollment status

#### 7. **attendance**
- Student attendance records
- Fields: attendance_date, status (present/absent/leave)
- Linked to both student and subject

#### 8. **marks**
- Student exam marks
- Fields: exam_type, marks_obtained, total_marks, percentage

#### 9. **events**
- Academic/college events
- Fields: title, event_type, event_date, location, capacity

#### 10. **event_enrollments**
- Maps students to events

#### 11. **announcements**
- System-wide announcements
- Fields: title, content, target_role, priority

#### 12. **announcement_reads**
- Tracks which users have read which announcements

---

## Testing the Setup

### Test 1: Verify Tables Created

1. Go to **Table Editor** (left sidebar)
2. You should see all these tables:
   - profiles
   - user_roles
   - students
   - teachers
   - subjects
   - enrollments
   - attendance
   - marks
   - events
   - event_enrollments
   - announcements
   - announcement_reads

### Test 2: Verify RLS Policies

1. Click on any table (e.g., **profiles**)
2. Click **RLS** button at top right
3. You should see multiple policies listed

### Test 3: Test Frontend Login

1. Start your React app: `npm run dev`
2. Go to http://localhost:8080
3. Try signing in with:
   - Email: `admin@kpt.edu`
   - Password: `admin123`
4. Should redirect to `/admin`

---

## Troubleshooting

### "Email not confirmed" Error

**Solution:** Disable email confirmation (see Step 4 above)

### "No profile found" Error

**Cause:** Profile wasn't created in the profiles/user_roles tables

**Solution:** 
1. Go to SQL Editor
2. Run this query with your user's UUID:
```sql
INSERT INTO profiles (id, name, email, department)
VALUES ('YOUR_UUID_HERE', 'Test User', 'test@email.com', 'CS')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role)
VALUES ('YOUR_UUID_HERE', 'student')
ON CONFLICT (user_id) DO NOTHING;
```

### Login Still Not Working

**Debug steps:**
1. Open browser console (F12)
2. Check for error messages
3. Verify RLS policies are enabled
4. Check that profiles table has RLS disabled initially (disable for now):
   ```sql
   ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
   ```

### Rate Limit Errors

**Solution:** Supabase free tier has rate limits. If you get 429 errors:
- Wait 1 hour before trying again
- Create test accounts and reuse them
- Upgrade to a paid plan

---

## Next Steps

After setup is complete:

1. Update frontend authentication to use real Supabase project
2. Test all user roles (admin, teacher, student)
3. Create more sample data
4. Build dashboard features
5. Deploy to production

---

## Environment Variables

Update `.env` in your React project with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Find these in Supabase:
- Go to **Settings** → **API**
- Copy Project URL and anon key

---

## Support

If you get stuck, check:
1. Supabase logs (Project → Logs)
2. Browser console (F12)
3. Network tab for API errors
4. Verify all migration scripts ran successfully

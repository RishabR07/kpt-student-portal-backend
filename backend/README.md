# Backend Setup - Supabase

This folder contains all backend configuration and SQL migrations for the KPT Student Portal.

## Directory Structure

```
backend/
├── migrations/          # Database schema and migrations
│   ├── 001_initial_schema.sql      # Creates all tables
│   └── 002_rls_policies.sql        # Sets up Row Level Security
├── seed/               # Sample data
│   └── sample_data.sql             # Test accounts and sample data
├── policies/           # Security policy documentation
└── SETUP_GUIDE.md      # Complete setup instructions
```

## Quick Start

### Prerequisites
- Supabase project created
- Access to Supabase dashboard

### Setup Steps

1. **Read the full setup guide:**
   ```
   open backend/SETUP_GUIDE.md
   ```

2. **Follow these steps in order:**
   - Step 1: Access SQL Editor
   - Step 2: Run `migrations/001_initial_schema.sql`
   - Step 3: Run `migrations/002_rls_policies.sql`
   - Step 4: Disable email confirmation (for development)
   - Step 5: Create test users
   - Step 6: Insert user profiles and roles
   - Step 7: (Optional) Insert sample data

3. **When done, test the frontend:**
   ```bash
   npm run dev
   # Try logging in with admin@kpt.edu / admin123
   ```

## Database Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| profiles | User profile data | name, email, department |
| user_roles | Role assignment | user_id, role (admin/teacher/student) |
| students | Student information | roll_number, semester, gpa |
| teachers | Teacher information | employee_id, qualification |
| subjects | Courses | code, name, credits, semester |
| enrollments | Student-subject mapping | student_id, subject_id |
| attendance | Attendance records | attendance_date, status |
| marks | Student exam marks | exam_type, marks_obtained |
| events | College events | event_type, event_date |
| event_enrollments | Student-event mapping | student_id, event_id |
| announcements | System announcements | title, target_role, priority |
| announcement_reads | Announcement read tracking | user_id, announcement_id |

## Test Users (After Setup)

- **Admin:** admin@kpt.edu / admin123
- **Teacher:** teacher@kpt.edu / teacher123
- **Student:** student@kpt.edu / student123

## Important SQL Files

| File | Purpose | Run When |
|------|---------|----------|
| `001_initial_schema.sql` | Create all tables and indexes | First |
| `002_rls_policies.sql` | Setup Row Level Security | Second |
| `sample_data.sql` | Create test data | Third (optional) |

## Troubleshooting

### Tables not appearing?
- Check Supabase SQL logs for errors
- Verify migrations ran completely

### Can't sign in?
- Disable email confirmation in Authentication → Email
- Check that profiles/user_roles were created

### Permission denied errors?
- RLS policies may be blocking access
- Verify policy names and conditions

## Next Steps

1. ✅ Complete the setup using SETUP_GUIDE.md
2. Verify all tables exist in Table Editor
3. Create and test user accounts
4. Test frontend login functionality
5. Begin building dashboard features

---

For detailed instructions, see [SETUP_GUIDE.md](SETUP_GUIDE.md)
"# kpt-student-portal-backend" 

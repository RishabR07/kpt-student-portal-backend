# Bulk User Import Feature

## Overview
The admin dashboard now includes a **Bulk Import** feature that allows administrators to import multiple users at once using a CSV file. This is perfect for setting up the system with initial user data.

## How to Use

### Step 1: Navigate to User Management
1. Go to **Admin Dashboard**
2. Click on **Users** in the navigation menu
3. Click the **Bulk Import** button

### Step 2: Prepare Your CSV File

#### CSV Format
Your CSV file must include the following columns in order:
- **name** (required): Full name of the user
- **email** (required): Email address (must be unique)
- **role** (required): One of `admin`, `teacher`, or `student`
- **password** (required): Initial password for the user
- **department** (optional): Department name
- **rollNumber** (optional): Student roll number (for students only)
- **employeeId** (optional): Employee ID (for teachers only)

#### Example CSV Format
```csv
name,email,role,password,department,rollNumber,employeeId
John Doe,john.doe@kpt.edu,student,Pass123!,Computer Science,CS2024001,
Jane Smith,jane.smith@kpt.edu,teacher,Pass123!,Computer Science,,EMP001
Admin User,admin@kpt.edu,admin,Pass123!,Administration,,
```

### Step 3: Upload the File
1. Click **"Select File"** or drag and drop your CSV file
2. Review the preview to ensure data is correct
3. Click **"Import [N] Users"** to start the import

### Step 4: Monitor the Results
- The system will show a progress indicator while importing
- After completion, you'll see:
  - ✅ Number of successfully imported users
  - ❌ Number of failed imports (if any)
  - Detailed error messages for failed rows

## CSV Format Guidelines

### Column Details
| Column | Type | Required | Notes |
|--------|------|----------|-------|
| name | string | ✅ | Full name of the user |
| email | string | ✅ | Valid email format required |
| role | string | ✅ | `admin`, `teacher`, or `student` |
| password | string | ✅ | Minimum 6 characters |
| department | string | ❌ | Department name |
| rollNumber | string | ❌ | Student ID (for students) |
| employeeId | string | ❌ | Employee ID (for teachers) |

### Validation Rules
- **Name**: Cannot be empty
- **Email**: Must be valid email format and unique
- **Role**: Must be exactly one of: `admin`, `teacher`, `student`
- **Password**: Minimum 6 characters recommended
- **Rules by Role**:
  - **Student**: Should include `rollNumber`
  - **Teacher**: Should include `employeeId`
  - **Admin**: Department optional

## Sample Files

### Download Template
Click the **"Download Sample Template"** button in the import dialog to get a pre-formatted CSV file.

### Template Location
A sample template is available at: `backend/CSV_TEMPLATE.csv`

## What Happens During Import

For each user, the system will:
1. **Create Auth User**: Register the user in Supabase Auth
2. **Create Profile**: Store user information (name, email, department)
3. **Assign Role**: Link the user to their role (admin/teacher/student)
4. **Create Role-Specific Record**:
   - For **Students**: Creates a student record with roll number
   - For **Teachers**: Creates a teacher record with employee ID
   - For **Admins**: No additional records

## Error Handling

### Common Errors
| Error | Reason | Solution |
|-------|--------|----------|
| Invalid email format | Email doesn't match pattern | Format: `user@domain.com` |
| Invalid role | Role is not admin/teacher/student | Check spelling (lowercase) |
| Email already exists | User already registered | Use unique email addresses |
| Missing required fields | Missing name, email, role, or password | Ensure all 4 fields are filled |

### Partial Import Success
If some users fail but others succeed:
- ✅ Successful users are created and stored
- ❌ Failed users are reported with specific error messages
- You can retry failed users by correcting the CSV and re-uploading

## Verification

### Check if Users Were Created
1. Go to **Supabase Dashboard** → **Table Editor**
2. Check these tables:
   - `profiles` - User information
   - `user_roles` - Role assignments
   - `students` - Student records (if applicable)
   - `teachers` - Teacher records (if applicable)

3. Or in the app:
   - Users should be able to log in with their imported credentials
   - **Admin > User Management** should display all imported users

## Tips & Best Practices

1. **Test First**: Upload a small CSV with 2-3 users to test before bulk importing
2. **Backup Passwords**: Keep the CSV file secure as it contains initial passwords
3. **Email Format**: Use lowercase email addresses for consistency
4. **Unique Emails**: Ensure no duplicate emails in the CSV
5. **Password Security**: Consider using strong passwords or implementing a password change on first login
6. **Role Consistency**: Ensure role names are exactly as specified (case-sensitive)

## Examples

### Example 1: Import Mixed Users
```csv
name,email,role,password,department,rollNumber,employeeId
Alice Johnson,alice@kpt.edu,student,Pass123!,CS,CS2024001,
Bob Smith,bob@kpt.edu,teacher,Pass123!,CS,,EMP001
Charlie Admin,charlie@kpt.edu,admin,Pass123!,Admin,,
David Kumar,david@kpt.edu,student,Pass123!,ECE,ECE2024001,
```

### Example 2: Import Students Only
```csv
name,email,role,password,department,rollNumber,employeeId
Student 1,student1@kpt.edu,student,Pass123!,CS,CS2024001,
Student 2,student2@kpt.edu,student,Pass123!,CS,CS2024002,
Student 3,student3@kpt.edu,student,Pass123!,ECE,ECE2024001,
```

## Troubleshooting

### Import Button Disabled
- Ensure you've selected a valid CSV file
- Check that the CSV has required columns

### Slow Import
- Large imports (500+ users) may take several minutes
- Do not close the browser tab during import

### Users Can't Login After Import
- Verify the email and password are correct
- Check if email confirmation is disabled in Supabase
- Verify user profiles and roles were created in database

## Support

If you encounter issues:
1. Check the detailed error messages in the import results
2. Verify CSV format matches the required columns
3. Refer to the Validation Rules section above

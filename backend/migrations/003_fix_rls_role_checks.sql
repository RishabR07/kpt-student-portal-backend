-- Migration: Fix RLS policies to avoid recursion by using helper functions
-- Run this in Supabase SQL Editor

-- 1) Create helper functions (security definer) to check roles
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_teacher() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'teacher'
  );
$$;

-- 2) Alter policies to use helper functions instead of querying user_roles (prevents recursion)

ALTER POLICY "Admins can view all profiles" ON profiles
  USING (public.is_admin());

ALTER POLICY "Admins can view all roles" ON user_roles
  USING (public.is_admin());

ALTER POLICY "Students can view own data" ON students
  USING (
    user_id = auth.uid() OR public.is_admin() OR public.is_teacher()
  );

ALTER POLICY "Teachers can view students" ON students
  USING (public.is_teacher());

ALTER POLICY "Only admins can update students" ON students
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER POLICY "Teachers can view own data" ON teachers
  USING (user_id = auth.uid() OR public.is_admin());

ALTER POLICY "Teachers can manage subjects" ON subjects
  USING (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())
    OR public.is_admin()
  );

ALTER POLICY "Students can view own enrollments" ON enrollments
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM subjects s
      JOIN teachers t ON s.teacher_id = t.id
      WHERE s.id = enrollments.subject_id
      AND t.user_id = auth.uid()
    )
  );

ALTER POLICY "Students can view own attendance" ON attendance
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR public.is_admin()
  );

ALTER POLICY "Teachers can manage attendance" ON attendance
  USING (
    EXISTS (
      SELECT 1 FROM subjects s
      JOIN teachers t ON s.teacher_id = t.id
      WHERE s.id = attendance.subject_id
      AND t.user_id = auth.uid()
    )
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM subjects s
      JOIN teachers t ON s.teacher_id = t.id
      WHERE s.id = attendance.subject_id
      AND t.user_id = auth.uid()
    )
    OR public.is_admin()
  );

ALTER POLICY "Students can view own marks" ON marks
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR public.is_admin()
  );

ALTER POLICY "Teachers can manage marks" ON marks
  USING (
    EXISTS (
      SELECT 1 FROM subjects s
      JOIN teachers t ON s.teacher_id = t.id
      WHERE s.id = marks.subject_id
      AND t.user_id = auth.uid()
    )
    OR public.is_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM subjects s
      JOIN teachers t ON s.teacher_id = t.id
      WHERE s.id = marks.subject_id
      AND t.user_id = auth.uid()
    )
    OR public.is_admin()
  );

ALTER POLICY "Admins and organizers can manage events" ON events
  USING (
    organizer_id = auth.uid() OR public.is_admin()
  )
  WITH CHECK (
    organizer_id = auth.uid() OR public.is_admin()
  );

ALTER POLICY "Everyone can view event enrollments" ON event_enrollments
  USING (
    student_id = (SELECT id FROM students WHERE user_id = auth.uid())
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_enrollments.event_id
      AND e.organizer_id = auth.uid()
    )
  );

ALTER POLICY "Users can view relevant announcements" ON announcements
  USING (
    target_role = 'all'
    OR target_role = (
      SELECT role FROM user_roles WHERE user_id = auth.uid()
    )
    OR public.is_admin()
  );

ALTER POLICY "Admins can manage announcements" ON announcements
  USING (
    announced_by = auth.uid() OR public.is_admin()
  )
  WITH CHECK (
    announced_by = auth.uid() OR public.is_admin()
  );

COMMIT;

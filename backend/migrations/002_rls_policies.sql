-- ============================================================================
-- KPT Student Portal - Row Level Security (RLS) Policies
-- ============================================================================
-- This migration sets up RLS policies for all tables
-- Run this in Supabase SQL Editor AFTER the initial schema

-- ============================================================================
-- PROFILES TABLE POLICIES
-- ============================================================================

-- Helper functions to check roles without causing policy recursion.
-- These run as SECURITY DEFINER so they can read `user_roles` regardless of RLS.
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


-- Users can view their own profile
CREATE POLICY "Users can view own profile"
    ON profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
    ON profiles
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- ============================================================================
-- USER ROLES TABLE POLICIES
-- ============================================================================

-- Users can view their own role
CREATE POLICY "Users can view own role"
    ON user_roles
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Only admins can view all roles
CREATE POLICY "Admins can view all roles"
    ON user_roles
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- ============================================================================
-- STUDENTS TABLE POLICIES
-- ============================================================================

-- Students can view their own data
CREATE POLICY "Students can view own data"
    ON students
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_admin()
        OR public.is_teacher()
    );

-- Teachers can view student data
CREATE POLICY "Teachers can view students"
    ON students
    FOR SELECT
    TO authenticated
    USING (public.is_teacher());

-- Only admins can update students
CREATE POLICY "Only admins can update students"
    ON students
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================================
-- TEACHERS TABLE POLICIES
-- ============================================================================

-- Teachers can view their own data
CREATE POLICY "Teachers can view own data"
    ON teachers
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.is_admin()
    );

-- Students can view teacher data
CREATE POLICY "Students can view teachers"
    ON teachers
    FOR SELECT
    TO authenticated
    USING (TRUE);

-- ============================================================================
-- SUBJECTS TABLE POLICIES
-- ============================================================================

-- Everyone can view subjects
CREATE POLICY "Everyone can view subjects"
    ON subjects
    FOR SELECT
    TO authenticated
    USING (TRUE);

-- Teachers can insert and update their subjects
CREATE POLICY "Teachers can manage subjects"
    ON subjects
    FOR ALL
    TO authenticated
    USING (
        teacher_id = (
            SELECT id FROM teachers WHERE user_id = auth.uid()
        )
        OR public.is_admin()
    )
    WITH CHECK (
        teacher_id = (
            SELECT id FROM teachers WHERE user_id = auth.uid()
        )
        OR public.is_admin()
    );

-- ============================================================================
-- ENROLLMENTS TABLE POLICIES
-- ============================================================================

-- Students can view their enrollments
CREATE POLICY "Students can view own enrollments"
    ON enrollments
    FOR SELECT
    TO authenticated
    USING (
        student_id = (
            SELECT id FROM students WHERE user_id = auth.uid()
        )
        OR EXISTS (
                SELECT 1 FROM user_roles
                WHERE user_id = auth.uid() AND role = 'admin'
            )
            OR public.is_admin()
            OR EXISTS (
                SELECT 1 FROM subjects s
                JOIN teachers t ON s.teacher_id = t.id
                WHERE s.id = enrollments.subject_id
                AND t.user_id = auth.uid()
            )
    );

-- Teachers can view enrollments in their subjects
CREATE POLICY "Teachers can view enrollments in their subjects"
    ON enrollments
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM subjects s
            JOIN teachers t ON s.teacher_id = t.id
            WHERE s.id = enrollments.subject_id
            AND t.user_id = auth.uid()
        )
    );

-- ============================================================================
-- ATTENDANCE TABLE POLICIES
-- ============================================================================

-- Students can view their attendance
CREATE POLICY "Students can view own attendance"
    ON attendance
    FOR SELECT
    TO authenticated
    USING (
        student_id = (
            SELECT id FROM students WHERE user_id = auth.uid()
        )
        OR public.is_admin()
    );

-- Teachers can manage attendance in their subjects
CREATE POLICY "Teachers can manage attendance"
    ON attendance
    FOR ALL
    TO authenticated
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

-- ============================================================================
-- MARKS TABLE POLICIES
-- ============================================================================

-- Students can view their marks
CREATE POLICY "Students can view own marks"
    ON marks
    FOR SELECT
    TO authenticated
    USING (
        student_id = (
            SELECT id FROM students WHERE user_id = auth.uid()
        )
        OR public.is_admin()
    );

-- Teachers can manage marks in their subjects
CREATE POLICY "Teachers can manage marks"
    ON marks
    FOR ALL
    TO authenticated
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

-- ============================================================================
-- EVENTS TABLE POLICIES
-- ============================================================================

-- Everyone can view public events
CREATE POLICY "Everyone can view events"
    ON events
    FOR SELECT
    TO authenticated
    USING (TRUE);

-- Admins and organizers can manage events
CREATE POLICY "Admins and organizers can manage events"
    ON events
    FOR ALL
    TO authenticated
    USING (
        organizer_id = auth.uid()
        OR public.is_admin()
    )
    WITH CHECK (
        organizer_id = auth.uid()
        OR public.is_admin()
    );

-- ============================================================================
-- EVENT ENROLLMENTS TABLE POLICIES
-- ============================================================================

-- Students can manage their event enrollments
CREATE POLICY "Students can manage own event enrollments"
    ON event_enrollments
    FOR ALL
    TO authenticated
    USING (
        student_id = (
            SELECT id FROM students WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        student_id = (
            SELECT id FROM students WHERE user_id = auth.uid()
        )
    );

-- Everyone can view event enrollments
CREATE POLICY "Everyone can view event enrollments"
    ON event_enrollments
    FOR SELECT
    TO authenticated
    USING (
        student_id = (
            SELECT id FROM students WHERE user_id = auth.uid()
        )
        OR public.is_admin()
        OR EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_enrollments.event_id
            AND e.organizer_id = auth.uid()
        )
    );

-- ============================================================================
-- ANNOUNCEMENTS TABLE POLICIES
-- ============================================================================

-- Everyone can view relevant announcements
CREATE POLICY "Users can view relevant announcements"
    ON announcements
    FOR SELECT
    TO authenticated
    USING (
        target_role = 'all'
        OR target_role = (
            SELECT role FROM user_roles WHERE user_id = auth.uid()
        )
        OR public.is_admin()
    );

-- Admins can manage announcements
CREATE POLICY "Admins can manage announcements"
    ON announcements
    FOR ALL
    TO authenticated
    USING (
        announced_by = auth.uid()
        OR public.is_admin()
    )
    WITH CHECK (
        announced_by = auth.uid()
        OR public.is_admin()
    );

-- ============================================================================
-- ANNOUNCEMENT READS TABLE POLICIES
-- ============================================================================

-- Users can manage their announcement reads
CREATE POLICY "Users can manage own announcement reads"
    ON announcement_reads
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

COMMIT;

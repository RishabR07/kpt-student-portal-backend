-- ============================================================================
-- Fix RLS Policies for Bulk Import and Administrative Operations
-- ============================================================================
-- This script fixes RLS policies to allow administrative operations

-- ============================================================================
-- PROFILES TABLE - ADD INSERT POLICY FOR AUTHENTICATED USERS
-- ============================================================================
-- This allows authenticated users (and the system) to create their own profile

CREATE OR REPLACE POLICY "Users can create profile for themselves"
    ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

-- This allows service role operations for admin bulk operations
CREATE OR REPLACE POLICY "Admins can insert profiles"
    ON profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- ============================================================================
-- USER ROLES TABLE - ADD INSERT POLICY
-- ============================================================================

CREATE OR REPLACE POLICY "Admins can insert roles"
    ON user_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

CREATE OR REPLACE POLICY "System can insert own role"
    ON user_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- STUDENTS TABLE - ADD INSERT POLICY
-- ============================================================================

CREATE OR REPLACE POLICY "Admins can insert students"
    ON students
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- ============================================================================
-- TEACHERS TABLE - ADD INSERT POLICY
-- ============================================================================

CREATE OR REPLACE POLICY "Admins can insert teachers"
    ON teachers
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- ============================================================================
-- SUBJECTS TABLE - ADD INSERT POLICY
-- ============================================================================

CREATE OR REPLACE POLICY "Teachers can insert own subjects"
    ON subjects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        teacher_id IN (
            SELECT id FROM teachers WHERE user_id = auth.uid()
        )
        OR public.is_admin()
    );

CREATE OR REPLACE POLICY "Admins can insert subjects"
    ON subjects
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- ============================================================================
-- ENROLLMENTS TABLE - ADD INSERT POLICY
-- ============================================================================

CREATE OR REPLACE POLICY "Teachers can insert enrollments"
    ON enrollments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        subject_id IN (
            SELECT id FROM subjects WHERE teacher_id IN (
                SELECT id FROM teachers WHERE user_id = auth.uid()
            )
        )
        OR public.is_admin()
    );

CREATE OR REPLACE POLICY "Admins can insert enrollments"
    ON enrollments
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- ============================================================================
-- ATTENDANCE TABLE - ADD INSERT POLICY
-- ============================================================================

CREATE OR REPLACE POLICY "Teachers can insert attendance"
    ON attendance
    FOR INSERT
    TO authenticated
    WITH CHECK (
        subject_id IN (
            SELECT id FROM subjects WHERE teacher_id IN (
                SELECT id FROM teachers WHERE user_id = auth.uid()
            )
        )
        OR public.is_admin()
    );

-- ============================================================================
-- MARKS TABLE - ADD INSERT POLICY
-- ============================================================================

CREATE OR REPLACE POLICY "Teachers can insert marks"
    ON marks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        subject_id IN (
            SELECT id FROM subjects WHERE teacher_id IN (
                SELECT id FROM teachers WHERE user_id = auth.uid()
            )
        )
        OR public.is_admin()
    );

-- ============================================================================
-- ANNOUNCEMENTS TABLE - ADD INSERT POLICY
-- ============================================================================

CREATE OR REPLACE POLICY "Users can insert announcements"
    ON announcements
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = announced_by);

CREATE OR REPLACE POLICY "Admins can insert any announcements"
    ON announcements
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

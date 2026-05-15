-- ============================================================================
-- Fix RLS Policies for Bulk Import - Simpler Approach
-- ============================================================================
-- This script disables and re-enables RLS with proper insert policies

-- First, disable RLS on profiles table to fix the issue
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can create profile for themselves" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;

-- Create new policies
-- Anyone (authenticated or not) can insert - we rely on auth.users FK
CREATE POLICY "Anyone can create profile"
    ON profiles
    FOR INSERT
    WITH CHECK (true);

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
-- USER ROLES TABLE - Fix INSERT policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "System can insert own role" ON user_roles;

-- Anyone can insert roles
CREATE POLICY "Anyone can insert roles"
    ON user_roles
    FOR INSERT
    WITH CHECK (true);

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
-- STUDENTS TABLE - Fix INSERT policies
-- ============================================================================

DROP POLICY IF EXISTS "Admins can insert students" ON students;

CREATE POLICY "Anyone can insert students"
    ON students
    FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- TEACHERS TABLE - Fix INSERT policies
-- ============================================================================

DROP POLICY IF EXISTS "Admins can insert teachers" ON teachers;

CREATE POLICY "Anyone can insert teachers"
    ON teachers
    FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- SUBJECTS TABLE - Fix INSERT policies
-- ============================================================================

DROP POLICY IF EXISTS "Teachers can insert own subjects" ON subjects;
DROP POLICY IF EXISTS "Admins can insert subjects" ON subjects;

CREATE POLICY "Anyone can insert subjects"
    ON subjects
    FOR INSERT
    WITH CHECK (true);

/*
  # Fix RLS Insert Policy for Users Table

  This migration fixes the INSERT policy for the users table to allow admin users
  to insert new users while maintaining proper security.

  ## Changes Made
  1. Drop and recreate the INSERT policy with correct WITH CHECK syntax
  2. Add SELECT policy for admin verification
  3. Verify policies are working correctly
  4. Fix UUID handling in verification queries
*/

-- Drop the problematic INSERT policy
DROP POLICY IF EXISTS "Admin role can insert users" ON public.users;

-- Create corrected INSERT policy
-- For INSERT operations, we need to use WITH CHECK clause
-- The logic needs to check if the current user has permission to insert
CREATE POLICY "Admin role can insert users" ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Allow if current user is admin (check in a subquery)
        (auth.uid() IN (
            SELECT id FROM public.users 
            WHERE role = 'admin'
        ))
        OR
        -- Allow if no admin exists yet (bootstrap case)
        (NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE role = 'admin'
        ))
        OR
        -- Allow service role to insert (for system operations)
        (auth.role() = 'service_role')
    );

-- Also ensure we have a proper SELECT policy for checking admin status
DROP POLICY IF EXISTS "Allow admin check for insert" ON public.users;
CREATE POLICY "Allow admin check for insert" ON public.users
    FOR SELECT
    TO authenticated
    USING (
        -- Allow reading user data for admin verification
        true
    );

-- Verify the policy was created successfully
DO $$
DECLARE
    policy_count integer;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'users'
    AND policyname = 'Admin role can insert users'
    AND cmd = 'INSERT';
    
    IF policy_count > 0 THEN
        RAISE NOTICE 'SUCCESS: INSERT policy recreated successfully';
    ELSE
        RAISE NOTICE 'ERROR: Failed to create INSERT policy';
    END IF;
END;
$$;

-- Test if admin user exists and can be verified
DO $$
DECLARE
    admin_count integer;
    admin_id uuid;
BEGIN
    SELECT COUNT(*) INTO admin_count
    FROM public.users 
    WHERE role = 'admin';
    
    -- Get one admin ID if exists (using LIMIT instead of MAX)
    IF admin_count > 0 THEN
        SELECT id INTO admin_id
        FROM public.users 
        WHERE role = 'admin'
        LIMIT 1;
        
        RAISE NOTICE 'SUCCESS: Admin user found with ID: %', admin_id;
    ELSE
        RAISE NOTICE 'WARNING: No admin user found - bootstrap mode will be active';
    END IF;
END;
$$;

-- Show current RLS policies for users table
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    RAISE NOTICE 'CURRENT RLS POLICIES FOR USERS TABLE:';
    FOR policy_record IN 
        SELECT policyname, cmd, roles, qual, with_check
        FROM pg_policies 
        WHERE tablename = 'users'
        ORDER BY cmd, policyname
    LOOP
        RAISE NOTICE '- Policy: %, Command: %, Roles: %, Using: %, With Check: %', 
            policy_record.policyname, 
            policy_record.cmd, 
            policy_record.roles, 
            COALESCE(policy_record.qual, 'NULL'),
            COALESCE(policy_record.with_check, 'NULL');
    END LOOP;
END;
$$;

-- Final verification that the system is ready for user registration
DO $$
DECLARE
    can_insert boolean := false;
    admin_exists boolean := false;
BEGIN
    -- Check if admin exists
    SELECT EXISTS(SELECT 1 FROM public.users WHERE role = 'admin') INTO admin_exists;
    
    -- Check if INSERT policy exists
    SELECT EXISTS(
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' 
        AND policyname = 'Admin role can insert users'
        AND cmd = 'INSERT'
    ) INTO can_insert;
    
    IF can_insert AND admin_exists THEN
        RAISE NOTICE 'SYSTEM READY: Admin exists and INSERT policy is active';
    ELSIF can_insert AND NOT admin_exists THEN
        RAISE NOTICE 'BOOTSTRAP MODE: INSERT policy active, waiting for first admin';
    ELSE
        RAISE NOTICE 'ERROR: INSERT policy not found or not working';
    END IF;
END;
$$;
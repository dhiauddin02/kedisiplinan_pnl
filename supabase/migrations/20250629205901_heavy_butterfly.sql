/*
  # Fix RLS Insert Policy for Users Table

  This migration fixes the RLS policy for INSERT operations on the users table.
  The issue was with the policy logic that was preventing admin users from
  adding new students to the system.

  ## Changes Made
  1. Drop the problematic INSERT policy
  2. Create a new INSERT policy with proper logic
  3. Ensure admin users can insert new users
  4. Allow bootstrap case for first admin creation
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
    SELECT COUNT(*), MAX(id) INTO admin_count, admin_id
    FROM public.users 
    WHERE role = 'admin';
    
    IF admin_count > 0 THEN
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
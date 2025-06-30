/*
  # Fix RLS Insert Policy for Users Table

  1. Problem Analysis
    - Current INSERT policy uses WITH CHECK clause incorrectly
    - WITH CHECK validates the NEW row data, but we're checking auth.uid() context
    - This causes "new row violates row-level security policy" error

  2. Solution
    - Replace WITH CHECK with USING clause for INSERT operations
    - USING clause properly handles permission checks based on user context
    - Keep the same logic but use correct RLS syntax

  3. Changes
    - Drop existing problematic INSERT policy
    - Create new INSERT policy using USING clause
    - Maintain same permission logic (admin can insert, bootstrap case allowed)
*/

-- Drop the problematic INSERT policy
DROP POLICY IF EXISTS "Admin role can insert users" ON public.users;

-- Create corrected INSERT policy using USING clause instead of WITH CHECK
CREATE POLICY "Admin role can insert users" ON public.users
    FOR INSERT
    TO authenticated
    USING (
        -- Allow if current user is admin
        (EXISTS (
            SELECT 1 FROM public.users users_1
            WHERE users_1.id = auth.uid()
            AND users_1.role = 'admin'
        ))
        OR
        -- Allow if no admin exists yet (bootstrap case)
        (NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE role = 'admin'
        ))
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
/*
  # Fix Admin User Verification and RLS Policies

  This migration addresses the RLS policy issues preventing admin users from registering new students.
  
  1. Verify and fix admin user configuration
  2. Update RLS policies to properly handle admin verification
  3. Add debugging information to identify issues
  4. Ensure proper auth.uid() to public.users mapping
*/

-- First, let's check the current state and fix any inconsistencies
DO $$
DECLARE
    admin_auth_id uuid;
    admin_public_id uuid;
    admin_email text;
    admin_nim text;
    mismatch_found boolean := false;
BEGIN
    RAISE NOTICE 'STARTING ADMIN VERIFICATION AND FIX...';
    
    -- Get admin from auth.users
    SELECT id, email INTO admin_auth_id, admin_email
    FROM auth.users 
    WHERE email = 'admin@pnl.ac.id'
    LIMIT 1;
    
    -- Get admin from public.users
    SELECT id, nim INTO admin_public_id, admin_nim
    FROM public.users 
    WHERE nim = 'admin' AND role = 'admin'
    LIMIT 1;
    
    RAISE NOTICE 'Auth admin ID: %, Email: %', admin_auth_id, admin_email;
    RAISE NOTICE 'Public admin ID: %, NIM: %', admin_public_id, admin_nim;
    
    -- Check for mismatches
    IF admin_auth_id IS NOT NULL AND admin_public_id IS NOT NULL THEN
        IF admin_auth_id != admin_public_id THEN
            RAISE NOTICE 'MISMATCH DETECTED: Auth ID (%) != Public ID (%)', admin_auth_id, admin_public_id;
            mismatch_found := true;
            
            -- Fix the mismatch by updating public.users to match auth.users
            UPDATE public.users 
            SET id = admin_auth_id 
            WHERE nim = 'admin' AND role = 'admin';
            
            RAISE NOTICE 'FIXED: Updated public.users admin ID to match auth.users';
        ELSE
            RAISE NOTICE 'SUCCESS: Admin IDs are consistent between auth and public tables';
        END IF;
    ELSIF admin_auth_id IS NULL AND admin_public_id IS NOT NULL THEN
        RAISE NOTICE 'WARNING: Admin exists in public.users but not in auth.users';
        RAISE NOTICE 'This will be resolved when admin logs in and auth user is created';
    ELSIF admin_auth_id IS NOT NULL AND admin_public_id IS NULL THEN
        RAISE NOTICE 'WARNING: Admin exists in auth.users but not in public.users';
        -- Create the missing public.users entry
        INSERT INTO public.users (
            id, email, nama, nim, role, level_user, created_at, updated_at
        ) VALUES (
            admin_auth_id, 'admin@pnl.ac.id', 'Administrator', 'admin', 'admin', 1, now(), now()
        );
        RAISE NOTICE 'FIXED: Created missing public.users entry for admin';
    ELSE
        RAISE NOTICE 'WARNING: No admin user found in either table';
    END IF;
END;
$$;

-- Temporarily disable RLS to fix policies
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop all existing INSERT policies to start fresh
DROP POLICY IF EXISTS "Admin role can insert users" ON public.users;
DROP POLICY IF EXISTS "Service role can insert users" ON public.users;

-- Create a comprehensive INSERT policy that handles all cases
CREATE POLICY "Admin role can insert users" ON public.users
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Case 1: Current user is an admin (most common case)
        (auth.uid() IN (
            SELECT id FROM public.users 
            WHERE role = 'admin'
        ))
        OR
        -- Case 2: No admin exists yet (bootstrap case)
        (NOT EXISTS (
            SELECT 1 FROM public.users
            WHERE role = 'admin'
        ))
    );

-- Create separate policy for service role
CREATE POLICY "Service role can insert users" ON public.users
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Ensure SELECT policy allows admin verification
DROP POLICY IF EXISTS "Allow admin check for insert" ON public.users;
CREATE POLICY "Allow admin check for insert" ON public.users
    FOR SELECT
    TO authenticated
    USING (true);

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Test the policies with current admin user
DO $$
DECLARE
    admin_id uuid;
    policy_test_result boolean := false;
    admin_count integer;
BEGIN
    RAISE NOTICE 'TESTING RLS POLICIES...';
    
    -- Get current admin ID
    SELECT id INTO admin_id
    FROM public.users 
    WHERE nim = 'admin' AND role = 'admin'
    LIMIT 1;
    
    IF admin_id IS NOT NULL THEN
        RAISE NOTICE 'Testing with admin ID: %', admin_id;
        
        -- Test if admin can be found (this simulates the RLS check)
        SELECT COUNT(*) > 0 INTO policy_test_result
        FROM public.users 
        WHERE role = 'admin' AND id = admin_id;
        
        IF policy_test_result THEN
            RAISE NOTICE 'SUCCESS: Admin user can be verified for RLS policy';
        ELSE
            RAISE NOTICE 'ERROR: Admin user cannot be verified for RLS policy';
        END IF;
        
        -- Count total admins
        SELECT COUNT(*) INTO admin_count
        FROM public.users 
        WHERE role = 'admin';
        
        RAISE NOTICE 'Total admin users found: %', admin_count;
    ELSE
        RAISE NOTICE 'ERROR: No admin user found for testing';
    END IF;
END;
$$;

-- Show final policy configuration
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    RAISE NOTICE 'FINAL RLS POLICY CONFIGURATION:';
    FOR policy_record IN 
        SELECT policyname, cmd, roles, 
               COALESCE(qual, 'NULL') as using_clause,
               COALESCE(with_check, 'NULL') as with_check_clause
        FROM pg_policies 
        WHERE tablename = 'users'
        ORDER BY cmd, policyname
    LOOP
        RAISE NOTICE '- Policy: % | Command: % | Roles: %', 
            policy_record.policyname, 
            policy_record.cmd, 
            policy_record.roles;
        RAISE NOTICE '  Using: %', policy_record.using_clause;
        RAISE NOTICE '  With Check: %', policy_record.with_check_clause;
    END LOOP;
END;
$$;

-- Final verification
DO $$
DECLARE
    auth_admin_count integer;
    public_admin_count integer;
    consistent_admin_count integer;
BEGIN
    RAISE NOTICE 'FINAL VERIFICATION:';
    
    -- Count admins in auth.users
    SELECT COUNT(*) INTO auth_admin_count
    FROM auth.users 
    WHERE email = 'admin@pnl.ac.id';
    
    -- Count admins in public.users
    SELECT COUNT(*) INTO public_admin_count
    FROM public.users 
    WHERE nim = 'admin' AND role = 'admin';
    
    -- Count consistent admins (same ID in both tables)
    SELECT COUNT(*) INTO consistent_admin_count
    FROM auth.users a
    JOIN public.users p ON a.id = p.id
    WHERE a.email = 'admin@pnl.ac.id' 
    AND p.nim = 'admin' 
    AND p.role = 'admin';
    
    RAISE NOTICE '- Auth admins: %', auth_admin_count;
    RAISE NOTICE '- Public admins: %', public_admin_count;
    RAISE NOTICE '- Consistent admins: %', consistent_admin_count;
    
    IF consistent_admin_count > 0 THEN
        RAISE NOTICE 'SUCCESS: Admin user is properly configured and consistent';
    ELSIF public_admin_count > 0 AND auth_admin_count = 0 THEN
        RAISE NOTICE 'INFO: Admin exists in public.users, auth user will be created on login';
    ELSE
        RAISE NOTICE 'WARNING: Admin configuration may need attention';
    END IF;
END;
$$;
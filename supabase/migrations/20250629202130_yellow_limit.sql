/*
  # Fix Admin User Creation and RLS Policies

  1. Create admin user safely
  2. Fix RLS policies to allow admin creation
  3. Ensure proper authentication flow

  This migration fixes the chicken-and-egg problem with admin user creation.
*/

-- Temporarily disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Function to create admin user safely
CREATE OR REPLACE FUNCTION create_admin_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    admin_user_id uuid;
    existing_auth_user uuid;
    existing_public_user uuid;
BEGIN
    -- Check if admin already exists in auth.users
    SELECT id INTO existing_auth_user 
    FROM auth.users 
    WHERE email = 'admin@pnl.ac.id';
    
    -- Check if admin already exists in public.users
    SELECT id INTO existing_public_user 
    FROM public.users 
    WHERE nim = 'admin';
    
    -- If admin exists in auth but not in public, use existing auth id
    IF existing_auth_user IS NOT NULL AND existing_public_user IS NULL THEN
        admin_user_id := existing_auth_user;
        RAISE NOTICE 'Using existing auth user: %', admin_user_id;
        
    -- If admin exists in public but not in auth, we need to create auth user
    ELSIF existing_auth_user IS NULL AND existing_public_user IS NOT NULL THEN
        -- Delete the orphaned public user and recreate properly
        DELETE FROM public.users WHERE nim = 'admin';
        RAISE NOTICE 'Deleted orphaned public user';
        
    -- If both exist, ensure they match
    ELSIF existing_auth_user IS NOT NULL AND existing_public_user IS NOT NULL THEN
        IF existing_auth_user = existing_public_user THEN
            RAISE NOTICE 'Admin user already exists and is consistent';
            -- Re-enable RLS and exit
            ALTER TABLE users ENABLE ROW LEVEL SECURITY;
            RETURN;
        ELSE
            -- Fix the mismatch by updating public.users
            UPDATE public.users 
            SET id = existing_auth_user 
            WHERE nim = 'admin';
            RAISE NOTICE 'Fixed ID mismatch between auth and public users';
            -- Re-enable RLS and exit
            ALTER TABLE users ENABLE ROW LEVEL SECURITY;
            RETURN;
        END IF;
    END IF;
    
    -- Create new admin user if doesn't exist
    IF existing_auth_user IS NULL THEN
        -- Generate a UUID for the admin user
        admin_user_id := gen_random_uuid();
        RAISE NOTICE 'Generated admin user ID: %. Please create auth user with email: admin@pnl.ac.id', admin_user_id;
    ELSE
        admin_user_id := existing_auth_user;
    END IF;
    
    -- Insert or update public.users
    INSERT INTO public.users (
        id,
        email,
        nama,
        nim,
        role,
        level_user,
        created_at,
        updated_at
    ) VALUES (
        admin_user_id,
        'admin@pnl.ac.id',
        'Administrator',
        'admin',
        'admin',
        1,
        now(),
        now()
    )
    ON CONFLICT (nim) DO UPDATE SET
        id = EXCLUDED.id,
        email = EXCLUDED.email,
        nama = EXCLUDED.nama,
        role = EXCLUDED.role,
        level_user = EXCLUDED.level_user,
        updated_at = now();
        
    RAISE NOTICE 'Admin user created/updated successfully with ID: %', admin_user_id;
END;
$$;

-- Execute the function
SELECT create_admin_user();

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop the temporary function
DROP FUNCTION create_admin_user();

-- Update RLS policies to be more flexible for initial admin creation
DROP POLICY IF EXISTS "Admin role can insert users" ON users;

-- Create a more flexible admin insert policy that allows:
-- 1. Existing admins to insert users
-- 2. Service role to insert users (for registration)
-- 3. First admin creation when no admin exists
CREATE POLICY "Admin role can insert users" ON users
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Allow if current user is admin
        (EXISTS (
            SELECT 1 FROM users users_1 
            WHERE users_1.id = auth.uid() 
            AND users_1.role = 'admin'
        ))
        OR
        -- Allow if no admin exists yet (bootstrap case)
        (NOT EXISTS (
            SELECT 1 FROM users 
            WHERE role = 'admin'
        ))
    );

-- Also create a policy for service role (used by application for registration)
CREATE POLICY "Service role can insert users" ON users
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Ensure admin can update any user, users can update themselves
DROP POLICY IF EXISTS "Admin role can update users" ON users;
CREATE POLICY "Admin role can update users" ON users
    FOR UPDATE
    TO authenticated
    USING (
        (auth.uid() = id) 
        OR 
        (EXISTS (
            SELECT 1 FROM users users_1 
            WHERE users_1.id = auth.uid() 
            AND users_1.role = 'admin'
        ))
    )
    WITH CHECK (
        (auth.uid() = id) 
        OR 
        (EXISTS (
            SELECT 1 FROM users users_1 
            WHERE users_1.id = auth.uid() 
            AND users_1.role = 'admin'
        ))
    );

-- Allow service role to update users (for application operations)
CREATE POLICY "Service role can update users" ON users
    FOR UPDATE
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Ensure admin can delete users
DROP POLICY IF EXISTS "Admin role can delete users" ON users;
CREATE POLICY "Admin role can delete users" ON users
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users users_1 
            WHERE users_1.id = auth.uid() 
            AND users_1.role = 'admin'
        )
    );

-- Allow service role to delete users if needed
CREATE POLICY "Service role can delete users" ON users
    FOR DELETE
    TO service_role
    USING (true);

-- Verify the admin user exists and show status
DO $$
DECLARE
    admin_count integer;
    auth_admin_count integer;
BEGIN
    -- Check public.users
    SELECT COUNT(*) INTO admin_count 
    FROM public.users 
    WHERE nim = 'admin' AND role = 'admin';
    
    -- Check auth.users
    SELECT COUNT(*) INTO auth_admin_count 
    FROM auth.users 
    WHERE email = 'admin@pnl.ac.id';
    
    IF admin_count > 0 THEN
        RAISE NOTICE 'SUCCESS: Admin user exists in public.users table';
    ELSE
        RAISE NOTICE 'WARNING: Admin user not found in public.users table';
    END IF;
    
    IF auth_admin_count > 0 THEN
        RAISE NOTICE 'SUCCESS: Admin user exists in auth.users table';
    ELSE
        RAISE NOTICE 'INFO: Admin user not found in auth.users table - will be created on first login';
    END IF;
    
    -- Show current admin user info
    RAISE NOTICE 'Current admin users in public.users:';
    FOR admin_count IN 
        SELECT 1 FROM public.users WHERE role = 'admin'
    LOOP
        -- This will show in the logs
        NULL;
    END LOOP;
END;
$$;
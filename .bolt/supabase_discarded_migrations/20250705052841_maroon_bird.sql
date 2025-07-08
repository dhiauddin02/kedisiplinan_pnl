/*
  # Fix Admin Login Issue

  1. Check and fix admin user data consistency
  2. Ensure admin exists in both auth.users and public.users
  3. Fix any ID mismatches between tables
  4. Use UPSERT operations to avoid duplicate key errors
*/

-- Function to check and fix admin user
CREATE OR REPLACE FUNCTION check_and_fix_admin_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    admin_auth_id uuid;
    admin_public_id uuid;
    admin_exists_auth boolean := false;
    admin_exists_public boolean := false;
BEGIN
    RAISE NOTICE 'Checking admin user status...';
    
    -- Check if admin exists in auth.users
    SELECT id INTO admin_auth_id
    FROM auth.users 
    WHERE email = 'admin@pnl.ac.id'
    LIMIT 1;
    
    admin_exists_auth := (admin_auth_id IS NOT NULL);
    
    -- Check if admin exists in public.users
    SELECT id INTO admin_public_id
    FROM public.users 
    WHERE nim = 'admin' AND role = 'admin'
    LIMIT 1;
    
    admin_exists_public := (admin_public_id IS NOT NULL);
    
    RAISE NOTICE 'Admin in auth.users: %, Admin in public.users: %', admin_exists_auth, admin_exists_public;
    
    -- Case 1: Admin exists in both tables but IDs don't match
    IF admin_exists_auth AND admin_exists_public AND admin_auth_id != admin_public_id THEN
        RAISE NOTICE 'Fixing ID mismatch between auth and public tables';
        UPDATE public.users 
        SET id = admin_auth_id 
        WHERE nim = 'admin' AND role = 'admin';
        RAISE NOTICE 'Fixed: Updated public.users admin ID to match auth.users';
        
    -- Case 2: Admin exists in auth but not in public
    ELSIF admin_exists_auth AND NOT admin_exists_public THEN
        RAISE NOTICE 'Creating missing public.users entry for admin';
        INSERT INTO public.users (
            id, email, nama, nim, role, level_user, created_at, updated_at
        ) VALUES (
            admin_auth_id, 'admin@pnl.ac.id', 'Administrator', 'admin', 'admin', 1, now(), now()
        )
        ON CONFLICT (email) DO UPDATE SET
            id = EXCLUDED.id,
            nama = EXCLUDED.nama,
            nim = EXCLUDED.nim,
            role = EXCLUDED.role,
            level_user = EXCLUDED.level_user,
            updated_at = now();
        RAISE NOTICE 'Created/updated public.users entry for admin';
        
    -- Case 3: Admin exists in public but not in auth
    ELSIF NOT admin_exists_auth AND admin_exists_public THEN
        RAISE NOTICE 'Admin exists in public.users but missing from auth.users';
        RAISE NOTICE 'Creating auth.users entry for admin';
        
        -- Use existing public user ID or generate new one
        admin_auth_id := COALESCE(admin_public_id, gen_random_uuid());
        
        -- Create admin in auth.users
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            admin_auth_id,
            'authenticated',
            'authenticated',
            'admin@pnl.ac.id',
            crypt('admin123', gen_salt('bf')),
            now(),
            now(),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{}',
            now(),
            now(),
            '',
            '',
            '',
            ''
        )
        ON CONFLICT (email) DO UPDATE SET
            encrypted_password = crypt('admin123', gen_salt('bf')),
            updated_at = now();
        
        -- Update public.users with correct ID if needed
        IF admin_public_id != admin_auth_id THEN
            UPDATE public.users 
            SET id = admin_auth_id 
            WHERE nim = 'admin' AND role = 'admin';
        END IF;
        
        RAISE NOTICE 'Created/updated auth.users entry for admin with ID: %', admin_auth_id;
        
    -- Case 4: No admin exists in either table
    ELSIF NOT admin_exists_auth AND NOT admin_exists_public THEN
        RAISE NOTICE 'No admin found in either table, creating new admin';
        
        admin_auth_id := gen_random_uuid();
        
        -- Create admin in auth.users
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            admin_auth_id,
            'authenticated',
            'authenticated',
            'admin@pnl.ac.id',
            crypt('admin123', gen_salt('bf')),
            now(),
            now(),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{}',
            now(),
            now(),
            '',
            '',
            '',
            ''
        )
        ON CONFLICT (email) DO UPDATE SET
            encrypted_password = crypt('admin123', gen_salt('bf')),
            updated_at = now();
        
        -- Create admin in public.users
        INSERT INTO public.users (
            id, email, nama, nim, role, level_user, created_at, updated_at
        ) VALUES (
            admin_auth_id, 'admin@pnl.ac.id', 'Administrator', 'admin', 'admin', 1, now(), now()
        )
        ON CONFLICT (email) DO UPDATE SET
            id = EXCLUDED.id,
            nama = EXCLUDED.nama,
            nim = EXCLUDED.nim,
            role = EXCLUDED.role,
            level_user = EXCLUDED.level_user,
            updated_at = now()
        ON CONFLICT (nim) DO UPDATE SET
            id = EXCLUDED.id,
            email = EXCLUDED.email,
            nama = EXCLUDED.nama,
            role = EXCLUDED.role,
            level_user = EXCLUDED.level_user,
            updated_at = now();
        
        RAISE NOTICE 'Created new admin user with ID: %', admin_auth_id;
        
    -- Case 5: Admin exists and is consistent
    ELSE
        RAISE NOTICE 'Admin user is properly configured and consistent';
        
        -- Still verify password is correct
        IF admin_exists_auth THEN
            UPDATE auth.users 
            SET encrypted_password = crypt('admin123', gen_salt('bf')),
                updated_at = now()
            WHERE email = 'admin@pnl.ac.id';
            RAISE NOTICE 'Updated admin password to ensure it is correct';
        END IF;
    END IF;
    
END;
$$;

-- Execute the function
SELECT check_and_fix_admin_user();

-- Drop the function
DROP FUNCTION check_and_fix_admin_user();

-- Additional cleanup: Remove any duplicate admin entries
DO $$
DECLARE
    admin_count integer;
BEGIN
    -- Check for multiple admin entries in public.users
    SELECT COUNT(*) INTO admin_count
    FROM public.users 
    WHERE nim = 'admin' OR role = 'admin';
    
    IF admin_count > 1 THEN
        RAISE NOTICE 'Found % admin entries, cleaning up duplicates', admin_count;
        
        -- Keep only the most recent admin entry
        DELETE FROM public.users 
        WHERE (nim = 'admin' OR role = 'admin')
        AND id NOT IN (
            SELECT id FROM public.users 
            WHERE nim = 'admin' AND role = 'admin'
            ORDER BY created_at DESC 
            LIMIT 1
        );
        
        RAISE NOTICE 'Cleaned up duplicate admin entries';
    END IF;
END;
$$;

-- Verify final state
DO $$
DECLARE
    auth_admin RECORD;
    public_admin RECORD;
BEGIN
    RAISE NOTICE 'FINAL VERIFICATION:';
    
    -- Get admin from auth.users
    SELECT id, email, created_at INTO auth_admin
    FROM auth.users 
    WHERE email = 'admin@pnl.ac.id'
    LIMIT 1;
    
    -- Get admin from public.users
    SELECT id, nim, nama, role, level_user INTO public_admin
    FROM public.users 
    WHERE nim = 'admin' AND role = 'admin'
    LIMIT 1;
    
    IF auth_admin.id IS NOT NULL THEN
        RAISE NOTICE 'Auth admin found - ID: %, Email: %', auth_admin.id, auth_admin.email;
    ELSE
        RAISE NOTICE 'ERROR: No admin found in auth.users';
    END IF;
    
    IF public_admin.id IS NOT NULL THEN
        RAISE NOTICE 'Public admin found - ID: %, NIM: %, Name: %, Role: %, Level: %', 
            public_admin.id, public_admin.nim, public_admin.nama, public_admin.role, public_admin.level_user;
    ELSE
        RAISE NOTICE 'ERROR: No admin found in public.users';
    END IF;
    
    IF auth_admin.id IS NOT NULL AND public_admin.id IS NOT NULL THEN
        IF auth_admin.id = public_admin.id THEN
            RAISE NOTICE 'SUCCESS: Admin user is properly configured and consistent';
            RAISE NOTICE 'Login credentials: NIM = admin, Password = admin123';
        ELSE
            RAISE NOTICE 'ERROR: ID mismatch between auth and public tables';
        END IF;
    END IF;
END;
$$;
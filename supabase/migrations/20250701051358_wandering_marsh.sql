/*
  # Cleanup Authentication Data Except Admin

  1. Security
    - Temporarily disable RLS for cleanup operations
    - Clean up both auth.users and public.users tables
    - Preserve only admin user data
    - Re-enable RLS after cleanup

  2. Changes
    - Delete all non-admin users from public.users
    - Delete all non-admin users from auth.users
    - Reset any related data in other tables
    - Verify admin user integrity
*/

-- Temporarily disable RLS for cleanup operations
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE hasil_clustering DISABLE ROW LEVEL SECURITY;

-- Function to safely cleanup all non-admin authentication data
CREATE OR REPLACE FUNCTION cleanup_non_admin_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    admin_user_id uuid;
    deleted_public_count integer := 0;
    deleted_auth_count integer := 0;
    deleted_clustering_count integer := 0;
BEGIN
    -- Get admin user ID from public.users
    SELECT id INTO admin_user_id 
    FROM public.users 
    WHERE nim = 'admin' AND role = 'admin'
    LIMIT 1;
    
    IF admin_user_id IS NULL THEN
        RAISE NOTICE 'WARNING: No admin user found in public.users. Cleanup aborted.';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Admin user ID found: %', admin_user_id;
    
    -- 1. Delete clustering results for non-admin users
    DELETE FROM hasil_clustering 
    WHERE id_user != admin_user_id;
    
    GET DIAGNOSTICS deleted_clustering_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % clustering results for non-admin users', deleted_clustering_count;
    
    -- 2. Delete non-admin users from public.users
    DELETE FROM public.users 
    WHERE id != admin_user_id 
    AND nim != 'admin' 
    AND role != 'admin';
    
    GET DIAGNOSTICS deleted_public_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % non-admin users from public.users', deleted_public_count;
    
    -- 3. Delete non-admin users from auth.users
    -- Note: This requires careful handling as we need to preserve the admin auth user
    DELETE FROM auth.users 
    WHERE id != admin_user_id 
    AND email != 'admin@pnl.ac.id';
    
    GET DIAGNOSTICS deleted_auth_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % non-admin users from auth.users', deleted_auth_count;
    
    -- 4. Verify admin user still exists
    IF EXISTS (SELECT 1 FROM public.users WHERE id = admin_user_id AND nim = 'admin') THEN
        RAISE NOTICE 'SUCCESS: Admin user preserved in public.users';
    ELSE
        RAISE NOTICE 'ERROR: Admin user missing from public.users after cleanup!';
    END IF;
    
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = admin_user_id) THEN
        RAISE NOTICE 'SUCCESS: Admin user preserved in auth.users';
    ELSE
        RAISE NOTICE 'WARNING: Admin user missing from auth.users - will need to be recreated on login';
    END IF;
    
    RAISE NOTICE 'CLEANUP SUMMARY:';
    RAISE NOTICE '- Deleted % clustering results', deleted_clustering_count;
    RAISE NOTICE '- Deleted % users from public.users', deleted_public_count;
    RAISE NOTICE '- Deleted % users from auth.users', deleted_auth_count;
    RAISE NOTICE '- Admin user preserved with ID: %', admin_user_id;
    
END;
$$;

-- Execute the cleanup function
SELECT cleanup_non_admin_users();

-- Drop the temporary function
DROP FUNCTION cleanup_non_admin_users();

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE hasil_clustering ENABLE ROW LEVEL SECURITY;

-- Reset any sequences or auto-increment values if needed
-- (Not applicable for UUID-based tables, but good practice)

-- Verify final state
DO $$
DECLARE
    total_public_users integer;
    total_auth_users integer;
    admin_public_users integer;
    admin_auth_users integer;
    total_clustering_results integer;
BEGIN
    -- Count users in public.users
    SELECT COUNT(*) INTO total_public_users FROM public.users;
    SELECT COUNT(*) INTO admin_public_users FROM public.users WHERE role = 'admin';
    
    -- Count users in auth.users
    SELECT COUNT(*) INTO total_auth_users FROM auth.users;
    SELECT COUNT(*) INTO admin_auth_users FROM auth.users WHERE email = 'admin@pnl.ac.id';
    
    -- Count clustering results
    SELECT COUNT(*) INTO total_clustering_results FROM hasil_clustering;
    
    RAISE NOTICE 'FINAL STATE VERIFICATION:';
    RAISE NOTICE '- Total users in public.users: %', total_public_users;
    RAISE NOTICE '- Admin users in public.users: %', admin_public_users;
    RAISE NOTICE '- Total users in auth.users: %', total_auth_users;
    RAISE NOTICE '- Admin users in auth.users: %', admin_auth_users;
    RAISE NOTICE '- Total clustering results: %', total_clustering_results;
    
    IF total_public_users = admin_public_users AND admin_public_users = 1 THEN
        RAISE NOTICE 'SUCCESS: Only admin user remains in public.users';
    ELSE
        RAISE NOTICE 'WARNING: Unexpected user count in public.users';
    END IF;
    
    IF total_auth_users <= 1 THEN
        RAISE NOTICE 'SUCCESS: Auth users cleaned up (% remaining)', total_auth_users;
    ELSE
        RAISE NOTICE 'INFO: % auth users remaining', total_auth_users;
    END IF;
END;
$$;

-- Show remaining users for verification
DO $$
DECLARE
    user_record RECORD;
BEGIN
    RAISE NOTICE 'REMAINING USERS IN PUBLIC.USERS:';
    FOR user_record IN 
        SELECT nim, nama, email, role, level_user 
        FROM public.users 
        ORDER BY role, nim
    LOOP
        RAISE NOTICE '- NIM: %, Name: %, Email: %, Role: %, Level: %', 
            user_record.nim, user_record.nama, user_record.email, 
            user_record.role, user_record.level_user;
    END LOOP;
    
    RAISE NOTICE 'REMAINING USERS IN AUTH.USERS:';
    FOR user_record IN 
        SELECT email, created_at 
        FROM auth.users 
        ORDER BY created_at
    LOOP
        RAISE NOTICE '- Email: %, Created: %', 
            user_record.email, user_record.created_at;
    END LOOP;
END;
$$;
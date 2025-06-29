/*
  # Fix Users Table Structure for Supabase Auth Integration

  1. Database Structure Changes
    - Remove password column from users table (use Supabase Auth instead)
    - Ensure id column is UUID type and references auth.users
    - Add proper foreign key constraint to auth.users

  2. Security (RLS Policies)
    - Drop all existing policies that reference users.id
    - Create new policies compatible with Supabase Auth
    - Enable proper access control for admin and regular users

  3. Admin User Setup
    - Create admin user in both auth.users and public.users
    - Set up proper authentication credentials

  IMPORTANT: This migration completely rebuilds RLS policies to avoid column dependency conflicts.
*/

-- Step 1: Disable RLS on all tables to avoid dependency issues
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE periode DISABLE ROW LEVEL SECURITY;
ALTER TABLE batch DISABLE ROW LEVEL SECURITY;
ALTER TABLE hasil_clustering DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on ALL tables
-- This ensures no policies reference the users.id column
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on users table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
    END LOOP;
    
    -- Drop all policies on periode table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'periode' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON periode';
    END LOOP;
    
    -- Drop all policies on batch table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'batch' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON batch';
    END LOOP;
    
    -- Drop all policies on hasil_clustering table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'hasil_clustering' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON hasil_clustering';
    END LOOP;
END $$;

-- Step 3: Remove password column since we'll use Supabase Auth
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- Step 4: Ensure id column is UUID type (safe now that policies are dropped)
DO $$
BEGIN
    -- Check if id column is already UUID type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'id' 
        AND data_type = 'uuid'
    ) THEN
        ALTER TABLE users ALTER COLUMN id SET DATA TYPE uuid USING id::uuid;
    END IF;
END $$;

-- Step 5: Add foreign key constraint to auth.users if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_id_fkey' AND table_name = 'users'
    ) THEN
        ALTER TABLE users ADD CONSTRAINT users_id_fkey 
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 6: Re-enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE periode ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE hasil_clustering ENABLE ROW LEVEL SECURITY;

-- Step 7: Create new RLS policies for users table
CREATE POLICY "Users can read own data"
    ON users
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
    ON users
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Admin role can update users"
    ON users
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id OR EXISTS (
        SELECT 1 FROM users users_1
        WHERE users_1.id = auth.uid() AND users_1.role = 'admin'
    ))
    WITH CHECK (auth.uid() = id OR EXISTS (
        SELECT 1 FROM users users_1
        WHERE users_1.id = auth.uid() AND users_1.role = 'admin'
    ));

CREATE POLICY "Admin role can insert users"
    ON users
    FOR INSERT
    TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM users users_1
        WHERE users_1.id = auth.uid() AND users_1.role = 'admin'
    ));

CREATE POLICY "Admin role can delete users"
    ON users
    FOR DELETE
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users users_1
        WHERE users_1.id = auth.uid() AND users_1.role = 'admin'
    ));

CREATE POLICY "Allow NIM lookup for login"
    ON users
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Authenticated users can read users"
    ON users
    FOR SELECT
    TO authenticated
    USING (true);

-- Step 8: Create RLS policies for periode table
CREATE POLICY "Admin can manage periode"
    ON periode
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

CREATE POLICY "Everyone can read periode"
    ON periode
    FOR SELECT
    TO authenticated
    USING (true);

-- Step 9: Create RLS policies for batch table
CREATE POLICY "Admin can manage batch"
    ON batch
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

CREATE POLICY "Everyone can read batch"
    ON batch
    FOR SELECT
    TO authenticated
    USING (true);

-- Step 10: Create RLS policies for hasil_clustering table
CREATE POLICY "Admin can manage clustering results"
    ON hasil_clustering
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

CREATE POLICY "Users can read own clustering results"
    ON hasil_clustering
    FOR SELECT
    TO authenticated
    USING (id_user = auth.uid() OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- Step 11: Create admin user
DO $$
DECLARE
    admin_user_id uuid;
    admin_exists boolean := false;
BEGIN
    -- Generate a consistent UUID for admin user
    admin_user_id := '00000000-0000-0000-0000-000000000001'::uuid;
    
    -- Check if admin user already exists in auth.users
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'admin@pnl.ac.id') INTO admin_exists;
    
    -- Delete existing admin from public.users to avoid conflicts
    DELETE FROM users WHERE nim = 'admin' OR email = 'admin@pnl.ac.id';
    
    -- Create admin in auth.users if doesn't exist
    IF NOT admin_exists THEN
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
            admin_user_id,
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
        );
        
        RAISE NOTICE 'Created new admin user in auth.users with ID: %', admin_user_id;
    ELSE
        -- Get existing admin user ID
        SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@pnl.ac.id';
        RAISE NOTICE 'Using existing admin user from auth.users with ID: %', admin_user_id;
    END IF;
    
    -- Insert admin into public.users
    INSERT INTO users (
        id,
        email,
        nim,
        role,
        level_user,
        nama,
        created_at,
        updated_at
    ) VALUES (
        admin_user_id,
        'admin@pnl.ac.id',
        'admin',
        'admin',
        1,
        'Administrator',
        now(),
        now()
    );
    
    RAISE NOTICE 'Admin user setup completed with ID: %', admin_user_id;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error during admin user creation: %', SQLERRM;
        -- Continue execution even if admin creation fails
END $$;
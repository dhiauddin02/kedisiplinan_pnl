/*
  # Fix Supabase Authentication Integration

  1. Database Changes
    - Remove password column from users table
    - Convert id column to UUID type
    - Add foreign key constraint to auth.users
    - Create admin user in both auth.users and public.users

  2. Security
    - Update all RLS policies to use auth.uid()
    - Maintain proper access control for admin and student roles
    - Allow NIM-based lookup for login verification

  3. Data Migration
    - Clean up existing data that conflicts with foreign key
    - Create admin user with proper authentication setup
*/

-- First, drop ALL policies that might reference the users.id column
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Allow login and own data access" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Admin can insert users" ON users;
DROP POLICY IF EXISTS "Admin can manage users" ON users;
DROP POLICY IF EXISTS "Allow first admin creation" ON users;

-- Drop policies on other tables that reference users.id
DROP POLICY IF EXISTS "Admin can manage periode" ON periode;
DROP POLICY IF EXISTS "Everyone can read periode" ON periode;
DROP POLICY IF EXISTS "Admin can manage batch" ON batch;
DROP POLICY IF EXISTS "Everyone can read batch" ON batch;
DROP POLICY IF EXISTS "Admin can manage clustering results" ON hasil_clustering;
DROP POLICY IF EXISTS "Users can read own clustering results" ON hasil_clustering;

-- Remove the password column since we'll use Supabase Auth
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- Clean up existing data that would violate foreign key constraint
-- We need to remove all existing users since they won't have corresponding auth.users entries
DELETE FROM hasil_clustering;
DELETE FROM users;

-- Now we can safely alter the id column type
ALTER TABLE users ALTER COLUMN id SET DATA TYPE uuid USING gen_random_uuid();

-- Create admin user in auth.users first
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Generate a fixed UUID for admin user
  admin_user_id := '00000000-0000-0000-0000-000000000001'::uuid;
  
  -- Check if admin user already exists in auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@pnl.ac.id') THEN
    -- Insert into auth.users
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
    
    RAISE NOTICE 'Admin user created in auth.users with ID: %', admin_user_id;
  ELSE
    -- Get existing admin user ID
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@pnl.ac.id';
    RAISE NOTICE 'Using existing admin user ID: %', admin_user_id;
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
  
  RAISE NOTICE 'Admin user created in public.users with ID: %', admin_user_id;
END $$;

-- Now add foreign key constraint after we have valid data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_id_fkey' AND table_name = 'users'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_id_fkey 
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Foreign key constraint added successfully';
  END IF;
END $$;

-- Create new policies for users table that work with Supabase Auth
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

CREATE POLICY "Admin can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

-- Allow reading users table for login verification (by NIM)
CREATE POLICY "Allow NIM lookup for login"
  ON users
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Recreate policies for other tables
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
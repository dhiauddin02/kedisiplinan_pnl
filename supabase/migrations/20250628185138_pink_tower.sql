/*
  # Setup Supabase Authentication Integration

  1. New Tables
    - Update users table to work with Supabase Auth
    - Add proper foreign key relationship with auth.users
  
  2. Security
    - Update RLS policies to work with auth.uid()
    - Ensure proper access control
  
  3. Data Migration
    - Create admin user in both auth.users and public.users
*/

-- First, let's update the users table structure to work with Supabase Auth
-- Remove the password column since we'll use Supabase Auth
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- Make sure id is UUID and references auth.users
ALTER TABLE users ALTER COLUMN id SET DATA TYPE uuid;

-- Add foreign key constraint to auth.users if it doesn't exist
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

-- Update RLS policies to work with auth.uid()
DROP POLICY IF EXISTS "Allow login and own data access" ON users;

-- Create new policies that work with Supabase Auth
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

-- Create admin user in auth.users and public.users
DO $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Check if admin user already exists in auth.users
  SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@pnl.ac.id';
  
  -- If admin doesn't exist in auth.users, create it
  IF admin_user_id IS NULL THEN
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
      gen_random_uuid(),
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
    ) RETURNING id INTO admin_user_id;
  END IF;
  
  -- Delete existing admin from public.users to avoid conflicts
  DELETE FROM users WHERE nim = 'admin' OR email = 'admin@pnl.ac.id';
  
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
  
  RAISE NOTICE 'Admin user created with ID: %', admin_user_id;
END $$;
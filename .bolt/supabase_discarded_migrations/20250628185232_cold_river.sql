/*
  # Update users table for Supabase Auth integration

  1. Remove password column and update structure
  2. Update RLS policies for auth integration
  3. Create admin user in both auth.users and public.users
*/

-- First, drop all existing policies that depend on the id column
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Allow login and own data access" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Admin can insert users" ON users;
DROP POLICY IF EXISTS "Admin can manage users" ON users;
DROP POLICY IF EXISTS "Allow first admin creation" ON users;

-- Remove the password column since we'll use Supabase Auth
ALTER TABLE users DROP COLUMN IF EXISTS password;

-- Now we can safely alter the id column type
ALTER TABLE users ALTER COLUMN id SET DATA TYPE uuid USING id::uuid;

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
  -- Generate a fixed UUID for admin user
  admin_user_id := '00000000-0000-0000-0000-000000000001'::uuid;
  
  -- Delete existing admin from public.users to avoid conflicts
  DELETE FROM users WHERE nim = 'admin' OR email = 'admin@pnl.ac.id';
  
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
  ELSE
    -- Get existing admin user ID
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@pnl.ac.id';
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
  
  RAISE NOTICE 'Admin user created with ID: %', admin_user_id;
END $$;
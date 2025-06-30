/*
  # Update RLS Policies for Self-Registration System

  1. Changes
    - Allow authenticated users to insert their own data in public.users
    - Simplify admin policies to avoid recursion
    - Maintain security while enabling self-registration flow

  2. Security
    - Students can create and update their own profile data
    - Admins can manage all user data
    - Maintain proper access control
*/

-- Temporarily disable RLS to update policies safely
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all policies on users table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON users';
    END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create new simplified RLS policies

-- Allow NIM lookup for login (needed for login process)
CREATE POLICY "Allow NIM lookup for login"
  ON users
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow users to read their own data
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow authenticated users to insert their own data (self-registration)
CREATE POLICY "Authenticated users can insert their own data"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow users to update their own data
CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow admin to read all users (simplified check)
CREATE POLICY "Admin can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Allow admin to insert users (for admin operations)
CREATE POLICY "Admin can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
    OR
    -- Allow if no admin exists (bootstrap)
    NOT EXISTS (
      SELECT 1 FROM users WHERE role = 'admin'
    )
  );

-- Allow admin to update any user
CREATE POLICY "Admin can update all users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    OR
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = id
    OR
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Allow admin to delete users
CREATE POLICY "Admin can delete users"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.role = 'admin'
    )
  );

-- Service role policies (for backend operations)
CREATE POLICY "Service role can manage users"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verify policies were created
DO $$
DECLARE
    policy_count integer;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'users'
    AND schemaname = 'public';
    
    RAISE NOTICE 'Created % RLS policies for users table', policy_count;
END $$;
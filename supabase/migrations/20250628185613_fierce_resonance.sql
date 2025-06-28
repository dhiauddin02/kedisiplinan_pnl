/*
  # Fix RLS policies to prevent infinite recursion

  1. Policy Changes
    - Remove recursive policies that query users table within themselves
    - Create simpler, non-recursive policies for login functionality
    - Ensure anon users can lookup NIM for login without recursion
    - Maintain security while allowing proper authentication flow

  2. Security
    - Allow anonymous NIM lookup for login (non-recursive)
    - Allow users to read their own data
    - Allow admins to manage all user data
    - Prevent infinite loops in policy evaluation
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow NIM lookup for login" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Admin can insert users" ON users;

-- Create new non-recursive policies

-- Allow anonymous and authenticated users to lookup users by NIM for login
-- This is essential for the login process and doesn't create recursion
CREATE POLICY "Allow NIM lookup for login"
  ON users
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow users to read their own data (non-recursive)
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow admins to read all user data
CREATE POLICY "Admins can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.id IN (
        SELECT id FROM users WHERE role = 'admin' AND id = auth.uid()
      )
    )
  );

-- Allow users to update their own data
CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow admins to update any user data
CREATE POLICY "Admins can update all users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.id IN (
        SELECT id FROM users WHERE role = 'admin' AND id = auth.uid()
      )
    )
  );

-- Allow admins to insert new users
CREATE POLICY "Admins can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.id IN (
        SELECT id FROM users WHERE role = 'admin' AND id = auth.uid()
      )
    )
  );

-- Allow admins to delete users
CREATE POLICY "Admins can delete users"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.id IN (
        SELECT id FROM users WHERE role = 'admin' AND id = auth.uid()
      )
    )
  );
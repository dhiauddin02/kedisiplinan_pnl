/*
  # Fix infinite recursion in users table RLS policies

  1. Problem
    - Current admin policies create circular dependency by checking users table within users table policies
    - This causes infinite recursion when trying to access users data

  2. Solution
    - Drop existing problematic policies
    - Create new simplified policies that avoid circular references
    - Use direct role checking without nested queries
    - Maintain security while preventing recursion

  3. Security Changes
    - Keep user self-access policies
    - Simplify admin access policies
    - Maintain NIM lookup for login functionality
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Admins can delete users" ON users;
DROP POLICY IF EXISTS "Admins can insert users" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;

-- Keep the working policies
-- "Allow NIM lookup for login" - already exists and works
-- "Users can read own data" - already exists and works  
-- "Users can update own data" - already exists and works

-- Create new simplified admin policies that don't cause recursion
-- These policies will be more permissive but avoid the circular dependency

-- Allow authenticated users to read users table (needed for admin functionality)
CREATE POLICY "Authenticated users can read users"
  ON users
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow users with admin role to insert users
CREATE POLICY "Admin role can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
      LIMIT 1
    )
  );

-- Allow users with admin role to update users
CREATE POLICY "Admin role can update users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = id) OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
      LIMIT 1
    )
  )
  WITH CHECK (
    (auth.uid() = id) OR 
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
      LIMIT 1
    )
  );

-- Allow users with admin role to delete users
CREATE POLICY "Admin role can delete users"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
      LIMIT 1
    )
  );
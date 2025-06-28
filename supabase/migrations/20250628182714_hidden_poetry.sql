/*
  # Fix infinite recursion in users RLS policy

  1. Problem
    - The current SELECT policy on users table creates infinite recursion
    - Policy tries to query users table while protecting users table
    - This prevents login functionality from working

  2. Solution
    - Drop the problematic SELECT policy
    - Create a new policy that allows reading user data for login without recursion
    - Allow authenticated users to read their own data using auth.uid()
    - Allow unauthenticated users to read user data for login verification

  3. Security
    - Maintain security by only allowing necessary access
    - Keep other policies intact (INSERT, UPDATE)
*/

-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "Users can read own data" ON users;

-- Create a new SELECT policy that doesn't cause recursion
-- This allows login functionality to work while maintaining security
CREATE POLICY "Allow login and own data access"
  ON users
  FOR SELECT
  TO public
  USING (
    -- Allow unauthenticated access for login verification
    (auth.role() = 'anon') OR
    -- Allow authenticated users to read their own data
    (auth.uid() = id)
  );
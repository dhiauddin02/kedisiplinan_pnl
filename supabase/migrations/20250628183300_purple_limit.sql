/*
  # Fix admin user creation and login issues

  1. Ensure admin user exists with correct structure
  2. Fix any data type mismatches
  3. Verify login functionality
*/

-- First, let's ensure the admin user exists with the correct structure
-- Delete any existing admin user to avoid conflicts
DELETE FROM users WHERE nim = 'admin';

-- Insert the admin user with correct data types
INSERT INTO users (
  id,
  email,
  nim,
  password,
  role,
  level_user,
  nama,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'admin@pnl.ac.id',
  'admin',
  'admin123',
  'admin',
  1,
  'Administrator',
  now(),
  now()
);

-- Verify the user was created correctly
-- This will help debug if there are any issues
DO $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users WHERE nim = 'admin';
  
  IF user_count = 0 THEN
    RAISE EXCEPTION 'Admin user was not created successfully';
  ELSE
    RAISE NOTICE 'Admin user created successfully. Count: %', user_count;
  END IF;
END $$;
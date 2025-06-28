/*
  # Create default admin user

  1. New Data
    - Insert default admin user with credentials:
      - NIM: admin
      - Password: admin123 (plaintext for development)
      - Role: admin
      - Level: 1 (administrator)
      - Email: admin@example.com

  2. Security Notes
    - This creates a default admin for development purposes
    - Password is stored in plaintext (not recommended for production)
    - Admin can change password after first login
*/

-- Insert default admin user if it doesn't exist
INSERT INTO users (
  email,
  nim,
  password,
  role,
  level_user,
  nama,
  created_at,
  updated_at
) 
SELECT 
  'admin@example.com',
  'admin',
  'admin123',
  'admin',
  1,
  'Administrator',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE nim = 'admin'
);
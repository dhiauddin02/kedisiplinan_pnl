/*
  # Add default admin user

  1. New Data
    - Insert default admin user with credentials:
      - NIM: admin
      - Password: admin123
      - Role: admin
      - Level: 1 (admin level)
  
  2. Security
    - This user will have admin privileges to manage the system
    - Password should be changed after first login in production
*/

-- Insert default admin user if it doesn't exist
INSERT INTO users (
  nim,
  email,
  password,
  role,
  level_user,
  nama
) 
SELECT 
  'admin',
  'admin@system.local',
  'admin123',
  'admin',
  1,
  'System Administrator'
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE nim = 'admin'
);
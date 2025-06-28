/*
  # Perbaiki User Admin dan Login

  1. Bersihkan data user admin yang mungkin bermasalah
  2. Buat ulang user admin dengan data yang benar
  3. Pastikan struktur tabel sesuai dengan aplikasi
*/

-- Hapus user admin yang ada untuk memastikan data bersih
DELETE FROM users WHERE nim = 'admin' OR email = 'admin@pnl.ac.id';

-- Buat user admin baru dengan data yang benar
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

-- Verifikasi user admin berhasil dibuat
DO $$
DECLARE
  admin_user RECORD;
BEGIN
  SELECT * INTO admin_user FROM users WHERE nim = 'admin';
  
  IF admin_user.id IS NULL THEN
    RAISE EXCEPTION 'Gagal membuat user admin';
  ELSE
    RAISE NOTICE 'User admin berhasil dibuat dengan ID: %', admin_user.id;
    RAISE NOTICE 'NIM: %, Password: %, Role: %, Level: %', 
      admin_user.nim, admin_user.password, admin_user.role, admin_user.level_user;
  END IF;
END $$;
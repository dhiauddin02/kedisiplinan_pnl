/*
  # Student Discipline Clustering Database Schema

  1. New Tables
    - `users`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `role` (text, admin/mahasiswa)
      - `nama` (text)
      - `nim` (text, unique)
      - Contact information for parents and supervisors
      - Authentication fields
    - `periode`
      - `id` (uuid, primary key)
      - `nama_periode` (text)
      - `tahun_ajaran` (text)
      - `semester` (text)
    - `batch`
      - `id` (uuid, primary key)
      - `nama_batch` (text)
      - `tgl_batch` (date)
      - `id_periode` (uuid, foreign key)
    - `hasil_clustering`
      - `id` (uuid, primary key)
      - `id_user` (uuid, foreign key)
      - `id_batch` (uuid, foreign key)
      - Student data and clustering results
      - JSONB field for subject grades

  2. Security
    - Enable RLS on all tables
    - Admin can manage all data
    - Students can only read their own data
    - Allow first admin creation for setup

  3. Sample Data
    - Default admin account
    - Sample periods and batches for testing
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'mahasiswa' CHECK (role = ANY (ARRAY['admin'::text, 'mahasiswa'::text])),
  nama text,
  nim text UNIQUE,
  nama_wali text,
  no_wa_wali text,
  nama_dosen_pembimbing text,
  no_wa_dosen_pembimbing text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  level_user bigint NOT NULL DEFAULT 0,
  password text,
  tingkat text,
  kelas text
);

-- Create periode table
CREATE TABLE IF NOT EXISTS periode (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_periode text NOT NULL,
  tahun_ajaran text NOT NULL,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  semester text
);

-- Create batch table
CREATE TABLE IF NOT EXISTS batch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_batch text NOT NULL,
  tgl_batch date NOT NULL,
  id_periode uuid REFERENCES periode(id) ON DELETE CASCADE,
  status text DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft'::text, 'processing'::text, 'completed'::text])),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  semester text
);

-- Create hasil_clustering table
CREATE TABLE IF NOT EXISTS hasil_clustering (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_user uuid REFERENCES users(id) ON DELETE CASCADE,
  id_batch uuid REFERENCES batch(id) ON DELETE CASCADE,
  nim text NOT NULL,
  nama_mahasiswa text NOT NULL,
  tingkat text NOT NULL,
  kelas text NOT NULL,
  total_a numeric DEFAULT 0,
  jp integer DEFAULT 0,
  kedisiplinan text,
  cluster text,
  insight text,
  nilai_matkul jsonb DEFAULT '{}'::jsonb,
  status_pesan text DEFAULT 'belum terkirim' CHECK (status_pesan = ANY (ARRAY['belum terkirim'::text, 'terkirim'::text, 'gagal'::text])),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  semester text,
  UNIQUE(id_user, id_batch)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_nim ON users USING btree (nim);
CREATE INDEX IF NOT EXISTS idx_users_role ON users USING btree (role);
CREATE INDEX IF NOT EXISTS idx_batch_periode ON batch USING btree (id_periode);
CREATE INDEX IF NOT EXISTS idx_hasil_clustering_user ON hasil_clustering USING btree (id_user);
CREATE INDEX IF NOT EXISTS idx_hasil_clustering_batch ON hasil_clustering USING btree (id_batch);
CREATE INDEX IF NOT EXISTS idx_hasil_clustering_nim ON hasil_clustering USING btree (nim);
CREATE INDEX IF NOT EXISTS idx_nilai_matkul_jsonb ON hasil_clustering USING gin (nilai_matkul);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE periode ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE hasil_clustering ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  -- Drop users policies
  DROP POLICY IF EXISTS "Users can read own data" ON users;
  DROP POLICY IF EXISTS "Users can update own data" ON users;
  DROP POLICY IF EXISTS "Admin can insert users" ON users;
  DROP POLICY IF EXISTS "Allow first admin creation" ON users;
  
  -- Drop periode policies
  DROP POLICY IF EXISTS "Everyone can read periode" ON periode;
  DROP POLICY IF EXISTS "Admin can manage periode" ON periode;
  
  -- Drop batch policies
  DROP POLICY IF EXISTS "Everyone can read batch" ON batch;
  DROP POLICY IF EXISTS "Admin can manage batch" ON batch;
  
  -- Drop hasil_clustering policies
  DROP POLICY IF EXISTS "Users can read own clustering results" ON hasil_clustering;
  DROP POLICY IF EXISTS "Admin can manage clustering results" ON hasil_clustering;
END $$;

-- Create policies for users table
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role = 'admin'::text
  ));

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role = 'admin'::text
  ));

CREATE POLICY "Admin can insert users"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role = 'admin'::text
  ) OR NOT EXISTS (
    SELECT 1 FROM users WHERE users.role = 'admin'::text
  ));

CREATE POLICY "Allow first admin creation"
  ON users
  FOR INSERT
  TO anon
  WITH CHECK (NOT EXISTS (
    SELECT 1 FROM users WHERE users.role = 'admin'::text
  ) AND role = 'admin'::text);

-- Create policies for periode table
CREATE POLICY "Everyone can read periode"
  ON periode
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage periode"
  ON periode
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role = 'admin'::text
  ));

-- Create policies for batch table
CREATE POLICY "Everyone can read batch"
  ON batch
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage batch"
  ON batch
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role = 'admin'::text
  ));

-- Create policies for hasil_clustering table
CREATE POLICY "Users can read own clustering results"
  ON hasil_clustering
  FOR SELECT
  TO authenticated
  USING (id_user = auth.uid() OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role = 'admin'::text
  ));

CREATE POLICY "Admin can manage clustering results"
  ON hasil_clustering
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() AND users.role = 'admin'::text
  ));

-- Insert default admin account (only if no admin exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin') THEN
    INSERT INTO users (email, role, nama, nim, password, level_user) 
    VALUES ('admin@pnl.ac.id', 'admin', 'Administrator', 'admin', 'admin123', 1);
  END IF;
END $$;

-- Insert sample periods (only if none exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM periode) THEN
    INSERT INTO periode (nama_periode, tahun_ajaran, semester) VALUES 
    ('Ganjil', '2024/2025', 'Ganjil'),
    ('Genap', '2024/2025', 'Genap');
  END IF;
END $$;

-- Insert sample batches (only if none exist)
DO $$
DECLARE
  periode_ganjil_id uuid;
  periode_genap_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM batch) THEN
    SELECT id INTO periode_ganjil_id FROM periode WHERE nama_periode = 'Ganjil' AND tahun_ajaran = '2024/2025' LIMIT 1;
    SELECT id INTO periode_genap_id FROM periode WHERE nama_periode = 'Genap' AND tahun_ajaran = '2024/2025' LIMIT 1;
    
    IF periode_ganjil_id IS NOT NULL THEN
      INSERT INTO batch (nama_batch, tgl_batch, id_periode, semester) VALUES 
      ('Batch 1', CURRENT_DATE, periode_ganjil_id, 'Ganjil'),
      ('Batch 2', CURRENT_DATE, periode_ganjil_id, 'Ganjil');
    END IF;
    
    IF periode_genap_id IS NOT NULL THEN
      INSERT INTO batch (nama_batch, tgl_batch, id_periode, semester) VALUES 
      ('Batch 1', CURRENT_DATE, periode_genap_id, 'Genap');
    END IF;
  END IF;
END $$;
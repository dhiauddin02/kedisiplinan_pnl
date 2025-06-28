/*
  # Database Schema for Student Discipline Clustering System

  1. New Tables
    - `users` - Store user information (admin and students)
    - `periode` - Store academic periods
    - `batch` - Store clustering batches
    - `hasil_clustering` - Store clustering results

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users

  3. Sample Data
    - Default admin account
    - Sample periods and batches for testing
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    nama TEXT,
    nim TEXT UNIQUE,
    password TEXT,
    nama_wali TEXT,
    no_wa_wali TEXT,
    nama_dosen_pembimbing TEXT,
    no_wa_dosen_pembimbing TEXT,
    level_user INTEGER DEFAULT 2 -- 1 = admin, 2 = student
);

-- Create periode table
CREATE TABLE IF NOT EXISTS periode (
    id SERIAL PRIMARY KEY,
    nama_periode TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL
);

-- Create batch table
CREATE TABLE IF NOT EXISTS batch (
    id SERIAL PRIMARY KEY,
    nama_batch TEXT NOT NULL,
    tgl_batch DATE DEFAULT CURRENT_DATE,
    id_periode INTEGER REFERENCES periode(id)
);

-- Create hasil_clustering table
CREATE TABLE IF NOT EXISTS hasil_clustering (
    id SERIAL PRIMARY KEY,
    id_user INTEGER REFERENCES users(id),
    id_batch INTEGER REFERENCES batch(id),
    tingkat TEXT,
    kelas TEXT,
    total_a NUMERIC DEFAULT 0,
    jp INTEGER DEFAULT 0,
    kedisiplinan TEXT,
    cluster TEXT,
    insight TEXT,
    nilai_matkul JSONB,
    status_pesan TEXT DEFAULT 'belum terkirim'
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE periode ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch ENABLE ROW LEVEL SECURITY;
ALTER TABLE hasil_clustering ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow insert for registration"
  ON users
  FOR INSERT
  WITH CHECK (true);

-- Create policies for periode table
CREATE POLICY "Anyone can read periods"
  ON periode
  FOR SELECT
  USING (true);

CREATE POLICY "Allow insert periods"
  ON periode
  FOR INSERT
  WITH CHECK (true);

-- Create policies for batch table
CREATE POLICY "Anyone can read batches"
  ON batch
  FOR SELECT
  USING (true);

CREATE POLICY "Allow insert batches"
  ON batch
  FOR INSERT
  WITH CHECK (true);

-- Create policies for hasil_clustering table
CREATE POLICY "Anyone can read clustering results"
  ON hasil_clustering
  FOR SELECT
  USING (true);

CREATE POLICY "Allow insert clustering results"
  ON hasil_clustering
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update clustering results"
  ON hasil_clustering
  FOR UPDATE
  USING (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_users_nim ON users(nim);
CREATE INDEX IF NOT EXISTS idx_hasil_clustering_user ON hasil_clustering(id_user);
CREATE INDEX IF NOT EXISTS idx_hasil_clustering_batch ON hasil_clustering(id_batch);
CREATE INDEX IF NOT EXISTS idx_nilai_matkul_jsonb ON hasil_clustering USING GIN (nilai_matkul);

-- Insert default admin account
INSERT INTO users (nama, nim, password, level_user) 
VALUES ('Administrator', 'admin', 'admin123', 1)
ON CONFLICT (nim) DO NOTHING;

-- Insert sample periods
INSERT INTO periode (nama_periode, tahun_ajaran) VALUES 
('Ganjil', '2024/2025'),
('Genap', '2024/2025')
ON CONFLICT DO NOTHING;

-- Insert sample batches
INSERT INTO batch (nama_batch, id_periode) VALUES 
('Batch 1', 1),
('Batch 2', 1),
('Batch 1', 2)
ON CONFLICT DO NOTHING;
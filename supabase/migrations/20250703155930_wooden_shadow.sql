/*
  # Remove tingkat and kelas columns from users table

  1. Changes
    - Drop tingkat column from users table
    - Drop kelas column from users table
    - Update any references to these columns

  2. Security
    - No RLS policy changes needed
    - Existing policies remain intact
*/

-- Remove tingkat and kelas columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS tingkat;
ALTER TABLE users DROP COLUMN IF EXISTS kelas;

-- Verify columns were removed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'tingkat'
    ) THEN
        RAISE NOTICE 'SUCCESS: tingkat column removed from users table';
    ELSE
        RAISE NOTICE 'WARNING: tingkat column still exists in users table';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'kelas'
    ) THEN
        RAISE NOTICE 'SUCCESS: kelas column removed from users table';
    ELSE
        RAISE NOTICE 'WARNING: kelas column still exists in users table';
    END IF;
END $$;
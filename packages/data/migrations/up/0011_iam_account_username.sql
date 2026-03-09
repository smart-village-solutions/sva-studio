ALTER TABLE iam.accounts
  ADD COLUMN IF NOT EXISTS username_ciphertext TEXT;

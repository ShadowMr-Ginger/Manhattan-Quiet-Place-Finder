-- Migration: add email verification + password reset tokens
-- Run this ONCE on the server against the hushhub database:
--   psql -U hushhub -d hushhub -f migrate_add_verification.sql

-- 1. Add is_verified column to existing users table.
--    Existing users are marked as already-verified (true) so they are not locked out.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. New registrations should default to false — change the column default.
ALTER TABLE users
  ALTER COLUMN is_verified SET DEFAULT FALSE;

-- 3. Create password_reset_tokens table (SQLAlchemy create_all will skip if it exists).
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          VARCHAR PRIMARY KEY,
    user_id     VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id
    ON password_reset_tokens (user_id);

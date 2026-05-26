ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS is_direcao BOOLEAN NOT NULL DEFAULT FALSE;

-- Back-fill: roles que têm privilégios de direção
UPDATE profiles
SET is_direcao = TRUE
WHERE role IN ('direcao', 'it_support');

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS is_coordenacao BOOLEAN NOT NULL DEFAULT FALSE;

-- Back-fill: roles que já têm privilégios de coordenação
UPDATE profiles
SET is_coordenacao = TRUE
WHERE role IN ('coordenador', 'direcao', 'it_support');

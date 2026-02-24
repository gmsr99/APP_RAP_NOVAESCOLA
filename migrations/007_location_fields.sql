-- Migração 007: Adicionar campos de localização (morada + coordenadas GPS)
-- Para cálculo automático de distância entre mentores e estabelecimentos

-- Localização dos estabelecimentos (escolas)
ALTER TABLE estabelecimentos ADD COLUMN IF NOT EXISTS morada TEXT;
ALTER TABLE estabelecimentos ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE estabelecimentos ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Localização dos mentores (residência)
ALTER TABLE mentores ADD COLUMN IF NOT EXISTS morada TEXT;
ALTER TABLE mentores ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE mentores ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Kms percorridos por sessão (ida e volta) nos registos
ALTER TABLE registos ADD COLUMN IF NOT EXISTS kms_percorridos NUMERIC(8,2);

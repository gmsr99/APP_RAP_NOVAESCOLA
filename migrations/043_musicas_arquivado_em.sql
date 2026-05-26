ALTER TABLE musicas ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ;

-- Backfill: musicas já arquivadas usam updated_at como aproximação
UPDATE musicas SET arquivado_em = updated_at WHERE arquivado = TRUE AND arquivado_em IS NULL;

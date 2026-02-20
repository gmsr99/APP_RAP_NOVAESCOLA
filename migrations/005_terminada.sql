-- ==============================================================================
-- MIGRAÇÃO 005: Estado "Terminada" — avaliação e observações de término
-- ==============================================================================
-- Executar no SQL Editor do Supabase (ou via psql)
-- ==============================================================================

ALTER TABLE aulas ADD COLUMN IF NOT EXISTS avaliacao     SMALLINT CHECK (avaliacao BETWEEN 1 AND 5);
ALTER TABLE aulas ADD COLUMN IF NOT EXISTS obs_termino   TEXT;

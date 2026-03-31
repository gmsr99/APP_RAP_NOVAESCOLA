-- ==============================================================================
-- Migração 027: Adicionar coluna fase_deadline à tabela musicas
-- ==============================================================================
ALTER TABLE musicas ADD COLUMN IF NOT EXISTS fase_deadline DATE;

CREATE INDEX IF NOT EXISTS idx_musicas_fase_deadline ON musicas(fase_deadline) WHERE fase_deadline IS NOT NULL;

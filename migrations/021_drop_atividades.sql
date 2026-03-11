-- Migration 021: Remove legacy atividades table and atividade_id from aulas
-- Session linking now exclusively uses aulas.atividade_uuid → turma_atividades → turma_disciplinas.
-- Data was fully migrated to turma_atividades in migration 019.

-- 1. Remove atividade_id column from aulas (FK was to atividades.id ON DELETE SET NULL)
ALTER TABLE aulas DROP COLUMN IF EXISTS atividade_id;

-- 2. Drop the legacy atividades table (data migrated to turma_atividades in migration 019)
DROP TABLE IF EXISTS atividades CASCADE;

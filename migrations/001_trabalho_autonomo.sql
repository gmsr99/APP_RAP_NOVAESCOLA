-- ==============================================================================
-- MIGRAÇÃO 001: Suporte a Trabalho Autónomo (Planeamento vs. Execução)
-- Fase 1: Planeamento — blocos de disponibilidade no calendário
-- ==============================================================================
-- Executar no SQL Editor do Supabase (ou via psql)
-- ==============================================================================

-- 1. tornar turma_id e mentor_id nullable (aulas autónomas não têm turma nem mentor)
ALTER TABLE aulas
  ALTER COLUMN turma_id DROP NOT NULL;

ALTER TABLE aulas
  ALTER COLUMN mentor_id DROP NOT NULL;

-- 2. Novos campos para Trabalho Autónomo
ALTER TABLE aulas
  ADD COLUMN IF NOT EXISTS is_autonomous   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_realized     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tipo_atividade  TEXT,
  ADD COLUMN IF NOT EXISTS responsavel_user_id TEXT,
  ADD COLUMN IF NOT EXISTS musica_id       INTEGER;

-- 3. Comentários descritivos
COMMENT ON COLUMN aulas.is_autonomous        IS 'TRUE = bloco de trabalho interno (não é uma aula com turma)';
COMMENT ON COLUMN aulas.is_realized          IS 'TRUE = sessão executada/registada (via WorkLogModal); FALSE = planeada';
COMMENT ON COLUMN aulas.tipo_atividade       IS 'Ex: Produção Musical, Preparação Aulas, Edição/Captura, Reunião, Manutenção';
COMMENT ON COLUMN aulas.responsavel_user_id  IS 'UUID do membro da equipa responsável (profiles.id no Supabase)';
COMMENT ON COLUMN aulas.musica_id            IS 'FK para musicas.id — liga o registo de trabalho a uma track do Kanban';

-- ==============================================================================
-- Verificação: lista os novos campos adicionados
-- ==============================================================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'aulas'
  AND column_name IN ('is_autonomous', 'is_realized', 'tipo_atividade', 'responsavel_user_id', 'musica_id', 'turma_id', 'mentor_id')
ORDER BY ordinal_position;

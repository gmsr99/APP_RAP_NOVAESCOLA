-- ==============================================================================
-- MIGRAÇÃO 003: Tabela de Alunos por Turma
-- ==============================================================================
-- Executar no SQL Editor do Supabase (ou via psql)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS alunos (
  id        SERIAL PRIMARY KEY,
  turma_id  INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  nome      VARCHAR(255) NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alunos_turma_id ON alunos(turma_id);

COMMENT ON TABLE  alunos          IS 'Alunos pertencentes a cada turma';
COMMENT ON COLUMN alunos.turma_id IS 'FK para a turma (turmas.id)';
COMMENT ON COLUMN alunos.nome     IS 'Nome completo do aluno';

-- ==============================================================================
-- Verificação
-- ==============================================================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'alunos'
ORDER BY ordinal_position;

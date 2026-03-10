-- Migration 020: Add is_autonomous flag to turma_atividades
-- Replaces the fragile _TA_/_TP_ code-suffix detection with an explicit boolean.
-- Activities marked as is_autonomous=true appear only in the "Trabalho Autónomo" tab
-- in /horarios; activities with is_autonomous=false appear only in the "Aula/Evento" tab.

ALTER TABLE turma_atividades
  ADD COLUMN IF NOT EXISTS is_autonomous BOOLEAN NOT NULL DEFAULT FALSE;

-- Back-fill existing rows: if the codigo contains '_TA_' treat as autonomous
UPDATE turma_atividades
  SET is_autonomous = TRUE
  WHERE codigo LIKE '%_TA_%';

-- Index for fast filtering on the flag
CREATE INDEX IF NOT EXISTS idx_turma_atividades_is_autonomous
  ON turma_atividades (is_autonomous);

-- Migration 023: Replace perfil_mentor with roles[] in turma_atividades
-- Each activity now stores which roles can access it explicitly.

ALTER TABLE turma_atividades ADD COLUMN IF NOT EXISTS roles TEXT[] DEFAULT '{}';

-- Migrate existing data based on código suffix used in populate_wiki.py
UPDATE turma_atividades
SET roles = CASE
    WHEN codigo LIKE '%R' THEN ARRAY['mentor', 'coordenador', 'mentor_produtor']
    WHEN codigo LIKE '%P' THEN ARRAY['produtor', 'mentor', 'mentor_produtor']
    WHEN codigo LIKE '%C' THEN ARRAY['coordenador']
    ELSE '{}'
END
WHERE roles = '{}' OR roles IS NULL;

ALTER TABLE turma_atividades DROP COLUMN IF EXISTS perfil_mentor;

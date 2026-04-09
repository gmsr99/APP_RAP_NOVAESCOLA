-- Migration 024: Convert turma_atividades.roles (TEXT[]) to single role (TEXT)
-- Each activity now has exactly one role.
-- Downgrade priority: mentor > produtor > mentor_produtor > coordenador > direcao > it_support

ALTER TABLE turma_atividades ADD COLUMN IF NOT EXISTS role TEXT;

-- Populate from existing roles array with priority order (most specific wins)
UPDATE turma_atividades
SET role = CASE
    WHEN 'mentor'          = ANY(roles) THEN 'mentor'
    WHEN 'produtor'        = ANY(roles) THEN 'produtor'
    WHEN 'mentor_produtor' = ANY(roles) THEN 'mentor_produtor'
    WHEN 'coordenador'     = ANY(roles) THEN 'coordenador'
    WHEN 'direcao'         = ANY(roles) THEN 'direcao'
    WHEN 'it_support'      = ANY(roles) THEN 'it_support'
    ELSE NULL
END
WHERE role IS NULL;

-- Drop the old array column
ALTER TABLE turma_atividades DROP COLUMN IF EXISTS roles;

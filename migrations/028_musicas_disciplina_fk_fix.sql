-- ==============================================================================
-- Migração 028: Corrigir FK de musicas.disciplina_id
-- A migração 019 substituiu turma_disciplinas pelo modelo local (sem FK a disciplinas).
-- O frontend envia IDs de turma_disciplinas, mas a FK ainda aponta para disciplinas.
-- ==============================================================================

-- 1. Remover FK antiga (aponta para disciplinas)
ALTER TABLE musicas DROP CONSTRAINT IF EXISTS musicas_disciplina_id_fkey;

-- 2. Adicionar nova FK para turma_disciplinas
ALTER TABLE musicas ADD CONSTRAINT musicas_turma_disciplina_id_fkey
    FOREIGN KEY (disciplina_id) REFERENCES turma_disciplinas(id) ON DELETE SET NULL;

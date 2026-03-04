-- Migração 014: Relação N:N turma ↔ disciplina
-- Permite associar disciplinas a turmas, com sessões previstas por combinação.
-- Também adiciona disciplina_id (FK) a musicas para stats precisas por disciplina.

-- 1. Adicionar musicas_previstas à tabela disciplinas
ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS musicas_previstas INTEGER DEFAULT 7;

-- 2. Tabela bridge turma_disciplinas
CREATE TABLE IF NOT EXISTS turma_disciplinas (
    id SERIAL PRIMARY KEY,
    turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    disciplina_id INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
    sessoes_previstas INTEGER,
    UNIQUE (turma_id, disciplina_id)
);

CREATE INDEX IF NOT EXISTS idx_turma_disciplinas_turma ON turma_disciplinas(turma_id);
CREATE INDEX IF NOT EXISTS idx_turma_disciplinas_disciplina ON turma_disciplinas(disciplina_id);

-- 3. Adicionar disciplina_id FK a musicas (nullable — musicas antigas mantêm campo texto disciplina)
ALTER TABLE musicas ADD COLUMN IF NOT EXISTS disciplina_id INTEGER REFERENCES disciplinas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_musicas_disciplina_id ON musicas(disciplina_id);

-- Migration 019: Disciplinas e Atividades locais por turma
-- Substitui o modelo global (disciplinas + atividades + turma_disciplinas)
-- por um modelo local: cada turma tem as suas disciplinas e atividades com UUID.

-- 1. Guardar tabela antiga
ALTER TABLE turma_disciplinas RENAME TO turma_disciplinas_old;

-- 2. Nova tabela: disciplinas locais por turma
CREATE TABLE turma_disciplinas (
    id SERIAL PRIMARY KEY,
    turma_id INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT,
    musicas_previstas INTEGER DEFAULT 0,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_turma_disciplinas_turma ON turma_disciplinas(turma_id);

-- 3. Nova tabela: atividades locais por turma-disciplina (UUID como PK)
CREATE TABLE turma_atividades (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    turma_disciplina_id INTEGER NOT NULL REFERENCES turma_disciplinas(id) ON DELETE CASCADE,
    nome VARCHAR(200) NOT NULL,
    codigo VARCHAR(50),
    sessoes_previstas INTEGER DEFAULT 0,
    horas_por_sessao NUMERIC DEFAULT 0,
    musicas_previstas INTEGER DEFAULT 0,
    perfil_mentor VARCHAR(100),
    criado_em TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_turma_atividades_disc ON turma_atividades(turma_disciplina_id);

-- 4. Adicionar coluna atividade_uuid à tabela aulas
ALTER TABLE aulas ADD COLUMN IF NOT EXISTS atividade_uuid UUID REFERENCES turma_atividades(uuid) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_aulas_atividade_uuid ON aulas(atividade_uuid);

-- 5. Migrar dados: turma_disciplinas_old → turma_disciplinas (local)
INSERT INTO turma_disciplinas (turma_id, nome, descricao, musicas_previstas)
SELECT tdo.turma_id, d.nome, d.descricao, d.musicas_previstas
FROM turma_disciplinas_old tdo
JOIN disciplinas d ON d.id = tdo.disciplina_id;

-- 6. Migrar dados: atividades globais → turma_atividades (uma cópia por cada turma que usa a disciplina)
INSERT INTO turma_atividades (turma_disciplina_id, nome, codigo, sessoes_previstas, horas_por_sessao, musicas_previstas, perfil_mentor)
SELECT td.id, a.nome, a.codigo, COALESCE(a.sessoes_padrao, 0), COALESCE(a.horas_padrao, 0), COALESCE(a.producoes_esperadas, 0), a.perfil_mentor
FROM turma_disciplinas td
JOIN turma_disciplinas_old tdo ON tdo.turma_id = td.turma_id
JOIN disciplinas d ON d.id = tdo.disciplina_id AND d.nome = td.nome
JOIN atividades a ON a.disciplina_id = d.id;

-- 7. Mapear aulas.atividade_id → aulas.atividade_uuid
-- Para cada aula com atividade_id, encontrar a turma_atividade correspondente
-- (mesma turma_id + mesmo código de atividade)
UPDATE aulas SET atividade_uuid = ta.uuid
FROM turma_atividades ta
JOIN turma_disciplinas td ON td.id = ta.turma_disciplina_id
JOIN turma_disciplinas_old tdo ON tdo.turma_id = td.turma_id
JOIN disciplinas d ON d.id = tdo.disciplina_id AND d.nome = td.nome
JOIN atividades a ON a.disciplina_id = d.id AND a.codigo = ta.codigo AND a.id = aulas.atividade_id
WHERE aulas.atividade_id IS NOT NULL
  AND aulas.turma_id = td.turma_id;

-- 032_aula_registos.sql
-- Adiciona configuração de digitalização obrigatória aos projetos
-- e tabela para armazenar os registos de sessão uploadados

ALTER TABLE projetos ADD COLUMN IF NOT EXISTS requer_digitalizacao BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS aula_registos (
    id SERIAL PRIMARY KEY,
    aula_id INTEGER NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    criado_por TEXT NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(aula_id)
);

CREATE INDEX IF NOT EXISTS idx_aula_registos_aula_id ON aula_registos(aula_id);

-- 031_aula_participantes.sql
-- Tabela de participantes para sessões do tipo 'outro'

CREATE TABLE IF NOT EXISTS aula_participantes (
    id SERIAL PRIMARY KEY,
    aula_id INTEGER NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(aula_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_aula_participantes_aula_id ON aula_participantes(aula_id);
CREATE INDEX IF NOT EXISTS idx_aula_participantes_user_id ON aula_participantes(user_id);

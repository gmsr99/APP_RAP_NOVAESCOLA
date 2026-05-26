-- Personal financial data on profiles
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS nif VARCHAR(20),
    ADD COLUMN IF NOT EXISTS morada TEXT,
    ADD COLUMN IF NOT EXISTS cod_postal VARCHAR(20),
    ADD COLUMN IF NOT EXISTS funcao TEXT;

-- Honorarium config on projetos
ALTER TABLE projetos
    ADD COLUMN IF NOT EXISTS usa_template_pis BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS honorario_entidade TEXT,
    ADD COLUMN IF NOT EXISTS honorario_morada TEXT,
    ADD COLUMN IF NOT EXISTS honorario_cod_postal VARCHAR(20),
    ADD COLUMN IF NOT EXISTS honorario_nipc VARCHAR(20),
    ADD COLUMN IF NOT EXISTS honorario_designacao TEXT;

-- Per-project hourly rate per user
CREATE TABLE IF NOT EXISTS user_projeto_rates (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    valor_hora NUMERIC(10, 2) NOT NULL DEFAULT 0,
    UNIQUE(user_id, projeto_id)
);

CREATE INDEX IF NOT EXISTS idx_upr_user ON user_projeto_rates(user_id);
CREATE INDEX IF NOT EXISTS idx_upr_projeto ON user_projeto_rates(projeto_id);

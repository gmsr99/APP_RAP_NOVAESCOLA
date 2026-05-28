-- 1. Flag opcional por projeto para activar sub-projetos
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS usar_sub_projetos BOOLEAN DEFAULT FALSE;

-- 2. Tabela de sub-projetos
CREATE TABLE IF NOT EXISTS sub_projetos (
    id SERIAL PRIMARY KEY,
    projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sub_projetos_projeto ON sub_projetos(projeto_id);

-- 3. FK opcional na bridge table projeto_estabelecimentos
ALTER TABLE projeto_estabelecimentos
    ADD COLUMN IF NOT EXISTS sub_projeto_id INTEGER REFERENCES sub_projetos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pe_sub_projeto ON projeto_estabelecimentos(sub_projeto_id);

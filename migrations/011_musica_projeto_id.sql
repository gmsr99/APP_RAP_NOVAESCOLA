-- Migração 011: Adicionar projeto_id à tabela musicas
ALTER TABLE musicas ADD COLUMN IF NOT EXISTS projeto_id INTEGER REFERENCES projetos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_musicas_projeto_id ON musicas(projeto_id);

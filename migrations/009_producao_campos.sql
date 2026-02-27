-- Migração 009: Novos campos para redesign da página Produção

-- Novos campos na tabela musicas
ALTER TABLE musicas ADD COLUMN IF NOT EXISTS deadline DATE;
ALTER TABLE musicas ADD COLUMN IF NOT EXISTS notas TEXT;

-- Novos campos na tabela turmas (para progresso de sessões e produção)
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS sessoes_previstas INTEGER;
ALTER TABLE turmas ADD COLUMN IF NOT EXISTS musicas_previstas INTEGER DEFAULT 7;

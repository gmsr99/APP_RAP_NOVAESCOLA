-- Migration 039: Colunas visíveis do quadro de produção por utilizador
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS producao_cols TEXT[] DEFAULT NULL;
-- NULL = ver todas as colunas (comportamento padrão)

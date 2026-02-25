-- Migração 008: Adicionar user_id à tabela mentores
-- Liga cada mentor ao seu utilizador Supabase Auth

ALTER TABLE mentores ADD COLUMN IF NOT EXISTS user_id UUID;

-- Índice para lookup rápido
CREATE INDEX IF NOT EXISTS idx_mentores_user_id ON mentores(user_id);

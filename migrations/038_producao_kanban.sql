-- Migration 038: Kanban de produção — timestamps para auto-atribuição e regra 24h
ALTER TABLE musicas ADD COLUMN IF NOT EXISTS mistura_atribuida_em TIMESTAMPTZ;
ALTER TABLE musicas ADD COLUMN IF NOT EXISTS edicao_iniciada_em   TIMESTAMPTZ;

-- Sistema de Patentes: hierarquia de permissões configurável
-- Substitui as flags booleanas (is_root, is_direcao, is_coordenacao) por um
-- sistema de níveis ordenados onde cada nível define páginas e ações permitidas.
-- As flags existentes mantêm-se para retrocompatibilidade mas passam a ser
-- derivadas do level_order da patente do utilizador.

CREATE TABLE IF NOT EXISTS permission_levels (
    id              SERIAL       PRIMARY KEY,
    name            VARCHAR(50)  UNIQUE NOT NULL,
    label           VARCHAR(100) NOT NULL,
    level_order     INTEGER      UNIQUE NOT NULL,
    allowed_pages   JSONB        NOT NULL DEFAULT '[]'::jsonb,
    allowed_actions JSONB        NOT NULL DEFAULT '{}'::jsonb,
    is_system       BOOLEAN      NOT NULL DEFAULT FALSE,
    color           VARCHAR(20)  DEFAULT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed dos 5 níveis base (is_system=TRUE — não elimináveis)
INSERT INTO permission_levels (name, label, level_order, allowed_pages, allowed_actions, is_system, color) VALUES

('mentor', 'Mentor', 1,
 '["dashboard","horarios","producao","tarefas","estudio","chat","equipa","wiki","contactos","atalhos","registos","formacao"]'::jsonb,
 '{"sessions.create":false,"sessions.state_override":false,"sessions.export":false,
   "production.lab":false,"production.feedback":false,"production.prioritize":false,"production.delete":false,
   "wiki.edit":false,"projects.manage":false,"tasks.manage":false,
   "registos.export":false,"financial.view_rates":false,"financial.manage_rates":false,
   "team.manage":false,"shortcuts.manage":false,
   "admin.settings":false,"admin.users":false,"admin.audit":false,"admin.roles":false,"admin.patentes":false}'::jsonb,
 TRUE, '#6b7280'),

('produtor', 'Produtor', 2,
 '["dashboard","horarios","producao","tarefas","estudio","chat","equipa","wiki","contactos","atalhos","registos","formacao"]'::jsonb,
 '{"sessions.create":false,"sessions.state_override":false,"sessions.export":false,
   "production.lab":true,"production.feedback":false,"production.prioritize":false,"production.delete":false,
   "wiki.edit":false,"projects.manage":false,"tasks.manage":false,
   "registos.export":false,"financial.view_rates":false,"financial.manage_rates":false,
   "team.manage":false,"shortcuts.manage":false,
   "admin.settings":false,"admin.users":false,"admin.audit":false,"admin.roles":false,"admin.patentes":false}'::jsonb,
 TRUE, '#8b5cf6'),

('coordenador', 'Coordenador', 3,
 '["dashboard","horarios","producao","tarefas","estudio","chat","equipa","wiki","contactos","atalhos","registos","equipamento","estatisticas","formacao"]'::jsonb,
 '{"sessions.create":true,"sessions.state_override":true,"sessions.export":true,
   "production.lab":true,"production.feedback":true,"production.prioritize":true,"production.delete":true,
   "wiki.edit":true,"projects.manage":true,"tasks.manage":true,
   "registos.export":false,"financial.view_rates":false,"financial.manage_rates":false,
   "team.manage":false,"shortcuts.manage":false,
   "admin.settings":false,"admin.users":false,"admin.audit":false,"admin.roles":false,"admin.patentes":false}'::jsonb,
 TRUE, '#3b82f6'),

('direcao', 'Direção', 4,
 '["dashboard","horarios","producao","tarefas","estudio","chat","equipa","wiki","contactos","atalhos","registos","equipamento","estatisticas","formacao","financeiro"]'::jsonb,
 '{"sessions.create":true,"sessions.state_override":true,"sessions.export":true,
   "production.lab":true,"production.feedback":true,"production.prioritize":true,"production.delete":true,
   "wiki.edit":true,"projects.manage":true,"tasks.manage":true,
   "registos.export":true,"financial.view_rates":true,"financial.manage_rates":true,
   "team.manage":true,"shortcuts.manage":true,
   "admin.settings":false,"admin.users":false,"admin.audit":false,"admin.roles":false,"admin.patentes":false}'::jsonb,
 TRUE, '#f59e0b'),

('root', 'Root / IT', 5,
 '["dashboard","horarios","producao","tarefas","estudio","chat","equipa","wiki","contactos","atalhos","registos","equipamento","estatisticas","formacao","financeiro","admin"]'::jsonb,
 '{"sessions.create":true,"sessions.state_override":true,"sessions.export":true,
   "production.lab":true,"production.feedback":true,"production.prioritize":true,"production.delete":true,
   "wiki.edit":true,"projects.manage":true,"tasks.manage":true,
   "registos.export":true,"financial.view_rates":true,"financial.manage_rates":true,
   "team.manage":true,"shortcuts.manage":true,
   "admin.settings":true,"admin.users":true,"admin.audit":true,"admin.roles":true,"admin.patentes":true}'::jsonb,
 TRUE, '#ef4444')

ON CONFLICT (name) DO NOTHING;

-- Adicionar permission_level_id à tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS permission_level_id INTEGER REFERENCES permission_levels(id) ON DELETE SET NULL;

-- Adicionar default_permission_level_id à tabela roles
ALTER TABLE roles ADD COLUMN IF NOT EXISTS default_permission_level_id INTEGER REFERENCES permission_levels(id) ON DELETE SET NULL;

-- Backfill: mapear flags existentes para permission_level_id
UPDATE profiles SET permission_level_id = (SELECT id FROM permission_levels WHERE name = 'root')
    WHERE is_root = TRUE AND permission_level_id IS NULL;

UPDATE profiles SET permission_level_id = (SELECT id FROM permission_levels WHERE name = 'direcao')
    WHERE is_root = FALSE AND is_direcao = TRUE AND permission_level_id IS NULL;

UPDATE profiles SET permission_level_id = (SELECT id FROM permission_levels WHERE name = 'coordenador')
    WHERE is_root = FALSE AND is_direcao = FALSE AND is_coordenacao = TRUE AND permission_level_id IS NULL;

UPDATE profiles SET permission_level_id = (SELECT id FROM permission_levels WHERE name = 'mentor')
    WHERE permission_level_id IS NULL;

-- Backfill: mapear roles conhecidos para patente padrão
UPDATE roles SET default_permission_level_id = (SELECT id FROM permission_levels WHERE name = 'root')
    WHERE name = 'it_support' AND default_permission_level_id IS NULL;

UPDATE roles SET default_permission_level_id = (SELECT id FROM permission_levels WHERE name = 'direcao')
    WHERE name = 'direcao' AND default_permission_level_id IS NULL;

UPDATE roles SET default_permission_level_id = (SELECT id FROM permission_levels WHERE name = 'coordenador')
    WHERE name IN ('coordenador', 'gestor_projeto') AND default_permission_level_id IS NULL;

UPDATE roles SET default_permission_level_id = (SELECT id FROM permission_levels WHERE name = 'produtor')
    WHERE name IN ('produtor', 'mentor_produtor') AND default_permission_level_id IS NULL;

UPDATE roles SET default_permission_level_id = (SELECT id FROM permission_levels WHERE name = 'mentor')
    WHERE default_permission_level_id IS NULL;

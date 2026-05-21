-- 033_roles_permissions.sql
-- Sistema dinâmico de gestão de roles e permissões.
-- Permite definir roles custom, permissões por página e acesso por projeto.

-- 1. Adicionar colunas à tabela profiles
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS is_root BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS project_scoped BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Tabela de roles (sistema + custom)
CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    label       VARCHAR(100) NOT NULL,
    is_system   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Permissões de página por role (defaults para novos utilizadores)
CREATE TABLE IF NOT EXISTS role_page_permissions (
    id        SERIAL PRIMARY KEY,
    role_id   INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    page_slug VARCHAR(50) NOT NULL,
    UNIQUE(role_id, page_slug)
);

-- 4. Overrides de permissão por utilizador (sobrescreve o default do role)
CREATE TABLE IF NOT EXISTS user_page_permissions (
    id        SERIAL PRIMARY KEY,
    user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    page_slug VARCHAR(50) NOT NULL,
    granted   BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(user_id, page_slug)
);
-- granted=TRUE  → concede acesso mesmo que o role não tenha
-- granted=FALSE → remove acesso mesmo que o role tenha

-- 5. Acesso a projetos por utilizador (project_scoped=TRUE usa esta tabela)
CREATE TABLE IF NOT EXISTS user_project_access (
    id         SERIAL PRIMARY KEY,
    user_id    UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
    UNIQUE(user_id, projeto_id)
);

CREATE INDEX IF NOT EXISTS idx_upa_user_id   ON user_project_access(user_id);
CREATE INDEX IF NOT EXISTS idx_upp_user_id   ON user_page_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_rpp_role_id   ON role_page_permissions(role_id);

-- 6. Seed dos roles de sistema
INSERT INTO roles (name, label, is_system) VALUES
    ('mentor',          'Mentor',            TRUE),
    ('produtor',        'Produtor',          TRUE),
    ('mentor_produtor', 'Mentor / Produtor', TRUE),
    ('coordenador',     'Coordenador',       TRUE),
    ('direcao',         'Direção',           TRUE),
    ('it_support',      'IT Support',        TRUE),
    ('videomaker',      'Videomaker',        TRUE),
    ('gestor_projeto',  'Gestor de Projeto', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 7. Seed das permissões de página por role
-- Páginas disponíveis: dashboard, horarios, producao, tarefas, estudio, chat,
--   equipa, wiki, contactos, atalhos, registos, equipamento, estatisticas, formacao, admin

-- mentor, produtor, mentor_produtor: tudo exceto equipamento, estatisticas, admin
INSERT INTO role_page_permissions (role_id, page_slug)
SELECT r.id, p.slug
FROM roles r
CROSS JOIN (VALUES
    ('dashboard'), ('horarios'), ('producao'), ('tarefas'), ('estudio'),
    ('chat'), ('equipa'), ('wiki'), ('contactos'), ('atalhos'),
    ('registos'), ('formacao')
) AS p(slug)
WHERE r.name IN ('mentor', 'produtor', 'mentor_produtor')
ON CONFLICT DO NOTHING;

-- coordenador: acima + equipamento + estatisticas
INSERT INTO role_page_permissions (role_id, page_slug)
SELECT r.id, p.slug
FROM roles r
CROSS JOIN (VALUES
    ('dashboard'), ('horarios'), ('producao'), ('tarefas'), ('estudio'),
    ('chat'), ('equipa'), ('wiki'), ('contactos'), ('atalhos'),
    ('registos'), ('formacao'), ('equipamento'), ('estatisticas')
) AS p(slug)
WHERE r.name = 'coordenador'
ON CONFLICT DO NOTHING;

-- direcao, it_support: todas as páginas + admin
INSERT INTO role_page_permissions (role_id, page_slug)
SELECT r.id, p.slug
FROM roles r
CROSS JOIN (VALUES
    ('dashboard'), ('horarios'), ('producao'), ('tarefas'), ('estudio'),
    ('chat'), ('equipa'), ('wiki'), ('contactos'), ('atalhos'),
    ('registos'), ('formacao'), ('equipamento'), ('estatisticas'), ('admin')
) AS p(slug)
WHERE r.name IN ('direcao', 'it_support')
ON CONFLICT DO NOTHING;

-- videomaker: como mentor mas SEM registos
INSERT INTO role_page_permissions (role_id, page_slug)
SELECT r.id, p.slug
FROM roles r
CROSS JOIN (VALUES
    ('dashboard'), ('horarios'), ('producao'), ('tarefas'), ('estudio'),
    ('chat'), ('equipa'), ('wiki'), ('contactos'), ('atalhos'), ('formacao')
) AS p(slug)
WHERE r.name = 'videomaker'
ON CONFLICT DO NOTHING;

-- gestor_projeto: todas as páginas
INSERT INTO role_page_permissions (role_id, page_slug)
SELECT r.id, p.slug
FROM roles r
CROSS JOIN (VALUES
    ('dashboard'), ('horarios'), ('producao'), ('tarefas'), ('estudio'),
    ('chat'), ('equipa'), ('wiki'), ('contactos'), ('atalhos'),
    ('registos'), ('formacao'), ('equipamento'), ('estatisticas'), ('admin')
) AS p(slug)
WHERE r.name = 'gestor_projeto'
ON CONFLICT DO NOTHING;

-- 8. Marcar direcao e it_support como root (acesso total sem checks)
UPDATE profiles
SET is_root = TRUE
WHERE role IN ('direcao', 'it_support');

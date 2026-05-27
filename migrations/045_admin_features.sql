-- Feature flags por módulo
INSERT INTO system_settings (key, value, label, description) VALUES
  ('module_chat_enabled',         'true'::jsonb, 'Módulo Chat',         'Ativa/desativa o módulo de chat para todos os utilizadores.'),
  ('module_financeiro_enabled',   'true'::jsonb, 'Módulo Financeiro',   'Ativa/desativa o módulo financeiro (honorários).'),
  ('module_estudio_enabled',      'true'::jsonb, 'Módulo Estúdio',      'Ativa/desativa o módulo de reserva de estúdio.'),
  ('module_wiki_enabled',         'true'::jsonb, 'Módulo Wiki',         'Ativa/desativa o módulo de wiki e curriculum.'),
  ('module_formacao_enabled',     'true'::jsonb, 'Módulo Formação',     'Ativa/desativa o módulo de formação.'),
  ('module_equipamento_enabled',  'true'::jsonb, 'Módulo Material',     'Ativa/desativa o módulo de gestão de equipamento.'),
  ('module_estatisticas_enabled', 'true'::jsonb, 'Módulo Estatísticas', 'Ativa/desativa o módulo de estatísticas.')
ON CONFLICT (key) DO NOTHING;

-- Branding / Identidade da aplicação
INSERT INTO system_settings (key, value, label, description) VALUES
  ('app_name',          '"RAP Nova Escola"'::jsonb, 'Nome da Aplicação', 'Nome exibido na sidebar, exportações e browser tab.'),
  ('app_logo_url',      '""'::jsonb,               'URL do Logo',       'URL público do logo. Se vazio, usa o logo padrão.'),
  ('app_support_email', '""'::jsonb,               'Email de Suporte',  'Email de contacto exibido em páginas de erro e no login.'),
  ('app_primary_color', '"#3399ce"'::jsonb,        'Cor Primária',      'Cor primária da app em formato HEX (ex: #3399ce).')
ON CONFLICT (key) DO NOTHING;

-- Registo de auditoria de ações admin
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL    PRIMARY KEY,
  user_id     UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  user_email  TEXT,
  action      TEXT         NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  details     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx    ON audit_logs (user_id);

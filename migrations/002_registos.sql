-- ==============================================================================
-- MIGRAÇÃO 002: Tabela de Registos de Sessão
-- ==============================================================================
-- Executar no SQL Editor do Supabase (ou via psql)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS registos (
  id              SERIAL PRIMARY KEY,
  aula_id         INTEGER NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL,
  numero_sessao   TEXT,
  objetivos_gerais TEXT,
  sumario         TEXT,
  participantes   JSONB DEFAULT '[]',
  criado_em       TIMESTAMPTZ DEFAULT NOW(),

  -- Cada sessão só pode ter um registo ativo
  CONSTRAINT unique_aula_registo UNIQUE (aula_id)
);

COMMENT ON TABLE  registos                    IS 'Registos de atividade — um por sessão (aula)';
COMMENT ON COLUMN registos.aula_id            IS 'FK para a sessão no calendário (aulas.id)';
COMMENT ON COLUMN registos.user_id            IS 'UUID do membro que criou o registo';
COMMENT ON COLUMN registos.numero_sessao      IS 'Nº da sessão (pode ser sequencial ou livre)';
COMMENT ON COLUMN registos.objetivos_gerais   IS 'Campo de texto livre — objetivos da sessão';
COMMENT ON COLUMN registos.sumario            IS 'Resumo da atividade desenvolvida';
COMMENT ON COLUMN registos.participantes      IS 'Array JSON de { nome_completo, assinatura }';

-- ==============================================================================
-- Colunas adicionais para guardar dados editáveis do formulário
-- (executar se a tabela já existir)
-- ==============================================================================
ALTER TABLE registos ADD COLUMN IF NOT EXISTS atividade   TEXT;
ALTER TABLE registos ADD COLUMN IF NOT EXISTS data_registo TEXT;
ALTER TABLE registos ADD COLUMN IF NOT EXISTS local_registo TEXT;
ALTER TABLE registos ADD COLUMN IF NOT EXISTS horario     TEXT;
ALTER TABLE registos ADD COLUMN IF NOT EXISTS tecnicos    TEXT;

-- ==============================================================================
-- Verificação
-- ==============================================================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'registos'
ORDER BY ordinal_position;

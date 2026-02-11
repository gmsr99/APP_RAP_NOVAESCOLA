-- ==============================================================================
-- SCHEMA SQL - RAP NOVA ESCOLA
-- Obtido via MCP Supabase (list_tables) – reflete o estado atual da base
-- ==============================================================================
-- Data: 2025-02-03
-- ==============================================================================

-- ==============================================================================
-- TABELA: projetos
-- ==============================================================================
CREATE TABLE IF NOT EXISTS projetos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    data_inicio DATE,
    data_fim DATE,
    estado VARCHAR(50) DEFAULT 'planejamento',
    observacoes TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE projetos IS 'Projetos educativos (ex: RAP Nova Escola 2024)';

-- ==============================================================================
-- TABELA: instituicoes
-- ==============================================================================
CREATE TABLE IF NOT EXISTS instituicoes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) DEFAULT 'escola',
    morada TEXT,
    codigo_postal VARCHAR(20),
    cidade VARCHAR(100),
    telefone VARCHAR(50),
    email VARCHAR(255),
    pessoa_contacto VARCHAR(255),
    observacoes TEXT,
    ativa BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE instituicoes IS 'Escolas e instituições parceiras';

-- ==============================================================================
-- TABELA: turmas
-- ==============================================================================
CREATE TABLE IF NOT EXISTS turmas (
    id SERIAL PRIMARY KEY,
    instituicao_id INTEGER NOT NULL REFERENCES instituicoes(id),
    nome VARCHAR(255) NOT NULL,
    ano_escolar VARCHAR(20),
    numero_alunos INTEGER,
    faixa_etaria VARCHAR(50),
    nivel_rap VARCHAR(50) DEFAULT 'iniciante',
    observacoes TEXT,
    ativa BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE turmas IS 'Turmas/grupos de alunos';

-- ==============================================================================
-- TABELA: mentores
-- ==============================================================================
CREATE TABLE IF NOT EXISTS mentores (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    telefone VARCHAR(50),
    perfil VARCHAR(50) DEFAULT 'generalista',
    biografia TEXT,
    disponibilidade TEXT,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE mentores IS 'Formadores/mentores que dão as aulas';

-- ==============================================================================
-- TABELA: aulas
-- ==============================================================================
CREATE TABLE IF NOT EXISTS aulas (
    id SERIAL PRIMARY KEY,
    projeto_id INTEGER REFERENCES projetos(id),
    turma_id INTEGER NOT NULL REFERENCES turmas(id),
    mentor_id INTEGER NOT NULL REFERENCES mentores(id),
    tipo VARCHAR(50) DEFAULT 'pratica_escrita',
    data_hora TIMESTAMP NOT NULL,
    duracao_minutos INTEGER DEFAULT 90,
    estado VARCHAR(50) DEFAULT 'agendada',
    local VARCHAR(255),
    tema VARCHAR(255),
    objetivos TEXT,
    observacoes TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE aulas IS 'Sessões/aulas (tabela principal do sistema)';

-- ==============================================================================
-- TABELA: equipamentos
-- ==============================================================================
CREATE TABLE IF NOT EXISTS equipamentos (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    nome VARCHAR(255) NOT NULL,
    codigo VARCHAR(100) UNIQUE,
    quantidade_total INTEGER DEFAULT 1,
    quantidade_disponivel INTEGER DEFAULT 1,
    estado VARCHAR(50) DEFAULT 'operacional',
    localizacao VARCHAR(255),
    observacoes TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE equipamentos IS 'Inventário de equipamento (microfones, headphones, etc)';

-- ==============================================================================
-- TABELA: logs
-- ==============================================================================
CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    tipo_acao VARCHAR(50) NOT NULL,
    entidade VARCHAR(50) NOT NULL,
    entidade_id INTEGER,
    descricao TEXT NOT NULL,
    usuario VARCHAR(255),
    dados_adicionais TEXT,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE logs IS 'Histórico de ações (auditoria)';

-- ==============================================================================
-- ÍNDICES (opcional; criar se não existirem no Supabase)
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_aulas_turma_id ON aulas(turma_id);
CREATE INDEX IF NOT EXISTS idx_aulas_mentor_id ON aulas(mentor_id);
CREATE INDEX IF NOT EXISTS idx_aulas_projeto_id ON aulas(projeto_id);
CREATE INDEX IF NOT EXISTS idx_aulas_estado ON aulas(estado);
CREATE INDEX IF NOT EXISTS idx_aulas_data_hora ON aulas(data_hora);

CREATE INDEX IF NOT EXISTS idx_turmas_instituicao_id ON turmas(instituicao_id);

CREATE INDEX IF NOT EXISTS idx_logs_entidade ON logs(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_logs_tipo_acao ON logs(tipo_acao);
CREATE INDEX IF NOT EXISTS idx_logs_criado_em ON logs(criado_em);

CREATE INDEX IF NOT EXISTS idx_equipamentos_tipo ON equipamentos(tipo);
CREATE INDEX IF NOT EXISTS idx_equipamentos_estado ON equipamentos(estado);
CREATE INDEX IF NOT EXISTS idx_equipamentos_codigo ON equipamentos(codigo);

-- ==============================================================================
-- FIM DO SCHEMA
-- ==============================================================================

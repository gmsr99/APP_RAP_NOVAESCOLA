-- 025: Adiciona índices em falta para melhorar performance de queries frequentes
-- Colunas frequentemente usadas em WHERE, JOIN e ORDER BY sem índice

-- aulas: filtros por responsável, música e estado
CREATE INDEX IF NOT EXISTS idx_aulas_responsavel_user_id ON aulas(responsavel_user_id);
CREATE INDEX IF NOT EXISTS idx_aulas_musica_id ON aulas(musica_id);
CREATE INDEX IF NOT EXISTS idx_aulas_turma_id ON aulas(turma_id);
CREATE INDEX IF NOT EXISTS idx_aulas_mentor_id ON aulas(mentor_id);
CREATE INDEX IF NOT EXISTS idx_aulas_projeto_id ON aulas(projeto_id);

-- musicas: filtros por estado, turma, arquivo e responsável
CREATE INDEX IF NOT EXISTS idx_musicas_estado ON musicas(estado);
CREATE INDEX IF NOT EXISTS idx_musicas_turma_id ON musicas(turma_id);
CREATE INDEX IF NOT EXISTS idx_musicas_arquivado ON musicas(arquivado);
CREATE INDEX IF NOT EXISTS idx_musicas_criador_id ON musicas(criador_id);
CREATE INDEX IF NOT EXISTS idx_musicas_responsavel_id ON musicas(responsavel_id);

-- turma_disciplinas: lookup por turma
CREATE INDEX IF NOT EXISTS idx_turma_disciplinas_turma_id ON turma_disciplinas(turma_id);

-- turma_atividades: lookup por disciplina
CREATE INDEX IF NOT EXISTS idx_turma_atividades_turma_disciplina_id ON turma_atividades(turma_disciplina_id);

-- registos: filtro por utilizador
CREATE INDEX IF NOT EXISTS idx_registos_user_id ON registos(user_id);

-- projeto_estabelecimentos: lookup por estabelecimento
CREATE INDEX IF NOT EXISTS idx_projeto_estabelecimentos_estabelecimento_id ON projeto_estabelecimentos(estabelecimento_id);

-- equipamento_historico: lookup por aula
CREATE INDEX IF NOT EXISTS idx_equipamento_historico_aula_id ON equipamento_historico(aula_id);

-- kit_itens: lookup por localização
CREATE INDEX IF NOT EXISTS idx_kit_itens_localizacao_tipo ON kit_itens(localizacao_tipo) WHERE localizacao_tipo IS NOT NULL;

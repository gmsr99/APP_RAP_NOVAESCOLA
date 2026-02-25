-- Tabela bridge N:N entre projetos e estabelecimentos
CREATE TABLE IF NOT EXISTS projeto_estabelecimentos (
  projeto_id INTEGER NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
  estabelecimento_id INTEGER NOT NULL REFERENCES estabelecimentos(id) ON DELETE CASCADE,
  PRIMARY KEY (projeto_id, estabelecimento_id)
);

-- Criar projeto default PIS e associar todos os estabelecimentos existentes
INSERT INTO projetos (nome) VALUES ('PIS') ON CONFLICT DO NOTHING;

INSERT INTO projeto_estabelecimentos (projeto_id, estabelecimento_id)
  SELECT p.id, e.id
  FROM projetos p, estabelecimentos e
  WHERE p.nome = 'PIS'
  ON CONFLICT DO NOTHING;

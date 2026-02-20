-- ==============================================================================
-- MIGRAÇÃO 004: Reconstruir Sistema de Equipamento (Categorias + Itens)
-- ==============================================================================
-- Executar no SQL Editor do Supabase (ou via psql)
-- ==============================================================================

-- ─── Remover FK de aulas para equipments ─────────────────────────────────────
ALTER TABLE aulas DROP CONSTRAINT IF EXISTS aulas_equipamento_id_fkey;
ALTER TABLE aulas DROP COLUMN IF EXISTS equipamento_id;

-- ─── Limpeza de tabelas antigas ──────────────────────────────────────────────
DROP TABLE IF EXISTS equipments;
DROP TABLE IF EXISTS equipamentos;

-- ─── Novas tabelas ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kit_categorias (
  id   SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS kit_itens (
  id           SERIAL PRIMARY KEY,
  categoria_id INTEGER NOT NULL REFERENCES kit_categorias(id) ON DELETE CASCADE,
  nome         VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS aula_equipamento (
  id      SERIAL PRIMARY KEY,
  aula_id INTEGER NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES kit_itens(id) ON DELETE CASCADE,
  UNIQUE(aula_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_aula_equipamento_aula ON aula_equipamento(aula_id);
CREATE INDEX IF NOT EXISTS idx_aula_equipamento_item ON aula_equipamento(item_id);

-- ─── Dados iniciais ─────────────────────────────────────────────────────────

INSERT INTO kit_categorias (nome) VALUES
  ('Equipamento Aula Teórica'),
  ('Equipamento Gravação');

-- Aula Teórica (4 itens)
INSERT INTO kit_itens (categoria_id, nome) VALUES
  ((SELECT id FROM kit_categorias WHERE nome = 'Equipamento Aula Teórica'), 'Computador'),
  ((SELECT id FROM kit_categorias WHERE nome = 'Equipamento Aula Teórica'), 'Coluna Portátil'),
  ((SELECT id FROM kit_categorias WHERE nome = 'Equipamento Aula Teórica'), 'Apontador de Apresentação'),
  ((SELECT id FROM kit_categorias WHERE nome = 'Equipamento Aula Teórica'), 'Apresentação Canva');

-- Gravação (8 itens)
INSERT INTO kit_itens (categoria_id, nome) VALUES
  ((SELECT id FROM kit_categorias WHERE nome = 'Equipamento Gravação'), 'Computador com software de gravação'),
  ((SELECT id FROM kit_categorias WHERE nome = 'Equipamento Gravação'), 'Interface de áudio'),
  ((SELECT id FROM kit_categorias WHERE nome = 'Equipamento Gravação'), 'Microfone'),
  ((SELECT id FROM kit_categorias WHERE nome = 'Equipamento Gravação'), 'Cabo XLR'),
  ((SELECT id FROM kit_categorias WHERE nome = 'Equipamento Gravação'), '2 headphones (+ spliter / jacks)'),
  ((SELECT id FROM kit_categorias WHERE nome = 'Equipamento Gravação'), 'Tripé'),
  ((SELECT id FROM kit_categorias WHERE nome = 'Equipamento Gravação'), 'Pop filter'),
  ((SELECT id FROM kit_categorias WHERE nome = 'Equipamento Gravação'), 'Monitores de estúdio');

-- ─── Verificação ─────────────────────────────────────────────────────────────

SELECT kc.nome AS categoria, ki.nome AS item
FROM kit_itens ki
JOIN kit_categorias kc ON ki.categoria_id = kc.id
ORDER BY kc.nome, ki.id;

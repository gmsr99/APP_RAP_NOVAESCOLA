-- ==============================================================================
-- MIGRACAO 018: Sistema de Equipamento Individual sincronizado com Sessoes
-- ==============================================================================
-- Estende kit_itens com identificador unico, UUID e estado.
-- Localizacao, ultimo responsavel e ultima utilizacao sao DERIVADOS
-- automaticamente das sessoes (aulas + aula_equipamento).
-- Cria tabela de historico de utilizacao para auditoria.
-- Remove "Computador" e "Apresentacao Canva" da gestao de material.
-- ==============================================================================

-- 1. Adicionar colunas a kit_itens (apenas as que sao geridas diretamente)
ALTER TABLE kit_itens ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT gen_random_uuid() NOT NULL;
ALTER TABLE kit_itens ADD COLUMN IF NOT EXISTS identificador VARCHAR(100);
ALTER TABLE kit_itens ADD COLUMN IF NOT EXISTS estado VARCHAR(50) DEFAULT 'excelente';
ALTER TABLE kit_itens ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Indice unico no UUID
CREATE UNIQUE INDEX IF NOT EXISTS idx_kit_itens_uuid ON kit_itens(uuid);

-- 2. Tabela de historico completo de utilizacao (auditoria)
CREATE TABLE IF NOT EXISTS equipamento_historico (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES kit_itens(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    user_nome VARCHAR(255),
    data_utilizacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    aula_id INTEGER REFERENCES aulas(id) ON DELETE SET NULL,
    observacoes TEXT
);

CREATE INDEX IF NOT EXISTS idx_equip_hist_item ON equipamento_historico(item_id);
CREATE INDEX IF NOT EXISTS idx_equip_hist_user ON equipamento_historico(user_id);
CREATE INDEX IF NOT EXISTS idx_equip_hist_data ON equipamento_historico(data_utilizacao);

-- 3. Remover "Computador" e "Apresentacao Canva" da gestao de material
DELETE FROM aula_equipamento WHERE item_id IN (
    SELECT id FROM kit_itens WHERE nome IN ('Computador', 'Apresentacao Canva')
);
DELETE FROM kit_itens WHERE nome IN ('Computador', 'Apresentacao Canva');

-- 4. Definir identificador para itens existentes (que ainda nao tem)
UPDATE kit_itens SET identificador = nome || ' 01' WHERE identificador IS NULL;

-- 5. Expandir itens genericos em individuais (seed data)
--    Microfone -> 3 unidades
INSERT INTO kit_itens (categoria_id, nome, identificador, estado)
SELECT categoria_id, 'Microfone', 'Microfone 02', 'excelente'
FROM kit_itens WHERE identificador = 'Microfone 01'
ON CONFLICT DO NOTHING;

INSERT INTO kit_itens (categoria_id, nome, identificador, estado)
SELECT categoria_id, 'Microfone', 'Microfone 03', 'excelente'
FROM kit_itens WHERE identificador = 'Microfone 01'
ON CONFLICT DO NOTHING;

--    Cabo XLR -> 3 unidades
INSERT INTO kit_itens (categoria_id, nome, identificador, estado)
SELECT categoria_id, 'Cabo XLR', 'Cabo XLR 02', 'excelente'
FROM kit_itens WHERE identificador = 'Cabo XLR 01'
ON CONFLICT DO NOTHING;

INSERT INTO kit_itens (categoria_id, nome, identificador, estado)
SELECT categoria_id, 'Cabo XLR', 'Cabo XLR 03', 'excelente'
FROM kit_itens WHERE identificador = 'Cabo XLR 01'
ON CONFLICT DO NOTHING;

--    Headphones -> separar em unidades individuais
UPDATE kit_itens SET nome = 'Headphones', identificador = 'Headphones 01'
WHERE identificador = '2 headphones (+ spliter / jacks) 01';

INSERT INTO kit_itens (categoria_id, nome, identificador, estado)
SELECT categoria_id, 'Headphones', 'Headphones 02', 'excelente'
FROM kit_itens WHERE identificador = 'Headphones 01'
ON CONFLICT DO NOTHING;

--    Splitter/Jacks como item separado
INSERT INTO kit_itens (categoria_id, nome, identificador, estado)
SELECT categoria_id, 'Splitter / Jacks', 'Splitter / Jacks 01', 'excelente'
FROM kit_itens WHERE identificador = 'Headphones 01'
ON CONFLICT DO NOTHING;

-- 6. Indice unico no identificador
CREATE UNIQUE INDEX IF NOT EXISTS idx_kit_itens_identificador ON kit_itens(identificador);

-- 7. Verificacao
SELECT ki.uuid, ki.identificador, ki.nome, kc.nome AS categoria, ki.estado
FROM kit_itens ki
JOIN kit_categorias kc ON ki.categoria_id = kc.id
ORDER BY kc.nome, ki.identificador;

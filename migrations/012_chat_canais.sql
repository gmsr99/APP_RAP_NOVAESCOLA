-- Migração 012: Reorganizar canais de chat com estrutura Slack-like

-- 1. Adicionar coluna description
ALTER TABLE chat_channels ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Renomear e descrever os canais existentes
UPDATE chat_channels
SET name = '01 - Equipa Geral',
    description = 'Comunicação geral e afinamento da equipa'
WHERE name = 'Geral' AND type = 'channel';

UPDATE chat_channels
SET name = '02 - Aulas de Clubes',
    description = 'Produção no terreno: aulas, clubes e sessões'
WHERE name = 'Mentores' AND type = 'channel';

UPDATE chat_channels
SET name = '03 - Produção',
    description = 'Criação musical desde o rascunho até à versão final'
WHERE name = 'Producao' AND type = 'channel';

-- 3. Criar canais novos (idempotente — salta se já existir)
INSERT INTO chat_channels (name, description, type)
SELECT nome, descricao, 'channel'
FROM (VALUES
  ('04 - Comunicação e Marketing', 'Comunicados oficiais, sem ruído e com mensagem clara'),
  ('05 - Documentos e Registos',   'Tudo bem registado para a história ficar documentada'),
  ('06 - Material e Equipamentos', 'Material afinado, som limpo e sem falhas')
) AS t(nome, descricao)
WHERE NOT EXISTS (
  SELECT 1 FROM chat_channels WHERE name = t.nome AND type = 'channel'
);

-- 4. Garantir que todos os utilizadores são membros de todos os canais públicos
INSERT INTO chat_members (channel_id, user_id)
SELECT c.id, p.id
FROM chat_channels c
CROSS JOIN profiles p
WHERE c.type = 'channel'
ON CONFLICT DO NOTHING;

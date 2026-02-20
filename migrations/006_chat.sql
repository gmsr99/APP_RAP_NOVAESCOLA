-- ==============================================================================
-- MIGRACAO 006: Chat em Tempo Real
-- ==============================================================================
-- Executar no SQL Editor do Supabase (ou via psql)
-- ==============================================================================

-- 1. Canais (grupo ou DM)
CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT '',
  type VARCHAR(10) NOT NULL CHECK (type IN ('channel', 'dm')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Membros de cada canal
CREATE TABLE IF NOT EXISTS chat_members (
  id SERIAL PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- 3. Mensagens
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_created
  ON chat_messages(channel_id, created_at DESC);

-- 4. Read receipts (ultimo read por user/canal)
CREATE TABLE IF NOT EXISTS chat_read_receipts (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES chat_channels(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, channel_id)
);

-- ==============================================================================
-- Funcao helper SECURITY DEFINER (evita recursao infinita nas RLS policies)
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_my_channel_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT channel_id FROM chat_members WHERE user_id = auth.uid();
$$;

-- ==============================================================================
-- RLS Policies
-- ==============================================================================

ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_read_receipts ENABLE ROW LEVEL SECURITY;

-- chat_channels: user pode ver canais a que pertence
CREATE POLICY "Users can view their channels"
  ON chat_channels FOR SELECT
  USING (id IN (SELECT get_my_channel_ids()));

-- chat_members: user pode ver membros dos seus canais
CREATE POLICY "Users can view channel members"
  ON chat_members FOR SELECT
  USING (channel_id IN (SELECT get_my_channel_ids()));

-- chat_messages: SELECT se membro do canal
CREATE POLICY "Users can read messages in their channels"
  ON chat_messages FOR SELECT
  USING (channel_id IN (SELECT get_my_channel_ids()));

-- chat_messages: INSERT se membro do canal E sender_id = auth.uid()
CREATE POLICY "Users can send messages to their channels"
  ON chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND channel_id IN (SELECT get_my_channel_ids())
  );

-- chat_read_receipts: user so gere os seus
CREATE POLICY "Users can manage own read receipts"
  ON chat_read_receipts FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ==============================================================================
-- Realtime (critico para entrega instantanea)
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- ==============================================================================
-- Seed: Canais default
-- ==============================================================================
INSERT INTO chat_channels (name, type) VALUES
  ('Geral', 'channel'),
  ('Mentores', 'channel'),
  ('Producao', 'channel')
ON CONFLICT DO NOTHING;

-- Adicionar todos os profiles existentes a todos os canais default
INSERT INTO chat_members (channel_id, user_id)
SELECT c.id, p.id
FROM chat_channels c
CROSS JOIN profiles p
WHERE c.type = 'channel'
ON CONFLICT DO NOTHING;

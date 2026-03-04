-- Migração 013: Gatilho automático para adicionar novos utilizadores aos canais de chat

-- 1. Função: Adicionar utilizador aos canais de chat públicos
CREATE OR REPLACE FUNCTION public.handle_new_user_chat_channels()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir o novo utilizador (NEW.id) em todos os canais do tipo 'channel'
  INSERT INTO public.chat_members (channel_id, user_id)
  SELECT id, NEW.id
  FROM public.chat_channels
  WHERE type = 'channel'
  ON CONFLICT (channel_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Gatilho (Trigger): Ativado sempre que um novo registo é inserido na tabela 'profiles'
DROP TRIGGER IF EXISTS on_profile_created_chat_channels ON public.profiles;
CREATE TRIGGER on_profile_created_chat_channels
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_chat_channels();

-- 3. Backfill: Garantir que todos os utilizadores existentes já estão nos canais
--    (Cobre qualquer utilizador, como produtores, criado entre a migração inicial de chat e agora)
INSERT INTO public.chat_members (channel_id, user_id)
SELECT c.id, p.id
FROM public.chat_channels c
CROSS JOIN public.profiles p
WHERE c.type = 'channel'
ON CONFLICT (channel_id, user_id) DO NOTHING;

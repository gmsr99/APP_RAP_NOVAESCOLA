-- ==============================================================================
-- MIGRAÇÃO 019: Automate Avatar Sync from Storage
-- ==============================================================================
-- Cria um trigger na tabela storage.objects que atualiza automaticamente
-- o avatar_url na tabela profiles sempre que um novo avatar é inserido ou atualizado.
-- ==============================================================================

-- Função para atualizar o profile quando há um novo ficheiro no bucket avatars
CREATE OR REPLACE FUNCTION public.sync_avatar_from_storage()
RETURNS TRIGGER AS $$
DECLARE
  user_id UUID;
  public_url TEXT;
BEGIN
  -- Verificar se o ficheiro foi para o bucket 'avatars'
  IF NEW.bucket_id = 'avatars' THEN
    -- Extrair o ID do utilizador (a primeira parte do caminho antes da "/")
    user_id := (string_to_array(NEW.name, '/'))[1]::UUID;
    
    -- Construir o URL público dinâmico
    public_url := 'https://dhzvbbxvvrxwxtcpbfqp.supabase.co/storage/v1/object/public/avatars/' || NEW.name;

    -- Atualizar a tabela profiles se o utilizador existir
    UPDATE public.profiles
    SET avatar_url = public_url,
        updated_at = NOW()
    WHERE id = user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar o trigger na tabela storage.objects do Supabase
DROP TRIGGER IF EXISTS on_avatar_upload ON storage.objects;
CREATE TRIGGER on_avatar_upload
  AFTER INSERT OR UPDATE ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_avatar_from_storage();

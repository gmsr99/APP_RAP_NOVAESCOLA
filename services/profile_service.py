from supabase import create_client
import os

# Initialize Supabase client
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
supabase = create_client(supabase_url, supabase_key)

def listar_perfis():
    """
    Lista todos os perfis de utilizadores (equipa) da tabela public.profiles.
    Retorna uma lista de dicionários com id, nome, email, role, avatar.
    """
    try:
        response = supabase.table("profiles").select("*").execute()
        return response.data
    except Exception as e:
        print(f"Erro ao listar perfis: {e}")
        return []

def obter_profile_id_por_email(email):
    """
    Obtém o UUID do perfil através do email.
    """
    try:
        response = supabase.table("profiles").select("id").eq("email", email).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]['id']
        return None
    except Exception as e:
        print(f"Erro ao obter ID do perfil: {e}")
        return None

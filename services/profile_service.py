from supabase import create_client
import os
import logging

logger = logging.getLogger(__name__)

# Initialize Supabase client
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
supabase = create_client(supabase_url, supabase_key)

def listar_perfis():
    """
    Lista todos os perfis de utilizadores (equipa) da tabela public.profiles.
    O avatar_url é lido do auth metadata (fonte de verdade) com fallback para profiles.avatar_url.
    """
    try:
        from database.connection import get_db_connection
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                p.id,
                p.email,
                p.full_name,
                p.role,
                COALESCE(au.raw_user_meta_data->>'avatar_url', p.avatar_url) AS avatar_url,
                p.created_at,
                p.updated_at,
                p.producao_cols,
                p.nif,
                p.morada,
                p.cod_postal,
                p.funcao
            FROM profiles p
            JOIN auth.users au ON au.id = p.id
            ORDER BY p.full_name
        """)
        cols = [desc[0] for desc in cur.description]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        logger.error(f"Erro ao listar perfis: {e}")
        return []

def apagar_utilizador(user_id: str):
    """
    Apaga permanentemente um utilizador do Supabase Auth e da tabela profiles.
    """
    try:
        # Remove do Supabase Auth (cascade remove da tabela profiles se configurado)
        supabase.auth.admin.delete_user(user_id)
        # Garantir remoção da tabela profiles
        supabase.table("profiles").delete().eq("id", user_id).execute()
        return True
    except Exception as e:
        logger.error(f"Erro ao apagar utilizador {user_id}: {e}")
        raise e

def atualizar_membro(user_id: str, dados: dict):
    """
    Atualiza dados de um membro (full_name, role, avatar_url).
    Atualiza tanto a tabela profiles como os metadados do Supabase Auth.
    """
    try:
        from database.connection import get_db_connection
        conn = get_db_connection()
        cur = conn.cursor()
        campos = []
        valores = []
        for campo in ('full_name', 'role', 'avatar_url'):
            if campo in dados and dados[campo] is not None:
                campos.append(f"{campo} = %s")
                valores.append(dados[campo])
        if campos:
            valores.append(user_id)
            cur.execute(
                f"UPDATE profiles SET {', '.join(campos)}, updated_at = NOW() WHERE id = %s",
                valores
            )
            conn.commit()
        cur.close()
        conn.close()
        # Sincronizar metadados do Supabase Auth
        meta_update = {k: dados[k] for k in ('full_name', 'role', 'avatar_url') if k in dados and dados[k] is not None}
        if meta_update:
            supabase.auth.admin.update_user_by_id(user_id, {"user_metadata": meta_update})
        return True
    except Exception as e:
        logger.error(f"Erro ao atualizar membro {user_id}: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False


def atualizar_producao_cols(user_id: str, cols):
    """Define as colunas visíveis da página de produção para um utilizador. None = todas."""
    try:
        from database.connection import get_db_connection
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE profiles SET producao_cols = %s, updated_at = NOW() WHERE id = %s",
            (cols, user_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Erro ao atualizar producao_cols de {user_id}: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False


def atualizar_dados_financeiros(
    user_id: str,
    nif: str | None,
    morada: str | None,
    cod_postal: str | None,
    funcao: str | None,
    matricula_viatura: str | None = None,
) -> bool:
    """Atualiza os dados financeiros pessoais de um utilizador."""
    try:
        from database.connection import get_db_connection
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE profiles SET nif = %s, morada = %s, cod_postal = %s, funcao = %s, "
            "matricula_viatura = %s, updated_at = NOW() WHERE id = %s",
            (nif or None, morada or None, cod_postal or None, funcao or None,
             matricula_viatura or None, user_id)
        )
        conn.commit()
        cur.close()
        conn.close()
        return True
    except Exception as e:
        logger.error(f"Erro ao atualizar dados financeiros de {user_id}: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False


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
        logger.error(f"Erro ao obter ID do perfil: {e}")
        return None

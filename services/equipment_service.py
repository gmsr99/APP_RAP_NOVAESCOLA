from supabase import create_client
import os
from typing import List, Optional, Dict, Any

# Initialize Supabase client
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
supabase = create_client(supabase_url, supabase_key)

def listar_equipamento() -> List[Dict[str, Any]]:
    """
    Lista todo o equipamento registado na base de dados.
    """
    try:
        # Select * from equipments order by name
        response = supabase.table("equipments").select("*").order("name").execute()
        return response.data
    except Exception as e:
        print(f"Erro ao listar equipamento: {e}")
        return []

def criar_equipamento(name: str, type: str, status: str = "Disponivel", notes: Optional[str] = None) -> Dict[str, Any]:
    """
    Cria um novo equipamento.
    """
    try:
        data = {
            "name": name,
            "type": type,
            "status": status,
            "notes": notes
        }
        response = supabase.table("equipments").insert(data).execute()
        if response.data:
            return response.data[0]
        return None
    except Exception as e:
        print(f"Erro ao criar equipamento: {e}")
        return None

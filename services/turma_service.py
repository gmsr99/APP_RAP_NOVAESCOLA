"""
==============================================================================
RAP NOVA ESCOLA - Serviço de Gestão de Turmas e Instituições
==============================================================================
Ficheiro: services/turma_service.py

Este serviço gere operações de leitura para turmas e estabelecimentos,
principalmente para preencher formulários no frontend.
"""

import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.connection import get_db_connection

def listar_turmas_com_estabelecimento():
    """
    Lista todas as turmas com o nome da respectivo estabelecimento.
    Útil para dropdowns de seleção.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = """
            SELECT 
                t.id, 
                t.nome as turma_nome, 
                e.nome as estabelecimento_nome,
                e.id as estabelecimento_id
            FROM turmas t
            JOIN estabelecimentos e ON t.estabelecimento_id = e.id
            ORDER BY e.nome, t.nome;
        """
        
        cur.execute(query)
        resultados = cur.fetchall()
        
        turmas = []
        for row in resultados:
            turmas.append({
                'id': row[0],
                'nome': row[1],
                'estabelecimento_nome': row[2],
                'estabelecimento_id': row[3],
                'display_name': f"{row[1]} ({row[2]})"
            })
            
        return turmas
        
    except Exception as e:
        print(f"❌ Erro ao listar turmas: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

def listar_estabelecimentos():
    """Lista todas os estabelecimentos."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT id, nome, sigla FROM estabelecimentos ORDER BY nome;")
        resultados = cur.fetchall()
        
        return [{'id': r[0], 'nome': r[1], 'sigla': r[2] or ''} for r in resultados]
        
    except Exception as e:
        print(f"❌ Erro ao listar estabelecimentos: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

def criar_estabelecimento(nome: str, sigla: str = None):
    """Cria um novo estabelecimento."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if exists
        cur.execute("SELECT id FROM estabelecimentos WHERE nome = %s", (nome,))
        if cur.fetchone():
            return None # Already exists
            
        cur.execute(
            "INSERT INTO estabelecimentos (nome, sigla) VALUES (%s, %s) RETURNING id, nome, sigla",
            (nome, sigla)
        )
        nova_inst = cur.fetchone()
        conn.commit()
        
        return {'id': nova_inst[0], 'nome': nova_inst[1], 'sigla': nova_inst[2]}
    except Exception as e:
        print(f"❌ Erro ao criar estabelecimento: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

def atualizar_estabelecimento(id: int, nome: str, sigla: str = None):
    """Atualiza um estabelecimento existente."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(
            "UPDATE estabelecimentos SET nome = %s, sigla = %s WHERE id = %s",
            (nome, sigla, id)
        )
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Erro ao atualizar estabelecimento: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

def apagar_estabelecimento(id: int):
    """Remove um estabelecimento."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("DELETE FROM estabelecimentos WHERE id = %s", (id,))
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Erro ao apagar estabelecimento: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

def criar_turma(nome: str, estabelecimento_id: str):
    """Cria uma nova turma num estabelecimento."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if exists in this establishment
        cur.execute(
            "SELECT id FROM turmas WHERE nome = %s AND estabelecimento_id = %s",
            (nome, estabelecimento_id)
        )
        if cur.fetchone():
            return None # Already exists
            
        cur.execute(
            "INSERT INTO turmas (nome, estabelecimento_id) VALUES (%s, %s) RETURNING id, nome, estabelecimento_id",
            (nome, estabelecimento_id)
        )
        nova_turma = cur.fetchone()
        conn.commit()
        
        return {
            'id': nova_turma[0], 
            'nome': nova_turma[1], 
            'estabelecimento_id': nova_turma[2]
        }
    except Exception as e:
        print(f"❌ Erro ao criar turma: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

def listar_mentores():
    """Lista todos os mentores ativos."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, nome FROM mentores WHERE ativo = true ORDER BY nome")
        mentores = cur.fetchall()
        return [{'id': m[0], 'nome': m[1]} for m in mentores]
    except Exception as e:
        print(f"❌ Erro ao listar mentores: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

def obter_email_mentor(id: int):
    """Obtém o email de um mentor pelo ID."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT email FROM mentores WHERE id = %s", (id,))
        result = cur.fetchone()
        return result[0] if result else None
    except Exception as e:
        print(f"❌ Erro ao obter email do mentor: {e}")
        return None
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

def listar_produtores():
    """Lista todos os produtores ativos."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, nome FROM produtores WHERE ativo = true ORDER BY nome")
        produtores = cur.fetchall()
        return [{'id': m[0], 'nome': m[1]} for m in produtores]
    except Exception as e:
        print(f"❌ Erro ao listar produtores: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

def atualizar_turma(id: int, nome: str, estabelecimento_id: int):
    """Atualiza uma turma existente."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(
            "UPDATE turmas SET nome = %s, estabelecimento_id = %s WHERE id = %s",
            (nome, estabelecimento_id, id)
        )
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Erro ao atualizar turma: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

def apagar_turma(id: int):
    """Remove uma turma."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("DELETE FROM turmas WHERE id = %s", (id,))
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Erro ao apagar turma: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

"""
==============================================================================
RAP NOVA ESCOLA - Serviço de Gestão de Turmas e Instituições
==============================================================================
Ficheiro: services/turma_service.py

Este serviço gere operações de leitura para turmas e instituições,
principalmente para preencher formulários no frontend.
"""

import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.connection import get_db_connection

def listar_turmas_com_instituicao():
    """
    Lista todas as turmas com o nome da respectiva instituição.
    Útil para dropdowns de seleção.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = """
            SELECT 
                t.id, 
                t.nome as turma_nome, 
                i.nome as instituicao_nome,
                i.id as instituicao_id
            FROM turmas t
            JOIN instituicoes i ON t.instituicao_id = i.id
            ORDER BY i.nome, t.nome;
        """
        
        cur.execute(query)
        resultados = cur.fetchall()
        
        turmas = []
        for row in resultados:
            turmas.append({
                'id': row[0],
                'nome': row[1],
                'instituicao_nome': row[2],
                'instituicao_id': row[3],
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

def listar_instituicoes():
    """Lista todas as instituições."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT id, nome FROM instituicoes ORDER BY nome;")
        resultados = cur.fetchall()
        
        return [{'id': r[0], 'nome': r[1]} for r in resultados]
        
    except Exception as e:
        print(f"❌ Erro ao listar instituições: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

def criar_instituicao(nome: str):
    """Cria uma nova instituição."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if exists
        cur.execute("SELECT id FROM instituicoes WHERE nome = %s", (nome,))
        if cur.fetchone():
            return None # Already exists
            
        cur.execute(
            "INSERT INTO instituicoes (nome) VALUES (%s) RETURNING id, nome",
            (nome,)
        )
        nova_inst = cur.fetchone()
        conn.commit()
        
        return {'id': nova_inst[0], 'nome': nova_inst[1]}
    except Exception as e:
        print(f"❌ Erro ao criar instituição: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

def criar_turma(nome: str, instituicao_id: str):
    """Cria uma nova turma numa instituição."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if exists in this institution
        cur.execute(
            "SELECT id FROM turmas WHERE nome = %s AND instituicao_id = %s",
            (nome, instituicao_id)
        )
        if cur.fetchone():
            return None # Already exists
            
        cur.execute(
            "INSERT INTO turmas (nome, instituicao_id) VALUES (%s, %s) RETURNING id, nome, instituicao_id",
            (nome, instituicao_id)
        )
        nova_turma = cur.fetchone()
        conn.commit()
        
        return {
            'id': nova_turma[0], 
            'nome': nova_turma[1], 
            'instituicao_id': nova_turma[2]
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

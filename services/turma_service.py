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

def listar_turmas_com_estabelecimento(estabelecimento_id=None):
    """
    Lista todas as turmas com o nome da respectivo estabelecimento.
    Útil para dropdowns de seleção.
    Opcionalmente filtra por estabelecimento_id.
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
        """
        params = []
        if estabelecimento_id is not None:
            query += " WHERE t.estabelecimento_id = %s"
            params.append(estabelecimento_id)
        query += " ORDER BY e.nome, t.nome;"

        cur.execute(query, params)
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
        
        cur.execute("SELECT id, nome, sigla, morada, latitude, longitude FROM estabelecimentos ORDER BY nome;")
        resultados = cur.fetchall()

        return [{'id': r[0], 'nome': r[1], 'sigla': r[2] or '', 'morada': r[3], 'latitude': r[4], 'longitude': r[5]} for r in resultados]
        
    except Exception as e:
        print(f"❌ Erro ao listar estabelecimentos: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

def criar_estabelecimento(nome: str, sigla: str = None, morada: str = None, latitude: float = None, longitude: float = None):
    """Cria um novo estabelecimento."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Check if exists
        cur.execute("SELECT id FROM estabelecimentos WHERE nome = %s", (nome,))
        if cur.fetchone():
            return None # Already exists

        cur.execute(
            "INSERT INTO estabelecimentos (nome, sigla, morada, latitude, longitude) VALUES (%s, %s, %s, %s, %s) RETURNING id, nome, sigla",
            (nome, sigla, morada, latitude, longitude)
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

def atualizar_estabelecimento(id: int, nome: str, sigla: str = None, morada: str = None, latitude: float = None, longitude: float = None):
    """Atualiza um estabelecimento existente."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            "UPDATE estabelecimentos SET nome = %s, sigla = %s, morada = %s, latitude = %s, longitude = %s WHERE id = %s",
            (nome, sigla, morada, latitude, longitude, id)
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
        cur.execute("SELECT id, nome, latitude, longitude FROM mentores WHERE ativo = true ORDER BY nome")
        mentores = cur.fetchall()
        return [{'id': m[0], 'nome': m[1], 'latitude': m[2], 'longitude': m[3]} for m in mentores]
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


def listar_disciplinas_turma(turma_id: int):
    """Lista as disciplinas em que uma turma está matriculada, com horas previstas."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT d.id, d.nome, d.musicas_previstas, td.horas_previstas
            FROM disciplinas d
            JOIN turma_disciplinas td ON td.disciplina_id = d.id
            WHERE td.turma_id = %s
            ORDER BY d.nome
        """, (turma_id,))
        rows = cur.fetchall()
        return [{'id': r[0], 'nome': r[1], 'musicas_previstas': r[2], 'horas_previstas': float(r[3]) if r[3] is not None else None} for r in rows]
    except Exception as e:
        print(f"❌ Erro ao listar disciplinas da turma: {e}")
        return []
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def definir_disciplinas_turma(turma_id: int, disciplinas: list):
    """Substitui as disciplinas de uma turma. disciplinas = [{disciplina_id, horas_previstas}]"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM turma_disciplinas WHERE turma_id = %s", (turma_id,))
        for d in disciplinas:
            cur.execute(
                "INSERT INTO turma_disciplinas (turma_id, disciplina_id, horas_previstas) VALUES (%s, %s, %s)",
                (turma_id, d['disciplina_id'], d.get('horas_previstas'))
            )
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Erro ao definir disciplinas da turma: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def obter_mentor_por_user_id(user_id: str, email: str = None):
    """Obtém o mentor associado a um user_id ou email do Supabase."""
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Verifica se a coluna user_id já existe (migração 008 pode ainda não ter sido aplicada)
        cur.execute("""
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'mentores' AND column_name = 'user_id'
        """)
        has_user_id_col = cur.fetchone() is not None

        if has_user_id_col:
            cur.execute(
                """SELECT id, nome, morada, latitude, longitude
                   FROM mentores
                   WHERE user_id = %s OR (user_id IS NULL AND email = %s)
                   LIMIT 1""",
                (user_id, email)
            )
        else:
            # Migração 008 ainda não aplicada — lookup só por email
            cur.execute(
                "SELECT id, nome, morada, latitude, longitude FROM mentores WHERE email = %s LIMIT 1",
                (email,)
            )

        row = cur.fetchone()
        if row:
            if has_user_id_col and email:
                cur.execute(
                    "UPDATE mentores SET user_id = %s WHERE id = %s AND user_id IS NULL",
                    (user_id, row[0])
                )
                conn.commit()
            return {'id': row[0], 'nome': row[1], 'morada': row[2], 'latitude': row[3], 'longitude': row[4]}
        return None
    except Exception as e:
        print(f"❌ Erro ao obter mentor por user_id: {e}")
        return None
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def criar_mentor(user_id: str, nome: str, email: str, perfil: str):
    """Cria um novo mentor na tabela (fallback quando o trigger do Supabase não disparou)."""
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO mentores (nome, email, perfil, user_id, ativo, criado_em, atualizado_em)
               VALUES (%s, %s, %s, %s, true, NOW(), NOW())
               ON CONFLICT (email) DO UPDATE SET user_id = EXCLUDED.user_id, nome = EXCLUDED.nome, perfil = EXCLUDED.perfil
               RETURNING id, nome, morada, latitude, longitude""",
            (nome, email, perfil, user_id)
        )
        row = cur.fetchone()
        conn.commit()
        if row:
            return {'id': row[0], 'nome': row[1], 'morada': row[2], 'latitude': row[3], 'longitude': row[4]}
        return None
    except Exception as e:
        print(f"❌ Erro ao criar mentor: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def atualizar_localizacao_mentor(mentor_id: int, morada: str, latitude: float, longitude: float):
    """Atualiza a morada e coordenadas de um mentor."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE mentores SET morada = %s, latitude = %s, longitude = %s WHERE id = %s",
            (morada, latitude, longitude, mentor_id)
        )
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Erro ao atualizar localização do mentor: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

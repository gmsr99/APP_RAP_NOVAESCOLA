import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.connection import get_db_connection

def listar_curriculo():
    """Lista todo o currículo (disciplinas e atividades)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Obter disciplinas
        cur.execute("SELECT id, nome, descricao FROM disciplinas ORDER BY nome")
        disciplinas = cur.fetchall()
        
        resultado = []
        for disc in disciplinas:
            d_id, d_nome, d_desc = disc
            
            # Obter atividades da disciplina
            cur.execute("""
                SELECT id, codigo, nome, sessoes_padrao, horas_padrao, 
                       producoes_esperadas, perfil_mentor
                FROM atividades 
                WHERE disciplina_id = %s
                ORDER BY codigo
            """, (d_id,))
            
            atividades = []
            for act in cur.fetchall():
                atividades.append({
                    'id': act[0],
                    'codigo': act[1],
                    'nome': act[2],
                    'sessoes_padrao': act[3],
                    'horas_padrao': act[4],
                    'producoes_esperadas': act[5],
                    'perfil_mentor': act[6],
                    'total_horas': (act[3] or 0) * (act[4] or 0) if act[3] and act[4] else (act[4] or 0)
                })
                
            resultado.append({
                'id': d_id,
                'disciplina': d_nome,
                'descricao': d_desc,
                'atividades': atividades
            })
            
        return resultado
    except Exception as e:
        print(f"❌ Erro ao listar currículo: {e}")
        return []
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def adicionar_disciplina(nome, descricao=None):
    """Adiciona uma nova disciplina."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute(
            "INSERT INTO disciplinas (nome, descricao) VALUES (%s, %s) RETURNING id",
            (nome, descricao)
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        return new_id
    except Exception as e:
        print(f"❌ Erro ao adicionar disciplina: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def adicionar_atividade(disciplina_id, codigo, nome, sessoes=None, horas=None, producoes=0, mentor=None):
    """Adiciona uma nova atividade a uma disciplina."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO atividades 
            (disciplina_id, codigo, nome, sessoes_padrao, horas_padrao, producoes_esperadas, perfil_mentor)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (disciplina_id, codigo, nome, sessoes, horas, producoes, mentor))
        
        new_id = cur.fetchone()[0]
        conn.commit()
        return new_id
    except Exception as e:
        print(f"❌ Erro ao adicionar atividade: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def atualizar_atividade(id, dados):
    """Atualiza uma atividade existente."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = """
            UPDATE atividades 
            SET codigo = %s, nome = %s, sessoes_padrao = %s, 
                horas_padrao = %s, producoes_esperadas = %s, perfil_mentor = %s
            WHERE id = %s
        """
        cur.execute(query, (
            dados['codigo'], dados['nome'], dados.get('sessoes_padrao'),
            dados.get('horas_padrao'), dados.get('producoes_esperadas', 0),
            dados.get('perfil_mentor'), id
        ))
        
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Erro ao atualizar atividade: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def apagar_atividade(id):
    """Remove uma atividade."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("DELETE FROM atividades WHERE id = %s", (id,))
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Erro ao apagar atividade: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

"""
Serviço de gestão de alunos por turma.
Usa psycopg2 (mesmo padrão que turma_service.py).
"""

import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.connection import get_db_connection


def listar_alunos_por_turma(turma_id: int):
    """Retorna a lista de alunos de uma turma, ordenados por nome."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            "SELECT id, nome FROM alunos WHERE turma_id = %s ORDER BY nome",
            (turma_id,)
        )
        rows = cur.fetchall()

        return [{"id": r[0], "nome": r[1]} for r in rows]

    except Exception as e:
        print(f"❌ Erro ao listar alunos da turma #{turma_id}: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def definir_alunos_turma(turma_id: int, nomes: list[str]):
    """
    Substitui todos os alunos de uma turma pelos nomes fornecidos.
    Opera numa única transação (delete + insert).
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("DELETE FROM alunos WHERE turma_id = %s", (turma_id,))

        for nome in nomes:
            nome = nome.strip()
            if nome:
                cur.execute(
                    "INSERT INTO alunos (turma_id, nome) VALUES (%s, %s)",
                    (turma_id, nome)
                )

        conn.commit()
        print(f"✅ Alunos da turma #{turma_id} atualizados ({len(nomes)} nomes)")
        return True

    except Exception as e:
        print(f"❌ Erro ao definir alunos da turma #{turma_id}: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

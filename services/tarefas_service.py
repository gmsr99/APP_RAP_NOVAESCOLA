"""
==============================================================================
RAP NOVA ESCOLA - Serviço de Tarefas Internas
==============================================================================
"""
import logging
from database.connection import get_db_connection

logger = logging.getLogger(__name__)


def listar_tarefas_para_user(user_id: str):
    """Lista tarefas atribuídas ao user + tarefas gerais (sem atribuição)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                t.id, t.titulo, t.descricao, t.prioridade, t.data_limite, t.criado_por, t.created_at,
                ta.estado AS meu_estado,
                ta.concluida_em,
                -- global: concluída quando todos os atribuídos concluíram
                CASE
                    WHEN COUNT(ta2.id) = 0 THEN NULL
                    WHEN COUNT(ta2.id) FILTER (WHERE ta2.estado != 'concluida') = 0 THEN 'concluida'
                    ELSE 'em_progresso'
                END AS estado_global,
                -- nomes dos atribuídos (via auth.users / profiles)
                COALESCE(
                    json_agg(
                        json_build_object('user_id', ta2.user_id, 'estado', ta2.estado)
                    ) FILTER (WHERE ta2.id IS NOT NULL),
                    '[]'
                ) AS atribuicoes
            FROM tarefas t
            LEFT JOIN tarefa_atribuicoes ta  ON ta.tarefa_id = t.id AND ta.user_id = %s
            LEFT JOIN tarefa_atribuicoes ta2 ON ta2.tarefa_id = t.id
            WHERE ta.user_id = %s OR NOT EXISTS (
                SELECT 1 FROM tarefa_atribuicoes x WHERE x.tarefa_id = t.id
            )
            GROUP BY t.id, ta.estado, ta.concluida_em
            ORDER BY
                CASE t.prioridade WHEN 'urgente' THEN 1 WHEN 'alto' THEN 2 WHEN 'medio' THEN 3 ELSE 4 END,
                t.data_limite NULLS LAST,
                t.created_at DESC
        """, (user_id, user_id))
        rows = cur.fetchall()
        return [_row_to_tarefa(r) for r in rows]
    except Exception as e:
        logger.error(f"Erro ao listar tarefas para user: {e}")
        return []
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def listar_todas_tarefas():
    """Lista todas as tarefas (para coordenadores)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                t.id, t.titulo, t.descricao, t.prioridade, t.data_limite, t.criado_por, t.created_at,
                NULL AS meu_estado,
                NULL AS concluida_em,
                CASE
                    WHEN COUNT(ta.id) = 0 THEN 'geral'
                    WHEN COUNT(ta.id) FILTER (WHERE ta.estado != 'concluida') = 0 THEN 'concluida'
                    ELSE 'em_progresso'
                END AS estado_global,
                COALESCE(
                    json_agg(
                        json_build_object('user_id', ta.user_id, 'estado', ta.estado)
                    ) FILTER (WHERE ta.id IS NOT NULL),
                    '[]'
                ) AS atribuicoes
            FROM tarefas t
            LEFT JOIN tarefa_atribuicoes ta ON ta.tarefa_id = t.id
            GROUP BY t.id
            ORDER BY
                CASE t.prioridade WHEN 'urgente' THEN 1 WHEN 'alto' THEN 2 WHEN 'medio' THEN 3 ELSE 4 END,
                t.data_limite NULLS LAST,
                t.created_at DESC
        """)
        rows = cur.fetchall()
        return [_row_to_tarefa(r) for r in rows]
    except Exception as e:
        logger.error(f"Erro ao listar todas as tarefas: {e}")
        return []
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def criar_tarefa(titulo: str, criado_por: str, descricao: str = None,
                 prioridade: str = 'medio', data_limite=None,
                 user_ids: list = None):
    """Cria uma tarefa e atribui aos users indicados."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO tarefas (titulo, descricao, prioridade, data_limite, criado_por) "
            "VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (titulo, descricao, prioridade, data_limite, criado_por)
        )
        tarefa_id = cur.fetchone()[0]

        if user_ids:
            for uid in user_ids:
                cur.execute(
                    "INSERT INTO tarefa_atribuicoes (tarefa_id, user_id) VALUES (%s, %s) "
                    "ON CONFLICT DO NOTHING",
                    (tarefa_id, uid)
                )
        conn.commit()
        return {'id': tarefa_id}
    except Exception as e:
        logger.error(f"Erro ao criar tarefa: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def atualizar_tarefa(tarefa_id: int, titulo: str, descricao: str = None,
                     prioridade: str = 'medio', data_limite=None,
                     user_ids: list = None):
    """Atualiza dados da tarefa e re-atribui users."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE tarefas SET titulo=%s, descricao=%s, prioridade=%s, data_limite=%s WHERE id=%s",
            (titulo, descricao, prioridade, data_limite, tarefa_id)
        )
        if user_ids is not None:
            cur.execute("DELETE FROM tarefa_atribuicoes WHERE tarefa_id = %s", (tarefa_id,))
            for uid in user_ids:
                cur.execute(
                    "INSERT INTO tarefa_atribuicoes (tarefa_id, user_id) VALUES (%s, %s)",
                    (tarefa_id, uid)
                )
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Erro ao atualizar tarefa: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def apagar_tarefa(tarefa_id: int):
    """Apaga uma tarefa (cascade apaga atribuições)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM tarefas WHERE id = %s", (tarefa_id,))
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Erro ao apagar tarefa: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def marcar_estado_tarefa(tarefa_id: int, user_id: str, estado: str):
    """User marca o seu estado numa tarefa. Para tarefas gerais (sem atribuição), cria a atribuição automaticamente."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO tarefa_atribuicoes (tarefa_id, user_id, estado, concluida_em)
            VALUES (%s, %s, %s, CASE WHEN %s = 'concluida' THEN NOW() ELSE NULL END)
            ON CONFLICT (tarefa_id, user_id) DO UPDATE
            SET estado = EXCLUDED.estado, concluida_em = EXCLUDED.concluida_em
        """, (tarefa_id, user_id, estado, estado))
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        logger.error(f"Erro ao marcar estado: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def _row_to_tarefa(r):
    return {
        'id': r[0],
        'titulo': r[1],
        'descricao': r[2],
        'prioridade': r[3],
        'data_limite': str(r[4]) if r[4] else None,
        'criado_por': str(r[5]),
        'created_at': str(r[6]),
        'meu_estado': r[7],
        'concluida_em': str(r[8]) if r[8] else None,
        'estado_global': r[9],
        'atribuicoes': r[10] if isinstance(r[10], list) else [],
    }

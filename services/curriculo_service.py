"""
Serviço de Catálogo de Disciplinas e Atividades.

Gere:
  - disciplinas (catálogo/template)
  - disciplina_atividades (atividades de cada template)
  - turma_disciplinas (instâncias de disciplinas por turma)
  - turma_atividades   (instâncias de atividades por turma_disciplina)
"""
import logging
from typing import Optional
from database.connection import get_db_connection

logger = logging.getLogger(__name__)

# ── Catálogo de Disciplinas ────────────────────────────────────────────────────

def listar_catalogo():
    """Lista todas as disciplinas do catálogo com as suas atividades."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, nome, descricao, musicas_previstas, horas_previstas,
                   sessoes, duracao_minutos, num_producoes, ativo, ordem
            FROM disciplinas
            ORDER BY ordem, nome
        """)
        cols = [d[0] for d in cur.description]
        disciplinas = [dict(zip(cols, row)) for row in cur.fetchall()]

        if not disciplinas:
            return []

        disc_ids = [d["id"] for d in disciplinas]
        cur.execute("""
            SELECT id, disciplina_id, nome, is_autonomous, horas, sessoes, role, ordem
            FROM disciplina_atividades
            WHERE disciplina_id = ANY(%s)
            ORDER BY disciplina_id, ordem
        """, (disc_ids,))
        acols = [d[0] for d in cur.description]
        atividades = [dict(zip(acols, row)) for row in cur.fetchall()]

        atv_map: dict[int, list] = {}
        for a in atividades:
            atv_map.setdefault(a["disciplina_id"], []).append(a)

        for d in disciplinas:
            d["atividades"] = atv_map.get(d["id"], [])

        return disciplinas
    finally:
        conn.close()


def criar_disciplina(nome: str, descricao: Optional[str], musicas_previstas: int,
                     sessoes: Optional[int], duracao_minutos: int,
                     num_producoes: int, ativo: bool, ordem: int):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO disciplinas (nome, descricao, musicas_previstas, sessoes,
                                     duracao_minutos, num_producoes, ativo, ordem)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id, nome, descricao, musicas_previstas, horas_previstas,
                      sessoes, duracao_minutos, num_producoes, ativo, ordem
        """, (nome, descricao, musicas_previstas, sessoes,
              duracao_minutos, num_producoes, ativo, ordem))
        cols = [d[0] for d in cur.description]
        row = dict(zip(cols, cur.fetchone()))
        row["atividades"] = []
        conn.commit()
        return row
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def atualizar_disciplina(disc_id: int, **fields):
    allowed = {"nome", "descricao", "musicas_previstas", "sessoes",
               "duracao_minutos", "num_producoes", "ativo", "ordem"}
    updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not updates:
        return None
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        set_clause = ", ".join(f"{k} = %s" for k in updates)
        cur.execute(
            f"UPDATE disciplinas SET {set_clause} WHERE id = %s RETURNING id",
            [*updates.values(), disc_id]
        )
        if cur.fetchone() is None:
            return None
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def apagar_disciplina(disc_id: int):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM turma_disciplinas WHERE disciplina_id = %s", (disc_id,))
        count = cur.fetchone()[0]
        if count > 0:
            return {"error": "Disciplina em uso por turmas. Desativa-a em vez de apagar."}
        cur.execute("DELETE FROM disciplinas WHERE id = %s RETURNING id", (disc_id,))
        if cur.fetchone() is None:
            return {"error": "Disciplina não encontrada."}
        conn.commit()
        return {"ok": True}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


# ── Atividades do Catálogo ─────────────────────────────────────────────────────

def criar_atividade_template(disciplina_id: int, nome: str, is_autonomous: bool,
                              horas: float, sessoes: Optional[int], role: str, ordem: int):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO disciplina_atividades
              (disciplina_id, nome, is_autonomous, horas, sessoes, role, ordem)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            RETURNING id, disciplina_id, nome, is_autonomous, horas, sessoes, role, ordem
        """, (disciplina_id, nome, is_autonomous, horas, sessoes, role, ordem))
        cols = [d[0] for d in cur.description]
        row = dict(zip(cols, cur.fetchone()))
        conn.commit()
        return row
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def atualizar_atividade_template(atv_id: int, **fields):
    allowed = {"nome", "is_autonomous", "horas", "sessoes", "role", "ordem"}
    updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not updates:
        return None
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        set_clause = ", ".join(f"{k} = %s" for k in updates)
        cur.execute(
            f"UPDATE disciplina_atividades SET {set_clause} WHERE id = %s RETURNING id",
            [*updates.values(), atv_id]
        )
        if cur.fetchone() is None:
            return None
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def apagar_atividade_template(atv_id: int):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM disciplina_atividades WHERE id = %s RETURNING id", (atv_id,))
        if cur.fetchone() is None:
            return False
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


# ── Disciplinas por Turma ──────────────────────────────────────────────────────

def listar_disciplinas_turma(turma_id: int):
    """Lista disciplinas de uma turma com as atividades associadas."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT td.id, td.turma_id, td.nome, td.descricao, td.musicas_previstas,
                   td.disciplina_id, td.criado_em,
                   d.nome AS template_nome
            FROM turma_disciplinas td
            LEFT JOIN disciplinas d ON d.id = td.disciplina_id
            WHERE td.turma_id = %s
            ORDER BY td.criado_em
        """, (turma_id,))
        cols = [d[0] for d in cur.description]
        disciplinas = [dict(zip(cols, row)) for row in cur.fetchall()]

        if not disciplinas:
            return []

        td_ids = [d["id"] for d in disciplinas]
        cur.execute("""
            SELECT uuid, turma_disciplina_id, nome, is_autonomous, role,
                   sessoes_previstas, horas_por_sessao, musicas_previstas, codigo
            FROM turma_atividades
            WHERE turma_disciplina_id = ANY(%s)
            ORDER BY turma_disciplina_id, is_autonomous, nome
        """, (td_ids,))
        acols = [d[0] for d in cur.description]
        atividades = [dict(zip(acols, row)) for row in cur.fetchall()]

        atv_map: dict[int, list] = {}
        for a in atividades:
            a["uuid"] = str(a["uuid"])
            atv_map.setdefault(a["turma_disciplina_id"], []).append(a)

        for d in disciplinas:
            d["criado_em"] = d["criado_em"].isoformat() if d["criado_em"] else None
            d["atividades"] = atv_map.get(d["id"], [])

        return disciplinas
    finally:
        conn.close()


def criar_disciplina_turma(turma_id: int, nome: str, descricao: Optional[str],
                            musicas_previstas: int, disciplina_id: Optional[int]):
    """
    Cria turma_disciplina. Se disciplina_id fornecido, instancia automaticamente
    as atividades do template como turma_atividades.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO turma_disciplinas (turma_id, nome, descricao, musicas_previstas, disciplina_id)
            VALUES (%s,%s,%s,%s,%s)
            RETURNING id, turma_id, nome, descricao, musicas_previstas, disciplina_id, criado_em
        """, (turma_id, nome, descricao, musicas_previstas, disciplina_id))
        cols = [d[0] for d in cur.description]
        td = dict(zip(cols, cur.fetchone()))
        td_id = td["id"]
        td["criado_em"] = td["criado_em"].isoformat() if td["criado_em"] else None

        if disciplina_id:
            cur.execute("""
                SELECT nome, is_autonomous, horas, sessoes, role, ordem
                FROM disciplina_atividades
                WHERE disciplina_id = %s
                ORDER BY ordem
            """, (disciplina_id,))
            for (anome, is_aut, horas, sessoes, role, _) in cur.fetchall():
                sess_prev = sessoes if sessoes else 1
                h_por_sessao = round(float(horas) / sess_prev, 2)
                cur.execute("""
                    INSERT INTO turma_atividades
                      (turma_disciplina_id, nome, is_autonomous, role, sessoes_previstas, horas_por_sessao)
                    VALUES (%s,%s,%s,%s,%s,%s)
                """, (td_id, anome, is_aut, role, sess_prev, h_por_sessao))

        conn.commit()
        td["atividades"] = listar_atividades_td(cur, td_id)
        return td
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def listar_atividades_td(cur, td_id: int):
    cur.execute("""
        SELECT uuid, turma_disciplina_id, nome, is_autonomous, role,
               sessoes_previstas, horas_por_sessao, musicas_previstas, codigo
        FROM turma_atividades
        WHERE turma_disciplina_id = %s
        ORDER BY is_autonomous, nome
    """, (td_id,))
    cols = [d[0] for d in cur.description]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    for r in rows:
        r["uuid"] = str(r["uuid"])
    return rows


def atualizar_disciplina_turma(td_id: int, **fields):
    allowed = {"nome", "descricao", "musicas_previstas"}
    updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
    if not updates:
        return None
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        set_clause = ", ".join(f"{k} = %s" for k in updates)
        cur.execute(
            f"UPDATE turma_disciplinas SET {set_clause} WHERE id = %s RETURNING id",
            [*updates.values(), td_id]
        )
        if cur.fetchone() is None:
            return None
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


def apagar_disciplina_turma(td_id: int):
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT COUNT(*) FROM aulas
            WHERE atividade_uuid IN (
                SELECT uuid FROM turma_atividades WHERE turma_disciplina_id = %s
            )
        """, (td_id,))
        count = cur.fetchone()[0]
        if count > 0:
            return {"error": f"Disciplina tem {count} aulas associadas. Não é possível apagar."}
        cur.execute("DELETE FROM turma_atividades WHERE turma_disciplina_id = %s", (td_id,))
        cur.execute("DELETE FROM turma_disciplinas WHERE id = %s RETURNING id", (td_id,))
        if cur.fetchone() is None:
            return {"error": "Disciplina não encontrada."}
        conn.commit()
        return {"ok": True}
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


# ── Users elegíveis por work_type ─────────────────────────────────────────────

def listar_users_por_work_type(role: str):
    """Devolve profiles cujo permission_level tem work_type.<role> = true."""
    work_key = f"work_type.{role}"
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT p.id, p.full_name, p.email, p.role, p.avatar_url
            FROM profiles p
            JOIN permission_levels pl ON pl.id = p.permission_level_id
            WHERE (pl.allowed_actions ->> %s)::boolean = TRUE
            ORDER BY p.full_name
        """, (work_key,))
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]
    finally:
        conn.close()

import logging

from database.connection import get_db_connection

logger = logging.getLogger(__name__)


def listar_sub_projetos(projeto_id: int) -> list:
    """Lista sub-projetos de um projeto, com os respectivos estabelecimentos."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT sp.id, sp.nome, sp.descricao, sp.projeto_id,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'id', e.id, 'nome', e.nome, 'sigla', e.sigla,
                               'nome_apresentacao', e.nome_apresentacao
                           ) ORDER BY e.nome
                       ) FILTER (WHERE e.id IS NOT NULL),
                       '[]'
                   ) AS estabelecimentos
            FROM sub_projetos sp
            LEFT JOIN projeto_estabelecimentos pe ON pe.sub_projeto_id = sp.id
                                                  AND pe.projeto_id = sp.projeto_id
            LEFT JOIN estabelecimentos e ON e.id = pe.estabelecimento_id
            WHERE sp.projeto_id = %s
            GROUP BY sp.id, sp.nome, sp.descricao, sp.projeto_id
            ORDER BY sp.nome
            """,
            (projeto_id,),
        )
        cols = [desc[0] for desc in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    except Exception as e:
        logger.error(f"Erro ao listar sub-projetos: {e}")
        return []
    finally:
        conn.close()


def criar_sub_projeto(projeto_id: int, nome: str, descricao: str | None = None) -> dict | None:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO sub_projetos (projeto_id, nome, descricao) VALUES (%s, %s, %s) RETURNING id",
            (projeto_id, nome, descricao),
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        return {"id": new_id, "projeto_id": projeto_id, "nome": nome, "descricao": descricao}
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao criar sub-projeto: {e}")
        return None
    finally:
        conn.close()


def atualizar_sub_projeto(sub_projeto_id: int, nome: str, descricao: str | None = None) -> bool:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE sub_projetos SET nome = %s, descricao = %s WHERE id = %s",
            (nome, descricao, sub_projeto_id),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao atualizar sub-projeto: {e}")
        return False
    finally:
        conn.close()


def remover_sub_projeto(sub_projeto_id: int) -> bool:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM sub_projetos WHERE id = %s", (sub_projeto_id,))
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao remover sub-projeto: {e}")
        return False
    finally:
        conn.close()


def associar_estabelecimento(projeto_id: int, sub_projeto_id: int, estabelecimento_id: int) -> bool:
    """Associa um estabelecimento a um sub-projeto (e ao projeto pai)."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO projeto_estabelecimentos (projeto_id, estabelecimento_id, sub_projeto_id)
            VALUES (%s, %s, %s)
            ON CONFLICT (projeto_id, estabelecimento_id) DO UPDATE SET sub_projeto_id = EXCLUDED.sub_projeto_id
            """,
            (projeto_id, estabelecimento_id, sub_projeto_id),
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao associar estabelecimento ao sub-projeto: {e}")
        return False
    finally:
        conn.close()


def desassociar_estabelecimento(sub_projeto_id: int, estabelecimento_id: int) -> bool:
    """Remove a associação de um estabelecimento com um sub-projeto (mantém no projeto pai)."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE projeto_estabelecimentos SET sub_projeto_id = NULL WHERE sub_projeto_id = %s AND estabelecimento_id = %s",
            (sub_projeto_id, estabelecimento_id),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao desassociar estabelecimento do sub-projeto: {e}")
        return False
    finally:
        conn.close()


def obter_projeto_id(sub_projeto_id: int) -> int | None:
    """Devolve o projeto_id do sub-projeto, ou None se não existir."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT projeto_id FROM sub_projetos WHERE id = %s", (sub_projeto_id,))
        row = cur.fetchone()
        return row[0] if row else None
    except Exception as e:
        logger.error(f"Erro ao obter projeto_id do sub-projeto: {e}")
        return None
    finally:
        conn.close()


def listar_estabelecimentos_por_sub_projeto(sub_projeto_id: int) -> list:
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT e.id, e.nome, e.sigla, e.nome_apresentacao, e.morada, e.latitude, e.longitude
            FROM estabelecimentos e
            JOIN projeto_estabelecimentos pe ON pe.estabelecimento_id = e.id
            WHERE pe.sub_projeto_id = %s
            ORDER BY e.nome
            """,
            (sub_projeto_id,),
        )
        cols = [desc[0] for desc in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    except Exception as e:
        logger.error(f"Erro ao listar estabelecimentos do sub-projeto: {e}")
        return []
    finally:
        conn.close()

import logging

from database.connection import get_db_connection

logger = logging.getLogger(__name__)


def listar_projetos():
    """Lista todos os projetos."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, nome, descricao, estado, requer_digitalizacao FROM projetos ORDER BY nome")
        cols = [desc[0] for desc in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    except Exception as e:
        logger.error(f"Erro ao listar projetos: {e}")
        return []
    finally:
        conn.close()


def criar_projeto(nome, descricao=None):
    """Cria um novo projeto."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO projetos (nome, descricao) VALUES (%s, %s) RETURNING id",
            (nome, descricao),
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        return {"id": new_id, "nome": nome, "descricao": descricao}
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao criar projeto: {e}")
        return None
    finally:
        conn.close()


def atualizar_projeto(projeto_id, nome, descricao=None):
    """Atualiza um projeto existente."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE projetos SET nome = %s, descricao = %s WHERE id = %s",
            (nome, descricao, projeto_id),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao atualizar projeto: {e}")
        return False
    finally:
        conn.close()


def apagar_projeto(projeto_id):
    """Apaga um projeto (cascade apaga bridge)."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM projetos WHERE id = %s", (projeto_id,))
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao apagar projeto: {e}")
        return False
    finally:
        conn.close()


def listar_estabelecimentos_por_projeto(projeto_id):
    """Lista estabelecimentos associados a um projeto via tabela bridge."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT e.id, e.nome, e.sigla, e.morada, e.latitude, e.longitude
            FROM estabelecimentos e
            JOIN projeto_estabelecimentos pe ON pe.estabelecimento_id = e.id
            WHERE pe.projeto_id = %s
            ORDER BY e.nome
            """,
            (projeto_id,),
        )
        cols = [desc[0] for desc in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    except Exception as e:
        logger.error(f"Erro ao listar estabelecimentos do projeto: {e}")
        return []
    finally:
        conn.close()


def associar_estabelecimento(projeto_id, estabelecimento_id):
    """Associa um estabelecimento a um projeto."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO projeto_estabelecimentos (projeto_id, estabelecimento_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (projeto_id, estabelecimento_id),
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao associar estabelecimento: {e}")
        return False
    finally:
        conn.close()


def desassociar_estabelecimento(projeto_id, estabelecimento_id):
    """Remove a associação entre projeto e estabelecimento."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM projeto_estabelecimentos WHERE projeto_id = %s AND estabelecimento_id = %s",
            (projeto_id, estabelecimento_id),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao desassociar estabelecimento: {e}")
        return False
    finally:
        conn.close()


def atualizar_config_projeto(projeto_id: int, requer_digitalizacao: bool) -> bool:
    """Atualiza as configurações de digitalização de um projeto."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE projetos SET requer_digitalizacao = %s WHERE id = %s",
            (requer_digitalizacao, projeto_id),
        )
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao atualizar config projeto: {e}")
        return False
    finally:
        conn.close()

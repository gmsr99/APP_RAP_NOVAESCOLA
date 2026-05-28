import logging

from database.connection import get_db_connection

logger = logging.getLogger(__name__)


_PROJETO_COLS = "id, nome, descricao, estado, requer_digitalizacao, tem_pre_registos, codigo_projeto, logo_esq_path, logo_dir_path, footer_path, usar_template_proprio, usa_template_pis, honorario_entidade, honorario_morada, honorario_cod_postal, honorario_nipc, honorario_designacao, usar_sub_projetos"


def listar_projetos(allowed_ids=None):
    """Lista projetos. Se allowed_ids for uma lista, filtra por esses IDs."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        if allowed_ids is not None:
            if not allowed_ids:
                return []
            placeholders = ",".join(["%s"] * len(allowed_ids))
            cur.execute(
                f"SELECT {_PROJETO_COLS} FROM projetos WHERE id IN ({placeholders}) ORDER BY nome",
                allowed_ids,
            )
        else:
            cur.execute(f"SELECT {_PROJETO_COLS} FROM projetos ORDER BY nome")
        cols = [desc[0] for desc in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
    except Exception as e:
        logger.error(f"Erro ao listar projetos: {e}")
        return []
    finally:
        conn.close()


def obter_projeto_config(projeto_id: int) -> dict:
    """Obtém a configuração completa de um projeto (para geração de PDF)."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            f"SELECT {_PROJETO_COLS} FROM projetos WHERE id = %s",
            (projeto_id,),
        )
        row = cur.fetchone()
        if not row:
            return {}
        cols = [desc[0] for desc in cur.description]
        return dict(zip(cols, row))
    except Exception as e:
        logger.error(f"Erro ao obter config do projeto {projeto_id}: {e}")
        return {}
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
            SELECT e.id, e.nome, e.sigla, e.morada, e.latitude, e.longitude,
                   pe.sub_projeto_id, sp.nome AS sub_projeto_nome
            FROM estabelecimentos e
            JOIN projeto_estabelecimentos pe ON pe.estabelecimento_id = e.id
            LEFT JOIN sub_projetos sp ON sp.id = pe.sub_projeto_id
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


def atualizar_config_projeto(
    projeto_id: int,
    requer_digitalizacao: bool,
    tem_pre_registos: bool | None = None,
    codigo_projeto: str | None = None,
    usar_template_proprio: bool | None = None,
    usa_template_pis: bool | None = None,
    honorario_entidade: str | None = None,
    honorario_morada: str | None = None,
    honorario_cod_postal: str | None = None,
    honorario_nipc: str | None = None,
    honorario_designacao: str | None = None,
    usar_sub_projetos: bool | None = None,
) -> bool:
    """Atualiza as configurações de um projeto."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        sets = ["requer_digitalizacao = %s"]
        vals: list = [requer_digitalizacao]
        if tem_pre_registos is not None:
            sets.append("tem_pre_registos = %s")
            vals.append(tem_pre_registos)
        if codigo_projeto is not None:
            sets.append("codigo_projeto = %s")
            vals.append(codigo_projeto if codigo_projeto.strip() else None)
        if usar_template_proprio is not None:
            sets.append("usar_template_proprio = %s")
            vals.append(usar_template_proprio)
        if usa_template_pis is not None:
            sets.append("usa_template_pis = %s")
            vals.append(usa_template_pis)
        if usar_sub_projetos is not None:
            sets.append("usar_sub_projetos = %s")
            vals.append(usar_sub_projetos)
        for col, val in [
            ("honorario_entidade", honorario_entidade),
            ("honorario_morada", honorario_morada),
            ("honorario_cod_postal", honorario_cod_postal),
            ("honorario_nipc", honorario_nipc),
            ("honorario_designacao", honorario_designacao),
        ]:
            if val is not None:
                sets.append(f"{col} = %s")
                vals.append(val if val.strip() else None)
        vals.append(projeto_id)
        cur.execute(f"UPDATE projetos SET {', '.join(sets)} WHERE id = %s", vals)
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao atualizar config projeto: {e}")
        return False
    finally:
        conn.close()


def atualizar_logo_projeto(projeto_id: int, campo: str, path: str | None) -> bool:
    """Atualiza o path de um logo/footer de projeto. campo: logo_esq_path | logo_dir_path | footer_path"""
    allowed = {"logo_esq_path", "logo_dir_path", "footer_path"}
    if campo not in allowed:
        return False
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(f"UPDATE projetos SET {campo} = %s WHERE id = %s", (path, projeto_id))
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao atualizar logo do projeto: {e}")
        return False
    finally:
        conn.close()

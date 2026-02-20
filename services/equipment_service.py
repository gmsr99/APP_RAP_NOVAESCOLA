"""
Serviço de gestão de equipamento — categorias, itens e atribuição a sessões.
Usa psycopg2 (mesmo padrão que turma_service.py).
"""

import sys
import os
from datetime import datetime, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.connection import get_db_connection


def listar_categorias():
    """Retorna todas as categorias com os seus itens aninhados."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT kc.id, kc.nome, ki.id AS item_id, ki.nome AS item_nome
            FROM kit_categorias kc
            LEFT JOIN kit_itens ki ON ki.categoria_id = kc.id
            ORDER BY kc.id, ki.id
        """)
        rows = cur.fetchall()

        categorias = {}
        for row in rows:
            cat_id, cat_nome, item_id, item_nome = row
            if cat_id not in categorias:
                categorias[cat_id] = {"id": cat_id, "nome": cat_nome, "itens": []}
            if item_id:
                categorias[cat_id]["itens"].append({"id": item_id, "nome": item_nome})

        return list(categorias.values())

    except Exception as e:
        print(f"❌ Erro ao listar categorias: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def listar_equipamento_sessao(aula_id):
    """Retorna os itens de equipamento atribuídos a uma sessão."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT ki.id, ki.nome, kc.id AS categoria_id, kc.nome AS categoria_nome
            FROM aula_equipamento ae
            JOIN kit_itens ki ON ae.item_id = ki.id
            JOIN kit_categorias kc ON ki.categoria_id = kc.id
            WHERE ae.aula_id = %s
            ORDER BY kc.id, ki.id
        """, (aula_id,))
        rows = cur.fetchall()

        return [
            {
                "id": r[0],
                "nome": r[1],
                "categoria_id": r[2],
                "categoria_nome": r[3],
            }
            for r in rows
        ]

    except Exception as e:
        print(f"❌ Erro ao listar equipamento da sessão #{aula_id}: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def atribuir_equipamento_sessao(aula_id, item_ids):
    """Substitui os itens de equipamento de uma sessão (delete + insert)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("DELETE FROM aula_equipamento WHERE aula_id = %s", (aula_id,))

        for item_id in item_ids:
            cur.execute(
                "INSERT INTO aula_equipamento (aula_id, item_id) VALUES (%s, %s)",
                (aula_id, item_id)
            )

        conn.commit()
        print(f"✅ Equipamento da sessão #{aula_id} atualizado ({len(item_ids)} itens)")
        return True

    except Exception as e:
        print(f"❌ Erro ao atribuir equipamento à sessão #{aula_id}: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def verificar_conflitos(item_ids, data_hora, duracao_minutos, excluir_aula_id=None):
    """
    Verifica se algum dos itens já está atribuído a outra sessão
    que se sobrepõe no tempo.
    Retorna lista de itens em conflito com info da sessão conflituosa.
    """
    if not item_ids:
        return []

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        inicio = data_hora if isinstance(data_hora, datetime) else datetime.fromisoformat(str(data_hora))
        fim = inicio + timedelta(minutes=duracao_minutos)

        # Build placeholders for item_ids
        placeholders = ','.join(['%s'] * len(item_ids))
        params = list(item_ids) + [fim, inicio]

        exclusao = ""
        if excluir_aula_id:
            exclusao = "AND a.id != %s"
            params.append(excluir_aula_id)

        cur.execute(f"""
            SELECT DISTINCT ki.id, ki.nome, a.id AS aula_id, a.data_hora, a.duracao_minutos
            FROM aula_equipamento ae
            JOIN kit_itens ki ON ae.item_id = ki.id
            JOIN aulas a ON ae.aula_id = a.id
            WHERE ae.item_id IN ({placeholders})
              AND a.data_hora < %s
              AND a.data_hora + (a.duracao_minutos * INTERVAL '1 minute') > %s
              {exclusao}
            ORDER BY ki.id
        """, params)

        rows = cur.fetchall()
        return [
            {
                "item_id": r[0],
                "item_nome": r[1],
                "aula_id": r[2],
                "aula_data_hora": r[3].isoformat() if isinstance(r[3], datetime) else str(r[3]),
                "aula_duracao": r[4],
            }
            for r in rows
        ]

    except Exception as e:
        print(f"❌ Erro ao verificar conflitos de equipamento: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def listar_ocupacoes_item(item_id):
    """Lista sessões futuras que usam este item (para a página de gestão)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT a.id, a.data_hora, a.duracao_minutos, t.nome AS turma_nome, e.nome AS estabelecimento_nome
            FROM aula_equipamento ae
            JOIN aulas a ON ae.aula_id = a.id
            LEFT JOIN turmas t ON a.turma_id = t.id
            LEFT JOIN estabelecimentos e ON t.estabelecimento_id = e.id
            WHERE ae.item_id = %s
              AND a.data_hora + (a.duracao_minutos * INTERVAL '1 minute') > NOW()
            ORDER BY a.data_hora
        """, (item_id,))

        rows = cur.fetchall()
        return [
            {
                "aula_id": r[0],
                "data_hora": r[1].isoformat() if isinstance(r[1], datetime) else str(r[1]),
                "duracao_minutos": r[2],
                "turma_nome": r[3],
                "estabelecimento_nome": r[4],
            }
            for r in rows
        ]

    except Exception as e:
        print(f"❌ Erro ao listar ocupações do item #{item_id}: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

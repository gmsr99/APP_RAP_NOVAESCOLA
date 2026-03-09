"""
Servico de gestao de equipamento — categorias, itens individuais,
historico de utilizacao e atribuicao a sessoes.
Localizacao, ultimo responsavel e ultima utilizacao sao DERIVADOS
automaticamente das sessoes (aulas + aula_equipamento).
Usa psycopg2 (mesmo padrao que turma_service.py).
"""

import sys
import os
from datetime import datetime, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.connection import get_db_connection
from services import notification_service

# Margem de seguranca (minutos) antes e depois de cada sessao
BUFFER_MINUTOS = 60


# ---------------------------------------------------------------------------
# Alertas e notificacoes
# ---------------------------------------------------------------------------

def _notificar_coordenadores_e_mentores(titulo, mensagem, link=None):
    """Envia notificacao a todos os coordenadores e mentores."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT id FROM profiles
            WHERE role IN ('coordenador', 'mentor', 'mentor_produtor')
        """)
        user_ids = [str(r[0]) for r in cur.fetchall()]
        cur.close()
        conn.close()

        for uid in user_ids:
            notification_service.criar_notificacao(
                uid, 'equipamento', titulo, mensagem, link
            )
    except Exception as e:
        print(f"Erro ao notificar sobre equipamento: {e}")


def notificar_conflito(item_nome, item_identificador, detalhes=""):
    _notificar_coordenadores_e_mentores(
        f"Conflito de equipamento: {item_identificador}",
        f"O equipamento '{item_identificador}' ({item_nome}) tem um conflito de atribuicao. {detalhes}",
        "/equipamento",
    )


def notificar_estado_critico(item_nome, item_identificador, novo_estado):
    estado_label = {
        'indisponivel': 'Indisponivel',
        'em_manutencao': 'Em manutencao',
    }.get(novo_estado, novo_estado)

    _notificar_coordenadores_e_mentores(
        f"Equipamento {estado_label}: {item_identificador}",
        f"O equipamento '{item_identificador}' ({item_nome}) esta agora '{estado_label}'. Podera afetar sessoes futuras.",
        "/equipamento",
    )


# ---------------------------------------------------------------------------
# Categorias
# ---------------------------------------------------------------------------

def listar_categorias():
    """Retorna todas as categorias com os seus itens aninhados."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT kc.id, kc.nome, ki.id AS item_id, ki.nome AS item_nome,
                   ki.identificador, ki.estado
            FROM kit_categorias kc
            LEFT JOIN kit_itens ki ON ki.categoria_id = kc.id
            ORDER BY kc.id, ki.identificador
        """)
        rows = cur.fetchall()

        categorias = {}
        for row in rows:
            cat_id, cat_nome, item_id, item_nome, identificador, estado = row
            if cat_id not in categorias:
                categorias[cat_id] = {"id": cat_id, "nome": cat_nome, "itens": []}
            if item_id:
                categorias[cat_id]["itens"].append({
                    "id": item_id,
                    "nome": item_nome,
                    "identificador": identificador,
                    "estado": estado,
                })

        return list(categorias.values())

    except Exception as e:
        print(f"Erro ao listar categorias: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ---------------------------------------------------------------------------
# Itens individuais — CRUD
# ---------------------------------------------------------------------------

ESTADOS_VALIDOS = [
    'excelente',
    'funciona_com_observacoes',
    'falhas_pontuais',
    'em_manutencao',
    'indisponivel',
]


def listar_itens(categoria_id=None, estado=None):
    """
    Lista todos os itens individuais.
    Localizacao, ultimo responsavel e ultima utilizacao sao DERIVADOS
    da ultima sessao (passada) associada ao item via aula_equipamento.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        filtros = []
        params = []

        if categoria_id:
            filtros.append("ki.categoria_id = %s")
            params.append(categoria_id)
        if estado:
            filtros.append("ki.estado = %s")
            params.append(estado)

        where = ("WHERE " + " AND ".join(filtros)) if filtros else ""

        cur.execute(f"""
            SELECT ki.id, ki.nome, ki.identificador, ki.estado, ki.observacoes,
                   ki.categoria_id, kc.nome AS categoria_nome,
                   ki.uuid,
                   -- Dados derivados da ultima sessao passada
                   ultima.estabelecimento_id,
                   ultima.estabelecimento_nome,
                   ultima.mentor_user_id,
                   ultima.mentor_nome,
                   ultima.data_hora AS ultima_utilizacao
            FROM kit_itens ki
            JOIN kit_categorias kc ON ki.categoria_id = kc.id
            LEFT JOIN LATERAL (
                SELECT e.id   AS estabelecimento_id,
                       e.nome AS estabelecimento_nome,
                       m.user_id AS mentor_user_id,
                       p.full_name AS mentor_nome,
                       a.data_hora
                FROM aula_equipamento ae
                JOIN aulas a ON ae.aula_id = a.id
                LEFT JOIN turmas t ON a.turma_id = t.id
                LEFT JOIN estabelecimentos e ON t.estabelecimento_id = e.id
                LEFT JOIN mentores m ON a.mentor_id = m.id
                LEFT JOIN profiles p ON m.user_id::text = p.id::text
                WHERE ae.item_id = ki.id
                  AND a.data_hora <= NOW()
                ORDER BY a.data_hora DESC
                LIMIT 1
            ) ultima ON true
            {where}
            ORDER BY kc.nome, ki.identificador
        """, params)

        rows = cur.fetchall()
        return [
            {
                "id": r[0],
                "nome": r[1],
                "identificador": r[2],
                "estado": r[3],
                "observacoes": r[4],
                "categoria_id": r[5],
                "categoria_nome": r[6],
                "uuid": str(r[7]) if r[7] else None,
                "localizacao_id": r[8],
                "localizacao_nome": r[9],
                "ultimo_responsavel_id": str(r[10]) if r[10] else None,
                "responsavel_nome": r[11],
                "ultima_utilizacao": r[12].isoformat() if r[12] else None,
            }
            for r in rows
        ]

    except Exception as e:
        print(f"Erro ao listar itens: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def obter_item(item_id):
    """Obtem um item individual por ID com dados derivados de sessoes."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT ki.id, ki.nome, ki.identificador, ki.estado, ki.observacoes,
                   ki.categoria_id, kc.nome AS categoria_nome,
                   ki.uuid,
                   ultima.estabelecimento_id,
                   ultima.estabelecimento_nome,
                   ultima.mentor_user_id,
                   ultima.mentor_nome,
                   ultima.data_hora AS ultima_utilizacao
            FROM kit_itens ki
            JOIN kit_categorias kc ON ki.categoria_id = kc.id
            LEFT JOIN LATERAL (
                SELECT e.id   AS estabelecimento_id,
                       e.nome AS estabelecimento_nome,
                       m.user_id AS mentor_user_id,
                       p.full_name AS mentor_nome,
                       a.data_hora
                FROM aula_equipamento ae
                JOIN aulas a ON ae.aula_id = a.id
                LEFT JOIN turmas t ON a.turma_id = t.id
                LEFT JOIN estabelecimentos e ON t.estabelecimento_id = e.id
                LEFT JOIN mentores m ON a.mentor_id = m.id
                LEFT JOIN profiles p ON m.user_id::text = p.id::text
                WHERE ae.item_id = ki.id
                  AND a.data_hora <= NOW()
                ORDER BY a.data_hora DESC
                LIMIT 1
            ) ultima ON true
            WHERE ki.id = %s
        """, (item_id,))

        r = cur.fetchone()
        if not r:
            return None

        return {
            "id": r[0],
            "nome": r[1],
            "identificador": r[2],
            "estado": r[3],
            "observacoes": r[4],
            "categoria_id": r[5],
            "categoria_nome": r[6],
            "uuid": str(r[7]) if r[7] else None,
            "localizacao_id": r[8],
            "localizacao_nome": r[9],
            "ultimo_responsavel_id": str(r[10]) if r[10] else None,
            "responsavel_nome": r[11],
            "ultima_utilizacao": r[12].isoformat() if r[12] else None,
        }

    except Exception as e:
        print(f"Erro ao obter item #{item_id}: {e}")
        return None
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def criar_item(dados):
    """Cria um novo item de equipamento individual."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO kit_itens (categoria_id, nome, identificador, estado, observacoes)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, uuid
        """, (
            dados['categoria_id'],
            dados['nome'],
            dados['identificador'],
            dados.get('estado', 'Novo'),
            dados.get('observacoes'),
        ))

        row = cur.fetchone()
        conn.commit()
        return {'id': row[0], 'uuid': str(row[1]), 'message': 'Item criado com sucesso'}

    except Exception as e:
        print(f"Erro ao criar item: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def atualizar_item(item_id, dados):
    """Atualiza campos de um item (estado, observacoes, etc.).
    Envia notificacao se estado muda para indisponivel ou em_manutencao."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT nome, identificador, estado FROM kit_itens WHERE id = %s", (item_id,))
        row = cur.fetchone()
        if not row:
            return False
        nome_atual, ident_atual, estado_atual = row

        campos = []
        params = []

        for campo in ['nome', 'identificador', 'estado', 'observacoes', 'categoria_id']:
            if campo in dados:
                campos.append(f"{campo} = %s")
                params.append(dados[campo])

        if not campos:
            return False

        params.append(item_id)
        cur.execute(
            f"UPDATE kit_itens SET {', '.join(campos)} WHERE id = %s",
            params
        )

        conn.commit()
        updated = cur.rowcount > 0

        if updated and 'estado' in dados:
            novo_estado = dados['estado']
            if novo_estado != estado_atual and novo_estado in ('indisponivel', 'em_manutencao'):
                ident = dados.get('identificador', ident_atual)
                nome = dados.get('nome', nome_atual)
                notificar_estado_critico(nome, ident, novo_estado)

        return updated

    except Exception as e:
        print(f"Erro ao atualizar item #{item_id}: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def apagar_item(item_id):
    """Remove um item de equipamento."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("DELETE FROM kit_itens WHERE id = %s", (item_id,))
        deleted = cur.rowcount > 0
        conn.commit()
        return deleted

    except Exception as e:
        print(f"Erro ao apagar item #{item_id}: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ---------------------------------------------------------------------------
# Historico de utilizacao (auditoria)
# ---------------------------------------------------------------------------

def registar_utilizacao(item_id, user_id, user_nome=None, aula_id=None, observacoes=None):
    """Regista uma utilizacao no historico de auditoria."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO equipamento_historico (item_id, user_id, user_nome, aula_id, observacoes)
            VALUES (%s, %s, %s, %s, %s)
        """, (item_id, user_id, user_nome, aula_id, observacoes))

        conn.commit()
        return True

    except Exception as e:
        print(f"Erro ao registar utilizacao do item #{item_id}: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def listar_historico(item_id, limite=50):
    """Lista historico de utilizacao de um item (sessoes passadas + registos manuais)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Combina historico de sessoes (aula_equipamento) com registos manuais
        cur.execute("""
            (
                SELECT 'sessao' AS tipo,
                       a.id AS ref_id,
                       m.user_id AS user_id,
                       p.full_name AS user_nome,
                       a.data_hora AS data_utilizacao,
                       a.id AS aula_id,
                       e.nome AS local_nome,
                       NULL AS observacoes
                FROM aula_equipamento ae
                JOIN aulas a ON ae.aula_id = a.id
                LEFT JOIN mentores m ON a.mentor_id = m.id
                LEFT JOIN profiles p ON m.user_id::text = p.id::text
                LEFT JOIN turmas t ON a.turma_id = t.id
                LEFT JOIN estabelecimentos e ON t.estabelecimento_id = e.id
                WHERE ae.item_id = %s
            )
            UNION ALL
            (
                SELECT 'manual' AS tipo,
                       eh.id AS ref_id,
                       eh.user_id,
                       COALESCE(p.full_name, eh.user_nome) AS user_nome,
                       eh.data_utilizacao,
                       eh.aula_id,
                       NULL AS local_nome,
                       eh.observacoes
                FROM equipamento_historico eh
                LEFT JOIN profiles p ON eh.user_id = p.id
                WHERE eh.item_id = %s
            )
            ORDER BY data_utilizacao DESC
            LIMIT %s
        """, (item_id, item_id, limite))

        rows = cur.fetchall()
        return [
            {
                "tipo": r[0],
                "id": r[1],
                "user_id": str(r[2]) if r[2] else None,
                "user_nome": r[3],
                "data_utilizacao": r[4].isoformat() if r[4] else None,
                "aula_id": r[5],
                "local_nome": r[6],
                "observacoes": r[7],
            }
            for r in rows
        ]

    except Exception as e:
        print(f"Erro ao listar historico do item #{item_id}: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ---------------------------------------------------------------------------
# Atribuicao a sessoes
# ---------------------------------------------------------------------------

def listar_equipamento_sessao(aula_id):
    """Retorna os itens de equipamento atribuidos a uma sessao."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT ki.id, ki.nome, ki.identificador, kc.id AS categoria_id, kc.nome AS categoria_nome,
                   ki.estado
            FROM aula_equipamento ae
            JOIN kit_itens ki ON ae.item_id = ki.id
            JOIN kit_categorias kc ON ki.categoria_id = kc.id
            WHERE ae.aula_id = %s
            ORDER BY kc.id, ki.identificador
        """, (aula_id,))
        rows = cur.fetchall()

        return [
            {
                "id": r[0],
                "nome": r[1],
                "identificador": r[2],
                "categoria_id": r[3],
                "categoria_nome": r[4],
                "estado": r[5],
            }
            for r in rows
        ]

    except Exception as e:
        print(f"Erro ao listar equipamento da sessao #{aula_id}: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def atribuir_equipamento_sessao(aula_id, item_ids):
    """Substitui os itens de equipamento de uma sessao (delete + insert)."""
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
        return True

    except Exception as e:
        print(f"Erro ao atribuir equipamento a sessao #{aula_id}: {e}")
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
    Verifica se algum dos itens ja esta atribuido a outra sessao
    que se sobrepoe no tempo, incluindo margem de BUFFER_MINUTOS (1h)
    antes e depois de cada sessao.
    Tambem exclui itens indisponiveis/em manutencao.
    """
    if not item_ids:
        return []

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        inicio = data_hora if isinstance(data_hora, datetime) else datetime.fromisoformat(str(data_hora))
        fim = inicio + timedelta(minutes=duracao_minutos)

        # Expandir com buffer
        inicio_com_buffer = inicio - timedelta(minutes=BUFFER_MINUTOS)
        fim_com_buffer = fim + timedelta(minutes=BUFFER_MINUTOS)

        placeholders = ','.join(['%s'] * len(item_ids))
        params = list(item_ids) + [fim_com_buffer, inicio_com_buffer]

        exclusao = ""
        if excluir_aula_id:
            exclusao = "AND a.id != %s"
            params.append(excluir_aula_id)

        # Verificar sobreposicao temporal (com buffer de 1h)
        cur.execute(f"""
            SELECT DISTINCT ki.id, ki.nome, ki.identificador, a.id AS aula_id,
                   a.data_hora, a.duracao_minutos,
                   e.nome AS estabelecimento_nome,
                   p.full_name AS mentor_nome
            FROM aula_equipamento ae
            JOIN kit_itens ki ON ae.item_id = ki.id
            JOIN aulas a ON ae.aula_id = a.id
            LEFT JOIN turmas t ON a.turma_id = t.id
            LEFT JOIN estabelecimentos e ON t.estabelecimento_id = e.id
            LEFT JOIN mentores m ON a.mentor_id = m.id
            LEFT JOIN profiles p ON m.user_id::text = p.id::text
            WHERE ae.item_id IN ({placeholders})
              AND a.data_hora < %s
              AND (a.data_hora + (a.duracao_minutos * INTERVAL '1 minute')) > %s
              {exclusao}
            ORDER BY ki.id
        """, params)

        rows = cur.fetchall()
        conflitos = [
            {
                "item_id": r[0],
                "item_nome": r[1],
                "item_identificador": r[2],
                "aula_id": r[3],
                "aula_data_hora": r[4].isoformat() if isinstance(r[4], datetime) else str(r[4]),
                "aula_duracao": r[5],
                "estabelecimento_nome": r[6],
                "mentor_nome": r[7],
                "motivo": "Conflito temporal (incluindo margem de 1h)",
            }
            for r in rows
        ]

        # Verificar itens indisponiveis ou em manutencao
        cur.execute(f"""
            SELECT id, nome, identificador, estado
            FROM kit_itens
            WHERE id IN ({placeholders})
              AND estado IN ('indisponivel', 'em_manutencao')
        """, list(item_ids))

        for r in cur.fetchall():
            conflitos.append({
                "item_id": r[0],
                "item_nome": r[1],
                "item_identificador": r[2],
                "motivo": f"Item com estado: {r[3]}",
            })

        return conflitos

    except Exception as e:
        print(f"Erro ao verificar conflitos de equipamento: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def verificar_disponibilidade_item(item_id, data_hora, duracao_minutos, excluir_aula_id=None):
    """
    Verifica se um item especifico esta disponivel num dado horario.
    Retorna True se disponivel, False se ocupado.
    """
    conflitos = verificar_conflitos([item_id], data_hora, duracao_minutos, excluir_aula_id)
    return len(conflitos) == 0


def listar_ocupacoes_item(item_id):
    """Lista sessoes futuras que usam este item."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT a.id, a.data_hora, a.duracao_minutos,
                   t.nome AS turma_nome, e.nome AS estabelecimento_nome,
                   p.full_name AS mentor_nome
            FROM aula_equipamento ae
            JOIN aulas a ON ae.aula_id = a.id
            LEFT JOIN turmas t ON a.turma_id = t.id
            LEFT JOIN estabelecimentos e ON t.estabelecimento_id = e.id
            LEFT JOIN mentores m ON a.mentor_id = m.id
            LEFT JOIN profiles p ON m.user_id::text = p.id::text
            WHERE ae.item_id = %s
              AND (a.data_hora + (a.duracao_minutos * INTERVAL '1 minute')) > NOW()
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
                "mentor_nome": r[5],
            }
            for r in rows
        ]

    except Exception as e:
        print(f"Erro ao listar ocupacoes do item #{item_id}: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

def obter_stats():
    """Retorna estatisticas globais do equipamento."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM kit_itens")
        total = cur.fetchone()[0]

        cur.execute("SELECT estado, COUNT(*) FROM kit_itens GROUP BY estado")
        por_estado = {r[0]: r[1] for r in cur.fetchall()}

        cur.execute("SELECT COUNT(*) FROM kit_categorias")
        categorias = cur.fetchone()[0]

        # Contar itens atualmente em uso (sessao a decorrer agora)
        cur.execute("""
            SELECT COUNT(DISTINCT ae.item_id)
            FROM aula_equipamento ae
            JOIN aulas a ON ae.aula_id = a.id
            WHERE a.data_hora <= NOW()
              AND (a.data_hora + (a.duracao_minutos * INTERVAL '1 minute')) >= NOW()
        """)
        em_uso = cur.fetchone()[0]

        return {
            "total": total,
            "categorias": categorias,
            "por_estado": por_estado,
            "disponiveis": total - por_estado.get('indisponivel', 0) - por_estado.get('em_manutencao', 0),
            "em_uso_agora": em_uso,
        }

    except Exception as e:
        print(f"Erro ao obter stats: {e}")
        return {"total": 0, "categorias": 0, "por_estado": {}, "disponiveis": 0, "em_uso_agora": 0}
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

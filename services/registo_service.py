"""
Serviço de registos de sessão.
Gere a criação, listagem e eliminação de registos ligados a aulas (sessões).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlmodel import Session, select, text

from database.database import engine


# ============================================================================
# LISTAR SESSÕES REGISTÁVEIS (para o dropdown)
# ============================================================================

def listar_sessoes_registaveis(user_id: str) -> List[Dict[str, Any]]:
    """
    Retorna sessões terminadas/realizadas deste user que ainda não têm registo.
    - Aulas presenciais: terminadas + mentor_user_id = user_id
    - Trabalho autónomo: is_realized=true + responsavel_user_id = user_id
    """
    sql = text("""
        SELECT
            a.id,
            a.tipo,
            a.data_hora,
            a.duracao_minutos,
            a.estado,
            a.local,
            a.tema,
            a.observacoes,
            a.is_autonomous,
            a.is_realized,
            a.tipo_atividade,
            a.responsavel_user_id,
            a.musica_id,
            a.atividade_id,
            t.nome         AS turma_nome,
            t.id           AS turma_id,
            e.nome         AS estabelecimento_nome,
            e.sigla        AS estabelecimento_sigla,
            m.nome         AS mentor_nome,
            m.user_id      AS mentor_user_id,
            atv.nome       AS atividade_nome
        FROM aulas a
        LEFT JOIN turmas t            ON a.turma_id = t.id
        LEFT JOIN estabelecimentos e  ON t.estabelecimento_id = e.id
        LEFT JOIN mentores m          ON a.mentor_id = m.id
        LEFT JOIN atividades atv      ON a.atividade_id = atv.id
        WHERE
            -- Sem registo existente
            NOT EXISTS (SELECT 1 FROM registos r WHERE r.aula_id = a.id)
            AND (
                -- Aulas presenciais terminadas deste mentor
                (
                    a.is_autonomous = FALSE
                    AND a.estado = 'terminada'
                    AND m.user_id = :user_id
                )
                OR
                -- Trabalho autónomo realizado por este user
                (
                    a.is_autonomous = TRUE
                    AND a.is_realized = TRUE
                    AND a.responsavel_user_id = :user_id
                )
            )
        ORDER BY a.data_hora DESC
    """)

    try:
        with Session(engine) as session:
            rows = session.exec(sql, params={"user_id": user_id}).all()

        result = []
        for row in rows:
            result.append({
                "id": row.id,
                "tipo": row.tipo,
                "data_hora": row.data_hora.isoformat() if isinstance(row.data_hora, datetime) else str(row.data_hora),
                "duracao_minutos": row.duracao_minutos,
                "estado": row.estado,
                "local": row.local,
                "tema": row.tema,
                "observacoes": row.observacoes,
                "is_autonomous": row.is_autonomous,
                "is_realized": row.is_realized,
                "tipo_atividade": row.tipo_atividade,
                "responsavel_user_id": str(row.responsavel_user_id) if row.responsavel_user_id else None,
                "musica_id": row.musica_id,
                "turma_nome": row.turma_nome,
                "turma_id": row.turma_id,
                "estabelecimento_nome": row.estabelecimento_nome,
                "estabelecimento_sigla": row.estabelecimento_sigla,
                "mentor_nome": row.mentor_nome,
                "mentor_user_id": str(row.mentor_user_id) if row.mentor_user_id else None,
                "atividade_id": row.atividade_id,
                "atividade_nome": row.atividade_nome,
            })
        return result

    except Exception as e:
        print(f"❌ Erro ao listar sessões registáveis: {e}")
        return []


# ============================================================================
# CRUD DE REGISTOS
# ============================================================================

def listar_registos(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lista registos, opcionalmente filtrados por user_id."""
    where = "WHERE r.user_id = :user_id" if user_id else ""
    params = {"user_id": user_id} if user_id else {}

    sql = text(f"""
        SELECT
            r.id,
            r.aula_id,
            r.user_id,
            r.numero_sessao,
            r.objetivos_gerais,
            r.sumario,
            r.participantes,
            r.criado_em,
            r.atividade,
            r.data_registo,
            r.local_registo,
            r.horario,
            r.tecnicos,
            a.data_hora,
            a.duracao_minutos,
            a.tipo,
            a.is_autonomous,
            a.tipo_atividade,
            a.local,
            a.observacoes   AS aula_observacoes,
            t.nome          AS turma_nome,
            e.nome          AS estabelecimento_nome,
            e.sigla         AS estabelecimento_sigla,
            m.nome          AS mentor_nome
        FROM registos r
        JOIN aulas a              ON r.aula_id = a.id
        LEFT JOIN turmas t        ON a.turma_id = t.id
        LEFT JOIN estabelecimentos e ON t.estabelecimento_id = e.id
        LEFT JOIN mentores m      ON a.mentor_id = m.id
        {where}
        ORDER BY r.criado_em DESC
    """)

    try:
        with Session(engine) as session:
            rows = session.exec(sql, params=params).all()

        result = []
        for row in rows:
            result.append({
                "id": row.id,
                "aula_id": row.aula_id,
                "user_id": row.user_id,
                "numero_sessao": row.numero_sessao,
                "objetivos_gerais": row.objetivos_gerais,
                "sumario": row.sumario,
                "participantes": row.participantes,
                "criado_em": row.criado_em.isoformat() if isinstance(row.criado_em, datetime) else str(row.criado_em),
                "data_hora": row.data_hora.isoformat() if isinstance(row.data_hora, datetime) else str(row.data_hora),
                "duracao_minutos": row.duracao_minutos,
                "tipo": row.tipo,
                "is_autonomous": row.is_autonomous,
                "tipo_atividade": row.tipo_atividade,
                "local": row.local,
                "aula_observacoes": row.aula_observacoes,
                "atividade": row.atividade,
                "data_registo": row.data_registo,
                "local_registo": row.local_registo,
                "horario": row.horario,
                "tecnicos": row.tecnicos,
                "turma_nome": row.turma_nome,
                "estabelecimento_nome": row.estabelecimento_nome,
                "estabelecimento_sigla": row.estabelecimento_sigla,
                "mentor_nome": row.mentor_nome,
            })
        return result

    except Exception as e:
        print(f"❌ Erro ao listar registos: {e}")
        return []


def criar_registo(
    aula_id: int,
    user_id: str,
    numero_sessao: Optional[str] = None,
    objetivos_gerais: Optional[str] = None,
    sumario: Optional[str] = None,
    participantes: Optional[list] = None,
    atividade: Optional[str] = None,
    data_registo: Optional[str] = None,
    local_registo: Optional[str] = None,
    horario: Optional[str] = None,
    tecnicos: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Cria um registo de sessão."""
    import json

    sql_insert = text("""
        INSERT INTO registos (aula_id, user_id, numero_sessao, objetivos_gerais, sumario, participantes,
                              atividade, data_registo, local_registo, horario, tecnicos)
        VALUES (:aula_id, :user_id, :numero_sessao, :objetivos_gerais, :sumario, CAST(:participantes AS jsonb),
                :atividade, :data_registo, :local_registo, :horario, :tecnicos)
        RETURNING id, criado_em
    """)

    try:
        with Session(engine) as session:
            row = session.exec(
                sql_insert,
                params={
                    "aula_id": aula_id,
                    "user_id": user_id,
                    "numero_sessao": numero_sessao,
                    "objetivos_gerais": objetivos_gerais,
                    "sumario": sumario,
                    "participantes": json.dumps(participantes or []),
                    "atividade": atividade,
                    "data_registo": data_registo,
                    "local_registo": local_registo,
                    "horario": horario,
                    "tecnicos": tecnicos,
                },
            ).first()
            session.commit()

        if row:
            print(f"✅ Registo #{row.id} criado para aula #{aula_id}")
            return {
                "id": row.id,
                "aula_id": aula_id,
                "criado_em": row.criado_em.isoformat() if isinstance(row.criado_em, datetime) else str(row.criado_em),
            }
        return None

    except Exception as e:
        print(f"❌ Erro ao criar registo: {e}")
        return None


def apagar_registo(registo_id: int, user_id: str) -> bool:
    """Apaga um registo (apenas se pertence ao user)."""
    sql = text("""
        DELETE FROM registos WHERE id = :id AND user_id = :user_id
    """)

    try:
        with Session(engine) as session:
            session.exec(sql, params={"id": registo_id, "user_id": user_id})
            session.commit()
        print(f"✅ Registo #{registo_id} apagado")
        return True

    except Exception as e:
        print(f"❌ Erro ao apagar registo: {e}")
        return False

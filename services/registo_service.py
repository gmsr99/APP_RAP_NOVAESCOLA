"""
Serviço de registos de sessão.
Gere a criação, listagem e eliminação de registos ligados a aulas (sessões).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlmodel import Session, text

from database.database import engine
import logging

logger = logging.getLogger(__name__)


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
            a.atividade_uuid,
            a.objetivos,
            a.sumario,
            a.codigo_sessao,
            t.nome         AS turma_nome,
            t.id           AS turma_id,
            e.nome         AS estabelecimento_nome,
            e.sigla        AS estabelecimento_sigla,
            m.nome         AS mentor_nome,
            m.user_id      AS mentor_user_id,
            m.latitude     AS mentor_latitude,
            m.longitude    AS mentor_longitude,
            e.latitude     AS estab_latitude,
            e.longitude    AS estab_longitude,
            td.nome        AS disciplina_nome
        FROM aulas a
        LEFT JOIN turmas t            ON a.turma_id = t.id
        LEFT JOIN estabelecimentos e  ON t.estabelecimento_id = e.id
        LEFT JOIN mentores m          ON a.mentor_id = m.id
        LEFT JOIN turma_atividades ta ON a.atividade_uuid = ta.uuid
        LEFT JOIN turma_disciplinas td ON td.id = ta.turma_disciplina_id
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
                "mentor_latitude": float(row.mentor_latitude) if row.mentor_latitude else None,
                "mentor_longitude": float(row.mentor_longitude) if row.mentor_longitude else None,
                "estab_latitude": float(row.estab_latitude) if row.estab_latitude else None,
                "estab_longitude": float(row.estab_longitude) if row.estab_longitude else None,
                "atividade_uuid": str(row.atividade_uuid) if row.atividade_uuid else None,
                "disciplina_nome": row.disciplina_nome,
                "objetivos": row.objetivos,
                "sumario": row.sumario,
                "codigo_sessao": row.codigo_sessao,
            })
        return result

    except Exception as e:
        logger.error(f"Erro ao listar sessões registáveis: {e}")
        return []


def listar_todas_sessoes_registaveis() -> List[Dict[str, Any]]:
    """
    Retorna TODAS as sessões terminadas/realizadas ainda sem registo.
    Para uso exclusivo de coordenadores/direção.
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
            a.atividade_uuid,
            a.objetivos,
            a.sumario,
            a.codigo_sessao,
            t.nome         AS turma_nome,
            t.id           AS turma_id,
            e.nome         AS estabelecimento_nome,
            e.sigla        AS estabelecimento_sigla,
            m.nome         AS mentor_nome,
            m.user_id      AS mentor_user_id,
            m.latitude     AS mentor_latitude,
            m.longitude    AS mentor_longitude,
            e.latitude     AS estab_latitude,
            e.longitude    AS estab_longitude,
            td.nome        AS disciplina_nome
        FROM aulas a
        LEFT JOIN turmas t            ON a.turma_id = t.id
        LEFT JOIN estabelecimentos e  ON t.estabelecimento_id = e.id
        LEFT JOIN mentores m          ON a.mentor_id = m.id
        LEFT JOIN turma_atividades ta ON a.atividade_uuid = ta.uuid
        LEFT JOIN turma_disciplinas td ON td.id = ta.turma_disciplina_id
        WHERE
            NOT EXISTS (SELECT 1 FROM registos r WHERE r.aula_id = a.id)
            AND (
                (a.is_autonomous = FALSE AND a.estado = 'terminada')
                OR
                (a.is_autonomous = TRUE AND a.is_realized = TRUE)
            )
        ORDER BY a.data_hora DESC
    """)

    try:
        with Session(engine) as session:
            rows = session.exec(sql).all()

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
                "mentor_latitude": float(row.mentor_latitude) if row.mentor_latitude else None,
                "mentor_longitude": float(row.mentor_longitude) if row.mentor_longitude else None,
                "estab_latitude": float(row.estab_latitude) if row.estab_latitude else None,
                "estab_longitude": float(row.estab_longitude) if row.estab_longitude else None,
                "atividade_uuid": str(row.atividade_uuid) if row.atividade_uuid else None,
                "disciplina_nome": row.disciplina_nome,
                "objetivos": row.objetivos,
                "sumario": row.sumario,
                "codigo_sessao": row.codigo_sessao,
            })
        return result

    except Exception as e:
        logger.error(f"Erro ao listar todas as sessões registáveis: {e}")
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
            r.kms_percorridos,
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
                "kms_percorridos": float(row.kms_percorridos) if row.kms_percorridos is not None else None,
                "turma_nome": row.turma_nome,
                "estabelecimento_nome": row.estabelecimento_nome,
                "estabelecimento_sigla": row.estabelecimento_sigla,
                "mentor_nome": row.mentor_nome,
            })
        return result

    except Exception as e:
        logger.error(f"Erro ao listar registos: {e}")
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
    kms_percorridos: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    """Cria um registo de sessão."""
    import json

    sql_insert = text("""
        INSERT INTO registos (aula_id, user_id, numero_sessao, objetivos_gerais, sumario, participantes,
                              atividade, data_registo, local_registo, horario, tecnicos, kms_percorridos)
        VALUES (:aula_id, :user_id, :numero_sessao, :objetivos_gerais, :sumario, CAST(:participantes AS jsonb),
                :atividade, :data_registo, :local_registo, :horario, :tecnicos, :kms_percorridos)
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
                    "kms_percorridos": kms_percorridos,
                },
            ).first()
            session.commit()

        if row:
            logger.info(f"Registo #{row.id} criado para aula #{aula_id}")
            return {
                "id": row.id,
                "aula_id": aula_id,
                "criado_em": row.criado_em.isoformat() if isinstance(row.criado_em, datetime) else str(row.criado_em),
            }
        return None

    except Exception as e:
        logger.error(f"Erro ao criar registo: {e}")
        return None


def listar_registos_export(
    data_inicio: str,
    data_fim: str,
    user_ids: Optional[List[str]] = None,
    estabelecimento_ids: Optional[List[int]] = None,
) -> List[Dict[str, Any]]:
    """Lista registos para exportação com filtros de data, users e estabelecimentos."""
    conditions = [
        "r.data_registo IS NOT NULL",
        "r.data_registo != ''",
        "TO_DATE(r.data_registo, 'DD/MM/YYYY') >= TO_DATE(:data_inicio, 'YYYY-MM-DD')",
        "TO_DATE(r.data_registo, 'DD/MM/YYYY') <= TO_DATE(:data_fim, 'YYYY-MM-DD')",
    ]
    params: Dict[str, Any] = {"data_inicio": data_inicio, "data_fim": data_fim}

    if user_ids:
        conditions.append("r.user_id = ANY(:user_ids)")
        params["user_ids"] = user_ids
    if estabelecimento_ids:
        conditions.append("e.id = ANY(:estab_ids)")
        params["estab_ids"] = estabelecimento_ids

    where = "WHERE " + " AND ".join(conditions)

    sql = text(f"""
        SELECT
            r.data_registo,
            r.atividade,
            r.kms_percorridos,
            r.horario,
            a.data_hora,
            a.duracao_minutos,
            a.is_autonomous,
            a.tipo_atividade,
            t.nome          AS turma_nome,
            e.nome          AS estabelecimento_nome,
            p.full_name     AS pessoa
        FROM registos r
        JOIN aulas a              ON r.aula_id = a.id
        LEFT JOIN turmas t        ON a.turma_id = t.id
        LEFT JOIN estabelecimentos e ON t.estabelecimento_id = e.id
        LEFT JOIN mentores m      ON a.mentor_id = m.id
        LEFT JOIN profiles p      ON r.user_id = CAST(p.id AS TEXT)
        {where}
        ORDER BY r.data_registo ASC, p.full_name ASC
    """)

    try:
        with Session(engine) as session:
            rows = session.exec(sql, params=params).all()

        result = []
        for row in rows:
            # Extract start/end times from horario field or from data_hora + duracao
            hora_inicio = ""
            hora_fim = ""
            duracao_horas = ""
            if row.horario:
                # horario format: "Das XXhXXm às XXhXXm"
                import re
                match = re.findall(r'(\d{1,2})h(\d{2})', row.horario)
                if len(match) >= 2:
                    hora_inicio = f"{int(match[0][0]):02d}:{match[0][1]}"
                    hora_fim = f"{int(match[1][0]):02d}:{match[1][1]}"
            if not hora_inicio and row.data_hora:
                dt = row.data_hora if isinstance(row.data_hora, datetime) else datetime.fromisoformat(str(row.data_hora))
                hora_inicio = dt.strftime("%H:%M")
                if row.duracao_minutos:
                    from datetime import timedelta
                    end = dt + timedelta(minutes=row.duracao_minutos)
                    hora_fim = end.strftime("%H:%M")
            if row.duracao_minutos:
                h = row.duracao_minutos / 60
                duracao_horas = f"{h:.1f}"

            atividade = row.atividade or row.tipo_atividade or ""

            result.append({
                "data": row.data_registo or "",
                "pessoa": row.pessoa or "",
                "inicio": hora_inicio,
                "fim": hora_fim,
                "horas": duracao_horas,
                "kms": float(row.kms_percorridos) if row.kms_percorridos is not None else "",
                "o_que": atividade,
                "onde": row.estabelecimento_nome or "",
                "turma": row.turma_nome or "",
            })
        return result

    except Exception as e:
        logger.error(f"Erro ao exportar registos: {e}")
        return []


def apagar_registo(registo_id: int, user_id: str) -> bool:
    """Apaga um registo (apenas se pertence ao user)."""
    sql = text("""
        DELETE FROM registos WHERE id = :id AND user_id = :user_id
    """)

    try:
        with Session(engine) as session:
            session.exec(sql, params={"id": registo_id, "user_id": user_id})
            session.commit()
        logger.info(f"Registo #{registo_id} apagado")
        return True

    except Exception as e:
        logger.error(f"Erro ao apagar registo: {e}")
        return False

"""
Serviço para gestão de digitalizações de registos de sessão (aula_registos).
"""
from __future__ import annotations

import io
import logging
import os
import re
import unicodedata
import zipfile
from datetime import datetime
from typing import Any, Dict, Optional

import requests
from sqlmodel import Session, text
from supabase import create_client

from database.database import engine

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supabase client (same pattern as profile_service.py)
# ---------------------------------------------------------------------------
supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
supabase = create_client(supabase_url, supabase_key)


# ---------------------------------------------------------------------------
# 1. criar_aula_registo
# ---------------------------------------------------------------------------

def criar_aula_registo(
    aula_id: int,
    storage_path: str,
    criador_user_id: str,
) -> Dict[str, Any]:
    """
    Insere uma linha em aula_registos.
    Retorna {"ok": True, "id": N} ou {"ok": False, "erro": "..."}.
    """
    sql = text("""
        INSERT INTO aula_registos (aula_id, storage_path, criado_por)
        VALUES (:aula_id, :storage_path, :criado_por)
        ON CONFLICT (aula_id) DO UPDATE
            SET storage_path = EXCLUDED.storage_path,
                criado_por   = EXCLUDED.criado_por,
                criado_em    = CURRENT_TIMESTAMP
        RETURNING id
    """)
    try:
        with Session(engine) as session:
            row = session.exec(
                sql,
                params={
                    "aula_id": aula_id,
                    "storage_path": storage_path,
                    "criado_por": criador_user_id,
                },
            ).first()
            session.commit()

        if row:
            logger.info(f"aula_registo #{row.id} criado para aula #{aula_id}")
            return {"ok": True, "id": row.id}
        return {"ok": False, "erro": "Nenhuma linha retornada após inserção"}

    except Exception as e:
        logger.error(f"Erro ao criar aula_registo para aula #{aula_id}: {e}")
        return {"ok": False, "erro": str(e)}


# ---------------------------------------------------------------------------
# 2. obter_registo_por_aula
# ---------------------------------------------------------------------------

def obter_registo_por_aula(aula_id: int) -> Optional[Dict[str, Any]]:
    """
    Retorna o registo de digitalização da aula indicada ou None se não existir.
    """
    sql = text("""
        SELECT aula_id, storage_path, criado_por, criado_em
        FROM aula_registos
        WHERE aula_id = :aula_id
        LIMIT 1
    """)
    try:
        with Session(engine) as session:
            row = session.exec(sql, params={"aula_id": aula_id}).first()

        if row is None:
            return None

        return {
            "aula_id": row.aula_id,
            "storage_path": row.storage_path,
            "criado_por": row.criado_por,
            "criado_em": (
                row.criado_em.isoformat()
                if isinstance(row.criado_em, datetime)
                else str(row.criado_em)
            ),
        }

    except Exception as e:
        logger.error(f"Erro ao obter registo da aula #{aula_id}: {e}")
        return None


# ---------------------------------------------------------------------------
# 3. exportar_registos_zip
# ---------------------------------------------------------------------------

def _sanitize_name(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^\w]", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "Sem_Nome"


def exportar_registos_zip(
    projeto_id: int,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
) -> bytes:
    """
    Gera um ZIP com os PDFs dos registos organizados em pastas:
    Projeto/Estabelecimento/Turma/Disciplina/Mentor/Registo_*.pdf
    """
    conditions = ["a.projeto_id = :projeto_id"]
    params: Dict[str, Any] = {"projeto_id": projeto_id}

    if data_inicio:
        conditions.append("a.data_hora >= :data_inicio")
        params["data_inicio"] = data_inicio

    if data_fim:
        conditions.append("a.data_hora <= :data_fim")
        params["data_fim"] = data_fim

    where_clause = " AND ".join(conditions)

    sql = text(f"""
        SELECT
            ar.storage_path,
            ar.aula_id,
            p.nome  AS projeto_nome,
            e.nome  AS estabelecimento_nome,
            t.nome  AS turma_nome,
            COALESCE(td.nome, 'Sem Disciplina') AS disciplina_nome,
            m.nome  AS mentor_nome
        FROM aula_registos ar
        JOIN aulas a              ON ar.aula_id = a.id
        JOIN projetos p           ON a.projeto_id = p.id
        JOIN turmas t             ON a.turma_id = t.id
        JOIN estabelecimentos e   ON t.estabelecimento_id = e.id
        JOIN mentores m           ON a.mentor_id = m.id
        LEFT JOIN turma_atividades ta ON ta.uuid = a.atividade_uuid
        LEFT JOIN turma_disciplinas td ON td.id = ta.turma_disciplina_id
        WHERE {where_clause}
        ORDER BY a.data_hora ASC
    """)

    try:
        with Session(engine) as session:
            rows = session.exec(sql, params=params).all()
    except Exception as e:
        logger.error(f"Erro ao consultar aula_registos para ZIP: {e}")
        rows = []

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for row in rows:
            storage_path = row.storage_path
            aula_id = row.aula_id
            proj = _sanitize_name(row.projeto_nome or "Projeto")
            estab = _sanitize_name(row.estabelecimento_nome or "Estabelecimento")
            turma = _sanitize_name(row.turma_nome or "Turma")
            disc = _sanitize_name(row.disciplina_nome or "Sem_Disciplina")
            mentor = _sanitize_name(row.mentor_nome or "Mentor")

            try:
                response = supabase.storage.from_("registos-sessoes").create_signed_url(
                    storage_path, 60
                )
                signed_url = response.get("signedURL") or response.get("signedUrl")
                if not signed_url:
                    logger.warning(f"Sem URL assinada para aula #{aula_id}: {response}")
                    continue
            except Exception as e:
                logger.error(f"Erro URL assinada aula #{aula_id}: {e}")
                continue

            try:
                dl = requests.get(signed_url, timeout=30, verify=False)  # noqa: S501
                dl.raise_for_status()
                pdf_bytes = dl.content
            except Exception as e:
                logger.error(f"Erro download PDF aula #{aula_id}: {e}")
                continue

            file_name = f"Registo_{proj}_{turma}_{disc}_{mentor}.pdf"
            zip_path = f"{proj}/{estab}/{turma}/{disc}/{mentor}/{file_name}"
            zf.writestr(zip_path, pdf_bytes)

    return zip_buffer.getvalue()

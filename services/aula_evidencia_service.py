"""
Serviço para gestão de evidências fotográficas de sessão (aula_evidencias).
"""
from __future__ import annotations

import io
import logging
import os
import re
import unicodedata
import zipfile
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from sqlmodel import Session, text
from supabase import create_client

from database.database import engine

logger = logging.getLogger(__name__)

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
supabase = create_client(supabase_url, supabase_key)

BUCKET = "evidencias-sessoes"


def _sanitize_name(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^\w]", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "Sem_Nome"


def criar_evidencia(
    aula_id: int,
    storage_path: str,
    criador_user_id: str,
) -> Dict[str, Any]:
    """Insere uma linha em aula_evidencias."""
    sql = text("""
        INSERT INTO aula_evidencias (aula_id, storage_path, criado_por)
        VALUES (:aula_id, :storage_path, :criado_por)
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
            return {"ok": True, "id": row.id}
        return {"ok": False, "erro": "Nenhuma linha retornada após inserção"}
    except Exception as e:
        logger.error(f"Erro ao criar evidencia para aula #{aula_id}: {e}")
        return {"ok": False, "erro": str(e)}


def exportar_evidencias_zip(
    projeto_id: int,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
) -> bytes:
    """
    Gera um ZIP com as fotos de evidência organizadas em pastas:
    Projeto/Estabelecimento/Turma/Mentor/evidencia_N.jpg
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
            ae.storage_path,
            ae.aula_id,
            p.nome  AS projeto_nome,
            e.nome  AS estabelecimento_nome,
            t.nome  AS turma_nome,
            m.nome  AS mentor_nome,
            ROW_NUMBER() OVER (PARTITION BY ae.aula_id ORDER BY ae.id) AS foto_num
        FROM aula_evidencias ae
        JOIN aulas a              ON ae.aula_id = a.id
        JOIN projetos p           ON a.projeto_id = p.id
        JOIN turmas t             ON a.turma_id = t.id
        JOIN estabelecimentos e   ON t.estabelecimento_id = e.id
        JOIN mentores m           ON a.mentor_id = m.id
        WHERE {where_clause}
        ORDER BY a.data_hora ASC, ae.id ASC
    """)

    try:
        with Session(engine) as session:
            rows = session.exec(sql, params=params).all()
    except Exception as e:
        logger.error(f"Erro ao consultar aula_evidencias para ZIP: {e}")
        rows = []

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for row in rows:
            storage_path = row.storage_path
            aula_id = row.aula_id
            proj  = _sanitize_name(row.projeto_nome or "Projeto")
            estab = _sanitize_name(row.estabelecimento_nome or "Estabelecimento")
            turma = _sanitize_name(row.turma_nome or "Turma")
            mentor = _sanitize_name(row.mentor_nome or "Mentor")
            foto_num = row.foto_num

            try:
                response = supabase.storage.from_(BUCKET).create_signed_url(storage_path, 60)
                signed_url = response.get("signedURL") or response.get("signedUrl")
                if not signed_url:
                    logger.warning(f"Sem URL assinada para evidencia aula #{aula_id}: {response}")
                    continue
            except Exception as e:
                logger.error(f"Erro URL assinada evidencia aula #{aula_id}: {e}")
                continue

            try:
                dl = requests.get(signed_url, timeout=30, verify=False)  # noqa: S501
                dl.raise_for_status()
                img_bytes = dl.content
            except Exception as e:
                logger.error(f"Erro download evidencia aula #{aula_id}: {e}")
                continue

            ext = storage_path.rsplit(".", 1)[-1] if "." in storage_path else "jpg"
            file_name = f"evidencia_{foto_num}.{ext}"
            zip_path = f"{proj}/{estab}/{turma}/{mentor}/{aula_id}/{file_name}"
            zf.writestr(zip_path, img_bytes)

    return zip_buffer.getvalue()


def exportar_feedback_zip(
    projeto_id: int,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
) -> bytes:
    """
    Gera um ZIP com os áudios de feedback organizados em pastas:
    Projeto/Estabelecimento/Turma/Mentor/feedback_<aulaId>.mp3
    """
    conditions = [
        "a.projeto_id = :projeto_id",
        "a.feedback_audio_path IS NOT NULL",
    ]
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
            a.id        AS aula_id,
            a.feedback_audio_path,
            p.nome      AS projeto_nome,
            e.nome      AS estabelecimento_nome,
            t.nome      AS turma_nome,
            m.nome      AS mentor_nome
        FROM aulas a
        JOIN projetos p           ON a.projeto_id = p.id
        JOIN turmas t             ON a.turma_id = t.id
        JOIN estabelecimentos e   ON t.estabelecimento_id = e.id
        JOIN mentores m           ON a.mentor_id = m.id
        WHERE {where_clause}
        ORDER BY a.data_hora ASC
    """)

    try:
        with Session(engine) as session:
            rows = session.exec(sql, params=params).all()
    except Exception as e:
        logger.error(f"Erro ao consultar feedback para ZIP: {e}")
        rows = []

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for row in rows:
            storage_path = row.feedback_audio_path
            aula_id = row.aula_id
            proj  = _sanitize_name(row.projeto_nome or "Projeto")
            estab = _sanitize_name(row.estabelecimento_nome or "Estabelecimento")
            turma = _sanitize_name(row.turma_nome or "Turma")
            mentor = _sanitize_name(row.mentor_nome or "Mentor")

            try:
                response = supabase.storage.from_("feedback-sessoes").create_signed_url(storage_path, 60)
                signed_url = response.get("signedURL") or response.get("signedUrl")
                if not signed_url:
                    logger.warning(f"Sem URL assinada para feedback aula #{aula_id}")
                    continue
            except Exception as e:
                logger.error(f"Erro URL assinada feedback aula #{aula_id}: {e}")
                continue

            try:
                dl = requests.get(signed_url, timeout=30, verify=False)  # noqa: S501
                dl.raise_for_status()
                audio_bytes = dl.content
            except Exception as e:
                logger.error(f"Erro download feedback aula #{aula_id}: {e}")
                continue

            file_name = f"feedback_{aula_id}.mp3"
            zip_path = f"{proj}/{estab}/{turma}/{mentor}/{file_name}"
            zf.writestr(zip_path, audio_bytes)

    return zip_buffer.getvalue()

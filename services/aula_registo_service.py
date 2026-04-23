"""
Serviço para gestão de digitalizações de registos de sessão (aula_registos).
"""
from __future__ import annotations

import io
import logging
import os
from datetime import datetime
from typing import Any, Dict, Optional

import requests
from pypdf import PdfReader, PdfWriter
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
# 3. compilar_pdf_registos
# ---------------------------------------------------------------------------

def compilar_pdf_registos(
    projeto_id: int,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    estabelecimento_id: Optional[int] = None,
    disciplina: Optional[str] = None,
    mentor_id: Optional[str] = None,
) -> bytes:
    """
    Agrega os PDFs digitalizados dos registos que satisfazem os filtros num único
    ficheiro PDF multi-página e devolve-o como bytes.

    Parâmetros
    ----------
    projeto_id       : obrigatório
    data_inicio      : YYYY-MM-DD  (inclusivo)
    data_fim         : YYYY-MM-DD  (inclusivo)
    estabelecimento_id: filtra por estabelecimento da turma
    disciplina       : nome da disciplina (turma_disciplinas.nome)
    mentor_id        : UUID do mentor (mentores.user_id)
    """
    # ------------------------------------------------------------------ query
    conditions = ["a.projeto_id = :projeto_id"]
    params: Dict[str, Any] = {"projeto_id": projeto_id}

    if data_inicio:
        conditions.append("a.data_hora >= :data_inicio")
        params["data_inicio"] = data_inicio

    if data_fim:
        conditions.append("a.data_hora <= :data_fim")
        params["data_fim"] = data_fim

    if estabelecimento_id:
        conditions.append("t.estabelecimento_id = :estabelecimento_id")
        params["estabelecimento_id"] = estabelecimento_id

    if disciplina:
        conditions.append(
            "t.id IN ("
            "  SELECT turma_id FROM turma_atividades ta"
            "  JOIN turma_disciplinas td ON td.id = ta.turma_disciplina_id"
            "  WHERE td.nome = :disciplina"
            ")"
        )
        params["disciplina"] = disciplina

    if mentor_id:
        conditions.append("m.user_id = :mentor_id")
        params["mentor_id"] = mentor_id

    where_clause = " AND ".join(conditions)

    sql = text(f"""
        SELECT
            ar.storage_path,
            ar.aula_id
        FROM aula_registos ar
        JOIN aulas a              ON ar.aula_id = a.id
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
        logger.error(f"Erro ao consultar aula_registos para compilação PDF: {e}")
        rows = []

    # -------------------------------------------------- download & merge PDFs
    writer = PdfWriter()

    for row in rows:
        storage_path = row.storage_path
        aula_id = row.aula_id

        # Generate signed URL (TTL 60 s)
        try:
            response = supabase.storage.from_("registos-sessoes").create_signed_url(
                storage_path, 60
            )
            signed_url = response.get("signedURL") or response.get("signedUrl")
            if not signed_url:
                logger.warning(
                    f"Não foi possível obter URL assinada para aula #{aula_id} "
                    f"(path: {storage_path}): {response}"
                )
                continue
        except Exception as e:
            logger.error(
                f"Erro ao gerar URL assinada para aula #{aula_id} "
                f"(path: {storage_path}): {e}"
            )
            continue

        # Download PDF
        try:
            dl = requests.get(signed_url, timeout=30, verify=False)  # noqa: S501
            dl.raise_for_status()
            pdf_bytes = dl.content
        except Exception as e:
            logger.error(
                f"Erro ao descarregar PDF da aula #{aula_id} "
                f"(path: {storage_path}): {e}"
            )
            continue

        # Append pages to writer
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
            for page in reader.pages:
                writer.add_page(page)
        except Exception as e:
            logger.error(
                f"Erro ao processar PDF da aula #{aula_id} "
                f"(path: {storage_path}): {e}"
            )
            continue

    # If no pages were added, return a minimal valid PDF (single blank page)
    if len(writer.pages) == 0:
        logger.info("Nenhum PDF encontrado para os filtros fornecidos — devolvendo PDF em branco")
        blank_writer = PdfWriter()
        blank_writer.add_blank_page(width=595, height=842)  # A4 in points
        output = io.BytesIO()
        blank_writer.write(output)
        return output.getvalue()

    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()

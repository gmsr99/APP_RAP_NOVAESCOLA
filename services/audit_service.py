"""
audit_service.py
Registo de auditoria de ações administrativas (tabela audit_logs).
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from database.connection import get_db_connection

logger = logging.getLogger(__name__)


def registar(
    user_id: Optional[str],
    user_email: Optional[str],
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[Any] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Insere uma linha em audit_logs. Fire-and-forget — erros são apenas logged."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO audit_logs
              (user_id, user_email, action, target_type, target_id, details, ip_address)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                user_id,
                user_email,
                action,
                target_type,
                str(target_id) if target_id is not None else None,
                json.dumps(details) if details is not None else None,
                ip_address,
            ),
        )
        conn.commit()
    except Exception as e:
        logger.warning("Erro ao gravar audit_log: %s", e)
        try:
            conn.rollback()
        except Exception:
            pass
    finally:
        conn.close()


def listar(limit: int = 200) -> List[Dict[str, Any]]:
    """Devolve as últimas `limit` entradas do audit log, mais recentes primeiro."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT id, user_id::text, user_email, action, target_type, target_id,
                   details, ip_address, created_at
              FROM audit_logs
             ORDER BY created_at DESC
             LIMIT %s
            """,
            (limit,),
        )
        rows = cur.fetchall()
        return [
            {
                "id": row[0],
                "user_id": row[1],
                "user_email": row[2],
                "action": row[3],
                "target_type": row[4],
                "target_id": row[5],
                "details": row[6],
                "ip_address": row[7],
                "created_at": row[8].isoformat() if row[8] else None,
            }
            for row in rows
        ]
    except Exception as e:
        logger.error("Erro ao listar audit_logs: %s", e)
        return []
    finally:
        conn.close()

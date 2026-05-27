"""
settings_service.py
Lê e grava configurações globais do sistema (tabela system_settings).
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional, Set

from database.connection import get_db_connection

logger = logging.getLogger(__name__)

_settings_cache: dict = {}
_CACHE_DIRTY = True


def _invalidate_cache() -> None:
    global _CACHE_DIRTY
    _CACHE_DIRTY = True


def obter_todas() -> dict:
    """Devolve todas as linhas de system_settings como {key: {value, label, description, updated_at}}."""
    global _settings_cache, _CACHE_DIRTY
    if not _CACHE_DIRTY and _settings_cache:
        return _settings_cache
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT key, value, label, description, updated_at FROM system_settings ORDER BY key"
        )
        rows = cur.fetchall()
        result = {}
        for key, value, label, description, updated_at in rows:
            result[key] = {
                "value": value,
                "label": label,
                "description": description,
                "updated_at": updated_at.isoformat() if updated_at else None,
            }
        _settings_cache = result
        _CACHE_DIRTY = False
        return result
    except Exception as e:
        logger.error("Erro ao ler system_settings: %s", e)
        return {}
    finally:
        conn.close()


def obter(key: str, default: Any = None) -> Any:
    """Devolve o valor JSON desserializado de uma setting específica."""
    settings = obter_todas()
    entry = settings.get(key)
    if entry is None:
        return default
    return entry["value"]


def definir(key: str, value: Any, updated_by_user_id: Optional[str] = None) -> bool:
    """
    Actualiza o valor de uma setting existente.
    Não cria novas chaves em runtime — apenas actualiza linhas já criadas via migration.
    """
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE system_settings
               SET value = %s::jsonb,
                   updated_at = NOW(),
                   updated_by = %s
             WHERE key = %s
            """,
            (json.dumps(value), updated_by_user_id, key),
        )
        if cur.rowcount == 0:
            logger.warning("Setting '%s' não existe na BD — não foi criada.", key)
            conn.rollback()
            return False
        conn.commit()
        _invalidate_cache()
        return True
    except Exception as e:
        conn.rollback()
        logger.error("Erro ao gravar setting '%s': %s", key, e)
        return False
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Helpers semânticos
# ---------------------------------------------------------------------------

def ocultar_sessoes_direcao() -> bool:
    """Devolve True se a setting ocultar_sessoes_direcao estiver activada."""
    return bool(obter("ocultar_sessoes_direcao", False))


def obter_direcao_user_ids() -> Set[str]:
    """Devolve o conjunto de IDs (str) dos users com is_direcao=TRUE ou is_root=TRUE."""
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id::text FROM profiles WHERE is_direcao = TRUE OR is_root = TRUE"
        )
        return {row[0] for row in cur.fetchall()}
    except Exception as e:
        logger.warning("Erro ao buscar direcao_user_ids: %s", e)
        return set()
    finally:
        conn.close()

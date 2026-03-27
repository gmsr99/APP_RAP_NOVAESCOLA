"""
==============================================================================
RAP NOVA ESCOLA - Serviço de Web Push Notifications
==============================================================================
Ficheiro: services/push_service.py

Envia push notifications via VAPID (Web Push Protocol).
Suporta iOS 16.4+ (standalone) e Android.
"""

import os
import base64
import json
import logging
import threading
from database.connection import get_db_connection

logger = logging.getLogger(__name__)

VAPID_PRIVATE_KEY_B64 = os.getenv("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_CONTACT = os.getenv("VAPID_CONTACT", "mailto:admin@rapnovaescola.pt")


def _get_vapid_private_key_pem() -> str:
    """Decode a base64-encoded PEM private key from the env var."""
    if not VAPID_PRIVATE_KEY_B64:
        return None
    try:
        return base64.b64decode(VAPID_PRIVATE_KEY_B64).decode("utf-8")
    except Exception as e:
        logger.error("Erro ao descodificar VAPID_PRIVATE_KEY: %s", e)
        return None


def guardar_subscricao(user_id: str, endpoint: str, p256dh: str, auth: str) -> bool:
    """Guarda (ou atualiza) uma subscrição push para um utilizador."""
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, endpoint) DO UPDATE
                SET p256dh = EXCLUDED.p256dh,
                    auth   = EXCLUDED.auth
            """,
            (user_id, endpoint, p256dh, auth),
        )
        conn.commit()
        logger.info("Push subscription guardada para user %s", user_id)
        return True
    except Exception as e:
        logger.error("Erro ao guardar push subscription: %s", e)
        if conn:
            conn.rollback()
        return False
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def remover_subscricao(user_id: str, endpoint: str) -> bool:
    """Remove uma subscrição push."""
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM push_subscriptions WHERE user_id = %s AND endpoint = %s",
            (user_id, endpoint),
        )
        conn.commit()
        return True
    except Exception as e:
        logger.error("Erro ao remover push subscription: %s", e)
        if conn:
            conn.rollback()
        return False
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def obter_subscricoes_user(user_id: str) -> list:
    """Retorna todas as subscrições ativas de um utilizador."""
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = %s",
            (user_id,),
        )
        rows = cur.fetchall()
        return [{"endpoint": r[0], "p256dh": r[1], "auth": r[2]} for r in rows]
    except Exception as e:
        logger.error("Erro ao obter subscrições: %s", e)
        return []
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def _enviar_push(sub: dict, payload: dict, private_key_pem: str):
    """Envia um push para uma subscrição específica (síncrono)."""
    try:
        from pywebpush import webpush, WebPushException

        webpush(
            subscription_info={
                "endpoint": sub["endpoint"],
                "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]},
            },
            data=json.dumps(payload),
            vapid_private_key=private_key_pem,
            vapid_claims={"sub": VAPID_CONTACT},
        )
        return True
    except Exception as e:
        err_str = str(e)
        # 410 Gone = subscrição expirada/cancelada pelo browser — remover
        if "410" in err_str or "404" in err_str:
            logger.info("Subscrição expirada, a remover: %s", sub["endpoint"][:60])
            _remover_subscricao_por_endpoint(sub["endpoint"])
        else:
            logger.warning("Falha ao enviar push para %s: %s", sub["endpoint"][:60], err_str)
        return False


def _remover_subscricao_por_endpoint(endpoint: str):
    """Remove subscrição pelo endpoint (sem user_id, para limpeza de expiradas)."""
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM push_subscriptions WHERE endpoint = %s", (endpoint,))
        conn.commit()
    except Exception as e:
        logger.error("Erro ao remover subscrição expirada: %s", e)
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def enviar_push_para_user(user_id: str, titulo: str, mensagem: str, link: str = "/", notif_id=None):
    """
    Envia push notification para todas as subscrições de um utilizador.
    Executado em background thread para não bloquear a resposta da API.
    """
    private_key_pem = _get_vapid_private_key_pem()
    if not private_key_pem:
        logger.warning("VAPID_PRIVATE_KEY não configurada — push não enviado")
        return

    def _task():
        subs = obter_subscricoes_user(user_id)
        if not subs:
            return
        payload = {"title": titulo, "body": mensagem, "url": link or "/"}
        if notif_id is not None:
            payload["notif_id"] = notif_id
        for sub in subs:
            _enviar_push(sub, payload, private_key_pem)

    thread = threading.Thread(target=_task, daemon=True)
    thread.start()

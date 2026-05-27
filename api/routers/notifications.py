import os
from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import push_service, notification_service

router = APIRouter()


class PushSubscribePayload(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class PushUnsubscribePayload(BaseModel):
    endpoint: str


@router.get("/api/notifications", tags=["Notifications"])
async def get_notifications(user=Depends(get_current_user_required)):
    """
    Lista notificações de um utilizador.
    O user_id é extraído do token JWT (sub).
    """
    try:
        # Extrair user_id do token (campo 'sub' é o UUID no Supabase)
        uid = user.get("sub")

        if not uid:
            raise HTTPException(status_code=401, detail="Token inválido ou sem ID")

        notificacoes = notification_service.listar_notificacoes(uid)
        return notificacoes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/notifications/{id}/read", tags=["Notifications"])
async def mark_notification_read(id: int, user=Depends(get_current_user_required)):
    """
    Marca notificação como lida (apenas do próprio utilizador).
    """
    uid = user.get("sub")
    notif = notification_service.obter_notificacao(id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    if notif.get("user_id") != uid:
        raise HTTPException(status_code=403, detail="Sem permissão para esta notificação")
    sucesso = notification_service.marcar_como_lida(id)
    if sucesso:
        return {"message": "Notificação marcada como lida"}
    raise HTTPException(status_code=500, detail="Erro ao marcar notificação")


@router.delete("/api/notifications/{id}", tags=["Notifications"])
async def delete_notification(id: int, user=Depends(get_current_user_required)):
    """
    Apaga notificação (apenas do próprio utilizador).
    """
    uid = user.get("sub")
    notif = notification_service.obter_notificacao(id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    if notif.get("user_id") != uid:
        raise HTTPException(status_code=403, detail="Sem permissão para esta notificação")
    sucesso = notification_service.apagar_notificacao(id)
    if sucesso:
        return {"message": "Notificação apagada"}
    raise HTTPException(status_code=500, detail="Erro ao apagar notificação")


@router.delete("/api/notifications", tags=["Notifications"])
async def delete_all_notifications(user=Depends(get_current_user_required)):
    """Apaga todas as notificações do user autenticado."""
    uid = user.get("sub")
    count = notification_service.apagar_todas_notificacoes(uid)
    return {"message": f"{count} notificações apagadas"}


@router.get("/api/push/vapid-key", tags=["Push"])
async def get_vapid_public_key():
    """Retorna a chave pública VAPID para o frontend subscrever push."""
    key = os.getenv("VAPID_PUBLIC_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Push notifications não configuradas")
    return {"public_key": key}


@router.post("/api/push/subscribe", tags=["Push"])
async def push_subscribe(payload: PushSubscribePayload, user=Depends(get_current_user_required)):
    """Guarda subscrição push do utilizador autenticado."""
    uid = user.get("sub")
    sucesso = push_service.guardar_subscricao(uid, payload.endpoint, payload.p256dh, payload.auth)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao guardar subscrição")
    return {"ok": True}


@router.post("/api/push/unsubscribe", tags=["Push"])
async def push_unsubscribe(payload: PushUnsubscribePayload, user=Depends(get_current_user_required)):
    """Remove subscrição push do utilizador autenticado."""
    uid = user.get("sub")
    push_service.remover_subscricao(uid, payload.endpoint)
    return {"ok": True}

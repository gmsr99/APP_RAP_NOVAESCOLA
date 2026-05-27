from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import chat_service

router = APIRouter()


class ChatNotifyPayload(BaseModel):
    channel_id: str


class DMPayload(BaseModel):
    other_user_id: str


@router.post("/api/chat/notify", tags=["Chat"])
async def chat_notify(payload: ChatNotifyPayload, user=Depends(get_current_user_required)):
    """Cria notificacao singleton para membros do canal (exceto sender)."""
    sender_id = user.get("sub")
    chat_service.notificar_mensagem_chat(payload.channel_id, sender_id)
    return {"ok": True}


@router.post("/api/chat/mark-read", tags=["Chat"])
async def chat_mark_read(user=Depends(get_current_user_required)):
    """Marca a notificacao chat_unread como lida para o user."""
    user_id = user.get("sub")
    chat_service.marcar_chat_notificacao_lida(user_id)
    return {"ok": True}


@router.post("/api/chat/dm", tags=["Chat"])
async def get_or_create_dm(payload: DMPayload, user=Depends(get_current_user_required)):
    """Obtem ou cria um canal DM entre o user e outro."""
    user_id = user.get("sub")
    result = chat_service.obter_ou_criar_dm(user_id, payload.other_user_id)
    if not result:
        raise HTTPException(status_code=500, detail="Erro ao criar DM")
    return result

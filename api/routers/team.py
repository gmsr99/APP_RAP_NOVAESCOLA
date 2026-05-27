from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import profile_service, turma_service, notification_service

router = APIRouter()

MENTOR_ROLES = {'mentor', 'produtor', 'mentor_produtor', 'coordenador', 'videomaker'}


class EquipaMembroUpdate(BaseModel):
    role: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class ProducaoColsUpdate(BaseModel):
    cols: Optional[list] = None  # None = mostrar todas


class AvatarPayload(BaseModel):
    avatar_url: str


class MentorLocationUpdate(BaseModel):
    morada: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


@router.get("/api/equipa", tags=["Core"])
async def get_equipa(user=Depends(get_current_user_required)):
    """Lista todos os membros da equipa (perfis públicos)."""
    return profile_service.listar_perfis()


@router.delete("/api/equipa/{user_id}", tags=["Core"])
async def delete_equipa_member(user_id: str, user=Depends(get_current_user_required)):
    """Apaga permanentemente um membro da equipa (apenas direção)."""
    _require_direcao(user)
    caller_id = user.get("sub")
    perfis = profile_service.listar_perfis()
    if user_id == caller_id:
        raise HTTPException(status_code=400, detail="Não podes apagar a tua própria conta.")
    target_profile = next((p for p in perfis if p.get("id") == user_id), None)
    if not target_profile:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado.")
    try:
        profile_service.apagar_utilizador(user_id)
        return {"message": "Utilizador apagado com sucesso."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/api/equipa/{user_id}", tags=["Core"])
async def update_equipa_member(user_id: str, payload: EquipaMembroUpdate, user=Depends(get_current_user_required)):
    """Atualiza role, nome e avatar de um membro (apenas direção/it_support)."""
    _require_direcao(user)
    caller_id = user.get("sub")
    perfis = profile_service.listar_perfis()
    if user_id == caller_id:
        raise HTTPException(status_code=400, detail="Usa a página de perfil para editar os teus dados.")
    target_profile = next((p for p in perfis if p.get("id") == user_id), None)
    if not target_profile:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado.")
    from services import permission_service
    roles_validos = {r["name"] for r in permission_service.listar_roles()}
    if payload.role is not None and payload.role not in roles_validos:
        raise HTTPException(status_code=400, detail="Role inválido.")
    dados = {k: v for k, v in payload.model_dump().items() if v is not None}
    sucesso = profile_service.atualizar_membro(user_id, dados)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar membro.")
    return {"ok": True}


@router.patch("/api/equipa/{user_id}/producao-cols", tags=["Core"])
async def update_producao_cols(user_id: str, payload: ProducaoColsUpdate, user=Depends(get_current_user_required)):
    """Define colunas visíveis da produção para um utilizador (apenas admins)."""
    _require_direcao(user)
    sucesso = profile_service.atualizar_producao_cols(user_id, payload.cols)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao guardar configuração.")
    return {"ok": True}


@router.patch("/api/profile/avatar", tags=["Core"])
async def update_avatar(payload: AvatarPayload, user=Depends(get_current_user_required)):
    """Atualiza avatar_url na tabela profiles."""
    from db import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE profiles SET avatar_url = %s WHERE id = %s",
            (payload.avatar_url, user["sub"])
        )
        conn.commit()
        cur.close()
        return {"ok": True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


@router.get("/api/mentores/me", tags=["Core"])
async def get_my_mentor(user=Depends(get_current_user_required)):
    """Retorna o registo de mentor do user autenticado (auto-cria se necessário)."""
    user_id = user.get("sub")
    email = user.get("email")
    mentor = turma_service.obter_mentor_por_user_id(user_id, email)
    if not mentor:
        # Auto-criar se o role do user justifica entrada na tabela mentores
        meta = user.get("user_metadata") or {}
        role = meta.get("role", "")
        if role in MENTOR_ROLES:
            nome = meta.get("full_name") or (email or "").split("@")[0]
            mentor = turma_service.criar_mentor(user_id, nome, email, role)
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor não encontrado")
    return mentor


@router.patch("/api/mentores/{mentor_id}/location", tags=["Core"])
async def update_mentor_location(mentor_id: int, payload: MentorLocationUpdate, user=Depends(get_current_user_required)):
    """Atualiza a morada e coordenadas de um mentor."""
    sucesso = turma_service.atualizar_localizacao_mentor(
        mentor_id, payload.morada, payload.latitude, payload.longitude
    )
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar localização.")
    return {"ok": True}

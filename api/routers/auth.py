from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc

router = APIRouter()


@router.get("/", tags=["Root"])
async def read_root():
    """
    Endpoint principal. Retorna uma mensagem de boas-vindas.
    Útil para verificar se a API está a funcionar.
    """
    return {"message": "Bem-vindo à API do RAP Nova Escola!"}


@router.get("/api/me", tags=["Auth"])
async def get_me(user=Depends(get_current_user_optional)):
    """
    Retorna o user atual se estiver autenticado (JWT do Supabase no header Authorization).
    Se não houver token ou SUPABASE_JWT_SECRET não estiver definido, retorna null.
    """
    if user is None:
        return {"user": None}
    return {
        "user": {
            "id": user.get("sub"),
            "email": user.get("email"),
            "name": (user.get("user_metadata") or {}).get("full_name") or user.get("email", "").split("@")[0],
            "role": (user.get("user_metadata") or {}).get("role", "coordenador"),
        }
    }


@router.get("/api/me/permissions", tags=["Admin"])
async def get_my_permissions(user=Depends(get_current_user_required)):
    """Devolve as permissões completas do utilizador autenticado."""
    user_id = user.get("sub")
    perms = _perm_svc.get_user_permissions(user_id)
    return {
        "is_root": perms["is_root"],
        "is_direcao": perms["is_direcao"],
        "is_coordenacao": perms["is_coordenacao"],
        "role": perms["role"],
        "allowed_pages": list(perms["allowed_pages"]),
        "allowed_actions": perms.get("allowed_actions", {}),
        "permission_level": perms.get("permission_level"),
        "project_scoped": perms["project_scoped"],
        "allowed_project_ids": perms["allowed_project_ids"],
    }

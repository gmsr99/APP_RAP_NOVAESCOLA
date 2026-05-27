from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import atalho_service

router = APIRouter()


class AtalhoCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    url: str
    imagem_url: Optional[str] = None
    ordem: Optional[int] = 0


class AtalhoUpdate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    url: str
    imagem_url: Optional[str] = None
    ordem: Optional[int] = 0


@router.get("/api/atalhos", tags=["Atalhos"])
async def get_atalhos(user=Depends(get_current_user_required)):
    """Lista todos os atalhos. Acessível a todos os utilizadores autenticados."""
    return atalho_service.listar_atalhos()


@router.post("/api/atalhos", tags=["Atalhos"])
async def post_atalho(payload: AtalhoCreate, user=Depends(get_current_user_required)):
    """Cria um novo atalho. Apenas direcao e it_support."""
    _require_direcao(user)
    resultado = atalho_service.criar_atalho(payload.dict())
    if not resultado:
        raise HTTPException(status_code=500, detail="Erro ao criar atalho.")
    return resultado


@router.put("/api/atalhos/{atalho_id}", tags=["Atalhos"])
async def put_atalho(atalho_id: int, payload: AtalhoUpdate, user=Depends(get_current_user_required)):
    """Atualiza um atalho existente. Apenas direcao e it_support."""
    _require_direcao(user)
    resultado = atalho_service.atualizar_atalho(atalho_id, payload.dict())
    if not resultado:
        raise HTTPException(status_code=404, detail="Atalho não encontrado.")
    return resultado


@router.delete("/api/atalhos/{atalho_id}", tags=["Atalhos"])
async def delete_atalho(atalho_id: int, user=Depends(get_current_user_required)):
    """Apaga um atalho. Apenas direcao e it_support."""
    _require_direcao(user)
    sucesso = atalho_service.apagar_atalho(atalho_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Atalho não encontrado.")
    return {"ok": True}

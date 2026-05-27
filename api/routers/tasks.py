from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import tarefas_service

router = APIRouter()


class TarefaCreate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    prioridade: str = 'medio'
    data_limite: Optional[str] = None
    user_ids: Optional[List[str]] = None


class TarefaUpdate(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    prioridade: str = 'medio'
    data_limite: Optional[str] = None
    user_ids: Optional[List[str]] = None


class TarefaEstado(BaseModel):
    estado: str  # pendente | em_progresso | concluida


@router.get("/api/tarefas", tags=["Tarefas"])
async def get_tarefas(user=Depends(get_current_user_required)):
    """Lista tarefas do user autenticado (+ gerais). Coordenadores vêem todas."""
    user_id = user.get("sub")
    perms = _perm_svc.get_user_permissions(user_id)
    if perms["is_root"] or perms["is_coordenacao"]:
        return tarefas_service.listar_todas_tarefas()
    return tarefas_service.listar_tarefas_para_user(user_id)


@router.post("/api/tarefas", tags=["Tarefas"])
async def post_tarefa(payload: TarefaCreate, user=Depends(get_current_user_required)):
    """Cria uma tarefa. Apenas coordenadores e superiores."""
    _require_coordenacao(user)
    user_id = user.get("sub")
    res = tarefas_service.criar_tarefa(
        payload.titulo, user_id, payload.descricao,
        payload.prioridade, payload.data_limite, payload.user_ids or []
    )
    if not res:
        raise HTTPException(status_code=500, detail="Erro ao criar tarefa")
    return res


@router.put("/api/tarefas/{id}", tags=["Tarefas"])
async def put_tarefa(id: int, payload: TarefaUpdate, user=Depends(get_current_user_required)):
    """Atualiza uma tarefa."""
    _require_coordenacao(user)
    ok = tarefas_service.atualizar_tarefa(
        id, payload.titulo, payload.descricao,
        payload.prioridade, payload.data_limite, payload.user_ids
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Erro ao atualizar tarefa")
    return {"ok": True}


@router.delete("/api/tarefas/{id}", tags=["Tarefas"])
async def delete_tarefa(id: int, user=Depends(get_current_user_required)):
    """Apaga uma tarefa."""
    _require_coordenacao(user)
    ok = tarefas_service.apagar_tarefa(id)
    if not ok:
        raise HTTPException(status_code=500, detail="Erro ao apagar tarefa")
    return {"ok": True}


@router.patch("/api/tarefas/{id}/estado", tags=["Tarefas"])
async def patch_tarefa_estado(id: int, payload: TarefaEstado, user=Depends(get_current_user_required)):
    """User marca o seu estado numa tarefa (pendente → em_progresso → concluida)."""
    if payload.estado not in ('pendente', 'em_progresso', 'concluida'):
        raise HTTPException(status_code=400, detail="Estado inválido")
    user_id = user.get("sub")
    ok = tarefas_service.marcar_estado_tarefa(id, user_id, payload.estado)
    if not ok:
        raise HTTPException(status_code=404, detail="Atribuição não encontrada")
    return {"ok": True}

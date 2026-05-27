from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import estudio_service

router = APIRouter()


@router.get("/api/estudio/reservas", tags=["Estudio"])
async def get_estudio_reservas(user=Depends(get_current_user_required)):
    """Lista todas as reservas de estúdio."""
    return estudio_service.listar_reservas()


class ReservaCreate(BaseModel):
    data: str
    hora_inicio: str
    hora_fim: str
    tipo: str
    artista_turma: str
    projeto_musica: str
    responsavel_id: str
    notas: Optional[str] = None
    criado_por_id: Optional[str] = None


@router.post("/api/estudio/reservas", tags=["Estudio"])
async def create_estudio_reserva(reserva: ReservaCreate, user=Depends(get_current_user_required)):
    """Cria uma nova reserva de estúdio."""
    resultado = estudio_service.criar_reserva(reserva.dict())
    if not resultado:
        raise HTTPException(status_code=500, detail="Erro ao criar reserva")
    return resultado


@router.delete("/api/estudio/reservas/{reserva_id}", tags=["Estudio"])
async def delete_estudio_reserva(reserva_id: int, user=Depends(get_current_user_required)):
    """Apaga uma reserva de estúdio."""
    sucesso = estudio_service.apagar_reserva(reserva_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Reserva não encontrada ou erro ao apagar")
    return {"message": "Reserva apagada com sucesso"}

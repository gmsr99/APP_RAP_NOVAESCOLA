from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import dashboard_service
from services import aula_service

router = APIRouter()


@router.get("/api/stats/feedback", tags=["Estatisticas"])
async def get_stats_feedback(projeto_id: Optional[int] = None, user=Depends(get_current_user_required)):
    """Lista feedback/avaliações de sessões terminadas."""
    return aula_service.listar_feedback_sessoes(projeto_id)


@router.get("/api/stats/equipa-horas", tags=["Estatisticas"])
async def get_stats_equipa_horas(projeto_id: Optional[int] = None, user=Depends(get_current_user_required)):
    """Horas por colaborador (aulas vs trabalho autónomo)."""
    return aula_service.listar_horas_equipa(projeto_id)


@router.get("/api/stats/sessoes-turma", tags=["Estatisticas"])
async def get_sessoes_turma(turma_id: int, projeto_id: Optional[int] = None, user=Depends(get_current_user_required)):
    """Lista sessões terminadas de uma turma, ordenadas por data."""
    return aula_service.listar_sessoes_turma(turma_id, projeto_id)


@router.get("/api/stats/sessoes-user/{user_id}", tags=["Estatisticas"])
async def get_stats_sessoes_user(user_id: str, user=Depends(get_current_user_required)):
    """Conta sessões concluídas de um user (para pré-preencher Nº Sessão)."""
    return aula_service.contar_sessoes_user(user_id)


@router.get("/api/dashboard/produtor", tags=["Dashboard"])
async def get_produtor_dashboard(user=Depends(get_current_user_required)):
    """Retorna estatísticas e dados do dashboard para produtores."""
    user_id = user.get("sub")
    dashboard_data = dashboard_service.get_produtor_dashboard(user_id)
    if not dashboard_data:
        raise HTTPException(status_code=500, detail="Erro ao obter dados do dashboard")
    return dashboard_data

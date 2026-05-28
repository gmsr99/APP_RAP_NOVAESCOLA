from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import musica_service

router = APIRouter()


class MusicaCreate(BaseModel):
    titulo: str
    turma_id: int
    disciplina: Optional[str] = None
    disciplina_id: Optional[int] = None
    projeto_id: Optional[int] = None


class MusicaEstadoUpdate(BaseModel):
    estado: str


class MusicaDetalhesUpdate(BaseModel):
    titulo: Optional[str] = None
    deadline: Optional[str] = None
    notas: Optional[str] = None
    link_demo: Optional[str] = None
    turma_id: Optional[int] = None
    disciplina_id: Optional[int] = None


@router.get("/api/musicas", tags=["Producao"])
async def get_musicas(arquivadas: bool = False, projeto_id: Optional[int] = None, user=Depends(get_current_user_optional)):
    """Lista todas as músicas (ativas ou arquivadas), com filtro opcional por projeto."""
    user_id = user.get("sub") if user else None
    role = (user.get("user_metadata") or {}).get("role") if user else None
    project_filter = _perm_svc.get_project_filter(user_id) if user_id else None
    return musica_service.listar_musicas(arquivadas, user_id, role, projeto_id, allowed_project_ids=project_filter)


@router.post("/api/musicas", tags=["Producao"])
async def create_musica(musica: MusicaCreate, user=Depends(get_current_user_required)):
    """Cria uma nova música."""
    criador_id = user.get("sub")
    criador_role = (user.get("user_metadata") or {}).get("role")
    resultado = musica_service.criar_musica(musica.dict(), criador_id, criador_role)
    if not resultado:
        raise HTTPException(status_code=500, detail="Erro ao criar música")
    return resultado


@router.patch("/api/musicas/{musica_id}/estado", tags=["Producao"])
async def update_musica_estado(musica_id: int, update: MusicaEstadoUpdate):
    """Atualiza o estado de uma música (Manual - Admin only idealmente)."""
    sucesso, mensagem = musica_service.atualizar_estado(musica_id, update.estado)
    if not sucesso:
        raise HTTPException(status_code=400, detail=mensagem)
    return {"message": mensagem}


@router.post("/api/musicas/{musica_id}/avancar", tags=["Producao"])
async def avancar_fase_musica(musica_id: int, dados: Optional[dict] = None, user=Depends(get_current_user_required)):
    """Avança a música para a próxima fase."""
    user_id = user.get("sub")
    sucesso, mensagem = musica_service.avancar_fase(musica_id, user_id, dados)
    if not sucesso:
        raise HTTPException(status_code=400, detail=mensagem)
    return {"message": mensagem}


@router.post("/api/musicas/{musica_id}/prioritizar", tags=["Producao"])
async def prioritizar_musica(musica_id: int, dados: Optional[dict] = None, user=Depends(get_current_user_required)):
    """Prioriza uma música da fila para mistura (coordenadores/admins)."""
    _require_coordenacao(user)
    swap_id = (dados or {}).get("swap_id")
    sucesso, mensagem = musica_service.prioritizar_mistura(musica_id, swap_id)
    if not sucesso:
        raise HTTPException(status_code=400, detail=mensagem)
    return {"message": mensagem}


@router.post("/api/musicas/{musica_id}/aceitar", tags=["Producao"])
async def aceitar_tarefa_musica(musica_id: int, user=Depends(get_current_user_required)):
    """Aceita uma tarefa da pool (requer action production.lab)."""
    _require_action(user, "production.lab")
    user_id = user.get("sub")
    sucesso, mensagem = musica_service.aceitar_tarefa(musica_id, user_id)
    if not sucesso:
        raise HTTPException(status_code=400, detail=mensagem)
    return {"message": mensagem}


@router.post("/api/musicas/{musica_id}/reset-timer", tags=["Producao"])
async def reset_timer_musica(musica_id: int, user=Depends(get_current_user_required)):
    """Repõe o timer de uma música (apenas direção/it_support)."""
    perms = _perm_svc.get_user_permissions(user.get("sub"))
    if not perms["is_root"] and not perms["is_direcao"]:
        raise HTTPException(status_code=403, detail="Apenas admins podem repor timers.")
    sucesso, mensagem = musica_service.reset_timer(musica_id)
    if not sucesso:
        raise HTTPException(status_code=400, detail=mensagem)
    return {"message": mensagem}


@router.patch("/api/musicas/{musica_id}/arquivar", tags=["Producao"])
async def arquivar_musica(musica_id: int, user=Depends(get_current_user_required)):
    """Arquiva uma música — requer production.lab (produtor) ou coordenação."""
    perms = _perm_svc.get_user_permissions(user.get("sub"))
    has_lab = _perm_svc.has_action(user.get("sub"), "production.lab")
    if not (has_lab or perms["is_coordenacao"] or perms["is_direcao"] or perms["is_root"]):
        raise HTTPException(status_code=403, detail="Acesso negado.")
    sucesso, mensagem = musica_service.arquivar_musica(musica_id)
    if not sucesso:
        raise HTTPException(status_code=400, detail=mensagem)
    return {"message": mensagem}


@router.get("/api/musicas/export", tags=["Producao"])
async def export_musicas(
    projeto_id: Optional[int] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    _user=Depends(get_current_user_required),
):
    """Exporta músicas arquivadas filtradas por projeto e/ou janela temporal."""
    return musica_service.exportar_musicas(projeto_id, data_inicio, data_fim)


@router.patch("/api/musicas/{musica_id}/desarquivar", tags=["Producao"])
async def desarquivar_musica(musica_id: int):
    """Desarquiva uma música."""
    sucesso, mensagem = musica_service.desarquivar_musica(musica_id)
    if not sucesso:
        raise HTTPException(status_code=400, detail=mensagem)
    return {"message": mensagem}


@router.patch("/api/musicas/{musica_id}", tags=["Producao"])
async def update_musica_detalhes(musica_id: int, payload: MusicaDetalhesUpdate, user=Depends(get_current_user_required)):
    """Atualiza detalhes editáveis de uma música (deadline, notas, link_demo, titulo)."""
    sucesso = musica_service.atualizar_detalhes(musica_id, {k: v for k, v in payload.model_dump().items() if v is not None})
    if not sucesso:
        raise HTTPException(status_code=400, detail="Erro ao atualizar música")
    return {"message": "Música atualizada"}


@router.delete("/api/musicas/{musica_id}", tags=["Producao"])
async def delete_musica(musica_id: int, user=Depends(get_current_user_required)):
    """Apaga permanentemente uma música. Restrito a coordenador, direção e IT support."""
    _require_coordenacao(user)
    sucesso = musica_service.apagar_musica(musica_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Música não encontrada.")
    return {"message": "Música apagada."}


@router.post("/api/producao/verificar-deadlines", tags=["Producao"])
async def verificar_deadlines_musicas(user=Depends(get_current_user_required)):
    """Verifica músicas em atraso e notifica os responsáveis. Chamar diariamente (cron)."""
    _require_coordenacao(user)
    count = musica_service.verificar_e_notificar_deadlines()
    return {"notificacoes_enviadas": count}


@router.get("/api/producao/stats/instituicao", tags=["Producao"])
async def get_stats_instituicao(projeto_id: Optional[int] = None, user=Depends(get_current_user_required)):
    """Stats de progresso agrupados por estabelecimento > turma."""
    return musica_service.listar_stats_instituicao(projeto_id)


@router.get("/api/producao/stats/equipa", tags=["Producao"])
async def get_stats_equipa(projeto_id: Optional[int] = None, user=Depends(get_current_user_required)):
    """Stats de músicas agrupados por membro da equipa."""
    return musica_service.listar_stats_equipa(projeto_id)

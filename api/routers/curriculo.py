"""
Router: Catálogo de Disciplinas e Atividades.

Admin:
  GET/POST  /api/admin/disciplinas
  PUT/DEL   /api/admin/disciplinas/{id}
  POST/PUT/DEL /api/admin/disciplinas/{id}/atividades[/{atv_id}]

Turmas:
  GET/POST  /api/turmas/{turma_id}/disciplinas
  PUT/DEL   /api/turmas/{turma_id}/disciplinas/{td_id}
  GET       /api/curriculo/users-by-role/{role}
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from auth import get_current_user_required
from api.deps import _require_direcao, _require_coordenacao
from services import curriculo_service as _svc

router = APIRouter()

# ── Payloads ──────────────────────────────────────────────────────────────────

class DisciplinaCreatePayload(BaseModel):
    nome: str
    descricao: Optional[str] = None
    musicas_previstas: int = 0
    sessoes: Optional[int] = None
    duracao_minutos: int = 120
    num_producoes: int = 0
    ativo: bool = True
    ordem: int = 0


class DisciplinaUpdatePayload(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    musicas_previstas: Optional[int] = None
    sessoes: Optional[int] = None
    duracao_minutos: Optional[int] = None
    num_producoes: Optional[int] = None
    ativo: Optional[bool] = None
    ordem: Optional[int] = None


class AtividadeTemplateCreatePayload(BaseModel):
    nome: str
    is_autonomous: bool = False
    horas: float
    sessoes: Optional[int] = None
    role: str  # 'coordenador' | 'mentor' | 'produtor' | 'videomaker'
    ordem: int = 0


class AtividadeTemplateUpdatePayload(BaseModel):
    nome: Optional[str] = None
    is_autonomous: Optional[bool] = None
    horas: Optional[float] = None
    sessoes: Optional[int] = None
    role: Optional[str] = None
    ordem: Optional[int] = None


class TurmaDisciplinaCreatePayload(BaseModel):
    nome: str
    descricao: Optional[str] = None
    musicas_previstas: int = 0
    disciplina_id: Optional[int] = None  # se fornecido, instancia atividades do template


class TurmaDisciplinaUpdatePayload(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    musicas_previstas: Optional[int] = None


# ── Admin: Catálogo ───────────────────────────────────────────────────────────

@router.get("/api/admin/disciplinas", tags=["Catálogo"])
async def listar_catalogo(user=Depends(get_current_user_required)):
    _require_direcao(user)
    return _svc.listar_catalogo()


@router.post("/api/admin/disciplinas", tags=["Catálogo"])
async def criar_disciplina(payload: DisciplinaCreatePayload, user=Depends(get_current_user_required)):
    _require_direcao(user)
    return _svc.criar_disciplina(
        nome=payload.nome, descricao=payload.descricao,
        musicas_previstas=payload.musicas_previstas, sessoes=payload.sessoes,
        duracao_minutos=payload.duracao_minutos, num_producoes=payload.num_producoes,
        ativo=payload.ativo, ordem=payload.ordem,
    )


@router.put("/api/admin/disciplinas/{disc_id}", tags=["Catálogo"])
async def atualizar_disciplina(disc_id: int, payload: DisciplinaUpdatePayload,
                                user=Depends(get_current_user_required)):
    _require_direcao(user)
    result = _svc.atualizar_disciplina(disc_id, **payload.model_dump(exclude_none=True))
    if result is None:
        raise HTTPException(status_code=404, detail="Disciplina não encontrada.")
    return {"ok": True}


@router.delete("/api/admin/disciplinas/{disc_id}", tags=["Catálogo"])
async def apagar_disciplina(disc_id: int, user=Depends(get_current_user_required)):
    _require_direcao(user)
    result = _svc.apagar_disciplina(disc_id)
    if "error" in result:
        raise HTTPException(status_code=409, detail=result["error"])
    return result


# ── Admin: Atividades do Catálogo ─────────────────────────────────────────────

@router.post("/api/admin/disciplinas/{disc_id}/atividades", tags=["Catálogo"])
async def criar_atividade(disc_id: int, payload: AtividadeTemplateCreatePayload,
                           user=Depends(get_current_user_required)):
    _require_direcao(user)
    return _svc.criar_atividade_template(
        disciplina_id=disc_id, nome=payload.nome, is_autonomous=payload.is_autonomous,
        horas=payload.horas, sessoes=payload.sessoes, role=payload.role, ordem=payload.ordem,
    )


@router.put("/api/admin/disciplinas/{disc_id}/atividades/{atv_id}", tags=["Catálogo"])
async def atualizar_atividade(disc_id: int, atv_id: int,
                               payload: AtividadeTemplateUpdatePayload,
                               user=Depends(get_current_user_required)):
    _require_direcao(user)
    result = _svc.atualizar_atividade_template(atv_id, **payload.model_dump(exclude_none=True))
    if result is None:
        raise HTTPException(status_code=404, detail="Atividade não encontrada.")
    return {"ok": True}


@router.delete("/api/admin/disciplinas/{disc_id}/atividades/{atv_id}", tags=["Catálogo"])
async def apagar_atividade(disc_id: int, atv_id: int, user=Depends(get_current_user_required)):
    _require_direcao(user)
    if not _svc.apagar_atividade_template(atv_id):
        raise HTTPException(status_code=404, detail="Atividade não encontrada.")
    return {"ok": True}


# ── Public catálogo (para dropdowns — só activas) ─────────────────────────────

@router.get("/api/curriculo/catalogo", tags=["Catálogo"])
async def catalogo_publico(user=Depends(get_current_user_required)):
    """Lista disciplinas ativas para uso em dropdowns (coordenação+)."""
    _require_coordenacao(user)
    todas = _svc.listar_catalogo()
    return [d for d in todas if d.get("ativo")]


# ── Turmas: Disciplinas ───────────────────────────────────────────────────────

@router.get("/api/turmas/{turma_id}/disciplinas", tags=["Turmas"])
async def listar_disciplinas_turma(turma_id: int, user=Depends(get_current_user_required)):
    _require_coordenacao(user)
    return _svc.listar_disciplinas_turma(turma_id)


@router.post("/api/turmas/{turma_id}/disciplinas", tags=["Turmas"])
async def criar_disciplina_turma(turma_id: int, payload: TurmaDisciplinaCreatePayload,
                                  user=Depends(get_current_user_required)):
    _require_coordenacao(user)
    return _svc.criar_disciplina_turma(
        turma_id=turma_id, nome=payload.nome, descricao=payload.descricao,
        musicas_previstas=payload.musicas_previstas, disciplina_id=payload.disciplina_id,
    )


@router.put("/api/turmas/{turma_id}/disciplinas/{td_id}", tags=["Turmas"])
async def atualizar_disciplina_turma(turma_id: int, td_id: int,
                                      payload: TurmaDisciplinaUpdatePayload,
                                      user=Depends(get_current_user_required)):
    _require_coordenacao(user)
    result = _svc.atualizar_disciplina_turma(td_id, **payload.model_dump(exclude_none=True))
    if result is None:
        raise HTTPException(status_code=404, detail="Disciplina não encontrada.")
    return {"ok": True}


@router.delete("/api/turmas/{turma_id}/disciplinas/{td_id}", tags=["Turmas"])
async def apagar_disciplina_turma(turma_id: int, td_id: int,
                                   user=Depends(get_current_user_required)):
    _require_coordenacao(user)
    result = _svc.apagar_disciplina_turma(td_id)
    if "error" in result:
        raise HTTPException(status_code=409, detail=result["error"])
    return result


# ── Users elegíveis por role ──────────────────────────────────────────────────

@router.get("/api/curriculo/users-by-role/{role}", tags=["Catálogo"])
async def users_por_role(role: str, user=Depends(get_current_user_required)):
    """Devolve utilizadores com work_type.<role> activo na sua patente."""
    _require_coordenacao(user)
    allowed = {"coordenador", "mentor", "produtor", "videomaker"}
    if role not in allowed:
        raise HTTPException(status_code=400, detail=f"Role inválido. Use: {allowed}")
    return _svc.listar_users_por_work_type(role)

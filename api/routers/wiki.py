from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import wiki_service, curriculo_service, turma_service

router = APIRouter()


class EstabelecimentoWikiCreate(BaseModel):
    nome: str
    sigla: Optional[str] = None
    nome_apresentacao: Optional[str] = None
    morada: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ContactoCreate(BaseModel):
    tipo: str  # telefone | email | maps | website | outro
    valor: str
    descricao: Optional[str] = None


class TurmaDisciplinaCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    musicas_previstas: int = 0
    atividades: list = []
    disciplina_id: Optional[int] = None  # se fornecido, instancia atividades do catálogo


class TurmaDisciplinaUpdate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    musicas_previstas: int = 0


class TurmaAtividadeCreate(BaseModel):
    turma_disciplina_id: int
    nome: str
    codigo: Optional[str] = None
    sessoes_previstas: int = 0
    horas_por_sessao: float = 0
    musicas_previstas: int = 0
    role: Optional[str] = None
    is_autonomous: bool = False


class TurmaAtividadeUpdate(BaseModel):
    nome: str
    codigo: Optional[str] = None
    sessoes_previstas: int = 0
    horas_por_sessao: float = 0
    musicas_previstas: int = 0
    role: Optional[str] = None
    is_autonomous: bool = False


@router.get("/api/estabelecimentos", tags=["Wiki"])
async def get_estabelecimentos(user=Depends(get_current_user_required)):
    return turma_service.listar_estabelecimentos()


@router.post("/api/estabelecimentos", tags=["Wiki"])
async def create_estabelecimento(inst: EstabelecimentoWikiCreate, user=Depends(get_current_user_required)):
    _require_coordenacao(user)
    res = turma_service.criar_estabelecimento(inst.nome, inst.sigla, inst.nome_apresentacao, inst.morada, inst.latitude, inst.longitude)
    if not res:
        raise HTTPException(status_code=400, detail="Erro ao criar. Possível duplicado.")
    return res


@router.put("/api/estabelecimentos/{id}", tags=["Wiki"])
async def update_estabelecimento(id: int, inst: EstabelecimentoWikiCreate, user=Depends(get_current_user_required)):
    _require_coordenacao(user)
    sucesso = turma_service.atualizar_estabelecimento(id, inst.nome, inst.sigla, inst.nome_apresentacao, inst.morada, inst.latitude, inst.longitude)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar.")
    return {"message": "Atualizado com sucesso"}


@router.delete("/api/estabelecimentos/{id}", tags=["Wiki"])
async def delete_estabelecimento(id: int, user=Depends(get_current_user_required)):
    _require_coordenacao(user)
    sucesso = turma_service.apagar_estabelecimento(id)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao apagar.")
    return {"message": "Apagado com sucesso"}


@router.get("/api/estabelecimentos/contactos", tags=["Wiki"])
async def get_todos_contactos(user=Depends(get_current_user_required)):
    """Lista todos os contactos de todos os estabelecimentos."""
    return turma_service.listar_todos_contactos()


@router.get("/api/estabelecimentos/{id}/contactos", tags=["Wiki"])
async def get_contactos_estabelecimento(id: int, user=Depends(get_current_user_required)):
    """Lista contactos de um estabelecimento."""
    return turma_service.listar_contactos_estabelecimento(id)


@router.post("/api/estabelecimentos/{id}/contactos", tags=["Wiki"])
async def create_contacto_estabelecimento(id: int, data: ContactoCreate, user=Depends(get_current_user_required)):
    _require_coordenacao(user)
    if data.tipo not in ('telefone', 'email', 'maps', 'website', 'outro'):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    res = turma_service.criar_contacto_estabelecimento(id, data.tipo, data.valor, data.descricao)
    if not res:
        raise HTTPException(status_code=500, detail="Erro ao criar contacto.")
    return res


@router.put("/api/contactos/{id}", tags=["Wiki"])
async def update_contacto(id: int, data: ContactoCreate, user=Depends(get_current_user_required)):
    _require_coordenacao(user)
    sucesso = turma_service.atualizar_contacto_estabelecimento(id, data.tipo, data.valor, data.descricao)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar contacto.")
    return {"message": "Contacto atualizado"}


@router.delete("/api/contactos/{id}", tags=["Wiki"])
async def delete_contacto(id: int, user=Depends(get_current_user_required)):
    _require_coordenacao(user)
    sucesso = turma_service.apagar_contacto_estabelecimento(id)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao apagar contacto.")
    return {"message": "Contacto apagado"}


@router.get("/api/curriculo", tags=["Wiki"])
async def get_curriculo(user=Depends(get_current_user_required)):
    """Lista todo o currículo global (disciplinas e atividades)."""
    return curriculo_service.listar_curriculo()


@router.get("/api/wiki/projeto/{projeto_id}", tags=["Wiki"])
async def get_wiki_hierarquia(projeto_id: int, user=Depends(get_current_user_required)):
    """Hierarquia completa: Projeto > Estabelecimentos > Turmas > Disciplinas > Atividades."""
    result = wiki_service.listar_hierarquia_projeto(projeto_id)
    return result


@router.get("/api/wiki/turma/{turma_id}/disciplinas", tags=["Wiki"])
async def get_wiki_turma_disciplinas(turma_id: int, user=Depends(get_current_user_required)):
    """Lista disciplinas locais de uma turma com atividades."""
    return wiki_service.listar_disciplinas_turma(turma_id)


@router.post("/api/wiki/turma/{turma_id}/disciplinas", tags=["Wiki"])
async def create_wiki_disciplina(turma_id: int, payload: TurmaDisciplinaCreate, user=Depends(get_current_user_required)):
    """Cria disciplina local com atividades em batch ou a partir do catálogo."""
    _require_coordenacao(user)
    if payload.disciplina_id:
        # Instancia a partir do catálogo (auto-cria atividades do template)
        result = curriculo_service.criar_disciplina_turma(
            turma_id, payload.nome, payload.descricao,
            payload.musicas_previstas, payload.disciplina_id
        )
    else:
        result = wiki_service.criar_disciplina_turma(
            turma_id, payload.nome, payload.descricao,
            payload.musicas_previstas, payload.atividades
        )
    if not result:
        raise HTTPException(status_code=500, detail="Erro ao criar disciplina")
    return result


@router.put("/api/wiki/disciplinas/{td_id}", tags=["Wiki"])
async def update_wiki_disciplina(td_id: int, payload: TurmaDisciplinaUpdate, user=Depends(get_current_user_required)):
    """Atualiza uma disciplina local."""
    _require_coordenacao(user)
    sucesso = wiki_service.atualizar_disciplina_turma(td_id, payload.nome, payload.descricao, payload.musicas_previstas)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar disciplina")
    return {"id": td_id, "nome": payload.nome}


@router.delete("/api/wiki/disciplinas/{td_id}", tags=["Wiki"])
async def delete_wiki_disciplina(td_id: int, user=Depends(get_current_user_required)):
    """Remove disciplina local (cascade apaga atividades)."""
    _require_coordenacao(user)
    sucesso = wiki_service.apagar_disciplina_turma(td_id)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao apagar disciplina")
    return {"message": "Disciplina apagada"}


@router.post("/api/wiki/atividades", tags=["Wiki"])
async def create_wiki_atividade(payload: TurmaAtividadeCreate, user=Depends(get_current_user_required)):
    """Cria uma atividade local."""
    _require_coordenacao(user)
    result = wiki_service.criar_atividade(
        payload.turma_disciplina_id, payload.nome, payload.codigo,
        payload.sessoes_previstas, payload.horas_por_sessao,
        payload.musicas_previstas, payload.role, payload.is_autonomous
    )
    if not result:
        raise HTTPException(status_code=500, detail="Erro ao criar atividade")
    return result


@router.put("/api/wiki/atividades/{uuid}", tags=["Wiki"])
async def update_wiki_atividade(uuid: str, payload: TurmaAtividadeUpdate, user=Depends(get_current_user_required)):
    """Atualiza uma atividade local por UUID."""
    _require_coordenacao(user)
    sucesso = wiki_service.atualizar_atividade(uuid, payload.dict())
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar atividade")
    return {"uuid": uuid, "nome": payload.nome}


@router.delete("/api/wiki/atividades/{uuid}", tags=["Wiki"])
async def delete_wiki_atividade(uuid: str, user=Depends(get_current_user_required)):
    """Remove uma atividade local por UUID."""
    _require_coordenacao(user)
    sucesso = wiki_service.apagar_atividade(uuid)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao apagar atividade")
    return {"message": "Atividade removida"}

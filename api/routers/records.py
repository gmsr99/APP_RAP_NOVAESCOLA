from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import registo_service, aula_registo_service, aula_evidencia_service
from services import aula_service, projeto_service, km_service as _km_svc

router = APIRouter()


class AulaRegistoPayload(BaseModel):
    aula_id: int
    storage_path: str


class AulaEvidenciaPayload(BaseModel):
    aula_id: int
    storage_path: str


class PreRegistoPdfPayload(BaseModel):
    aula_id: int
    projeto_id: int
    atividade: str = ""
    numero_sessao: str = ""
    data: str = ""
    local: str = ""
    horario: str = ""
    tecnicos: str = ""
    objetivos_gerais: str = ""
    sumario: str = ""
    participantes: list = []
    is_autonomous: bool = False


class RegistoCreate(BaseModel):
    aula_id: int
    numero_sessao: Optional[str] = None
    objetivos_gerais: Optional[str] = None
    sumario: Optional[str] = None
    participantes: Optional[list] = None
    atividade: Optional[str] = None
    data_registo: Optional[str] = None
    local_registo: Optional[str] = None
    horario: Optional[str] = None
    tecnicos: Optional[str] = None
    kms_percorridos: Optional[float] = None
    leva_carro: Optional[bool] = None


class RegistoUpdate(BaseModel):
    numero_sessao: Optional[str] = None
    objetivos_gerais: Optional[str] = None
    sumario: Optional[str] = None
    participantes: Optional[list] = None
    atividade: Optional[str] = None
    data_registo: Optional[str] = None
    local_registo: Optional[str] = None
    horario: Optional[str] = None
    tecnicos: Optional[str] = None
    kms_percorridos: Optional[float] = None
    leva_carro: Optional[bool] = None


@router.get("/api/aulas/registaveis", tags=["Registos"])
async def get_sessoes_registaveis(user=Depends(get_current_user_required)):
    """Sessões terminadas/realizadas do user ainda sem registo."""
    user_id = user.get("sub")
    return registo_service.listar_sessoes_registaveis(user_id)


@router.get("/api/aulas/registaveis/todas", tags=["Registos"])
async def get_todas_sessoes_registaveis(user=Depends(get_current_user_required)):
    """Todas as sessões terminadas/realizadas sem registo (coordenadores/direção)."""
    _require_coordenacao(user)
    return registo_service.listar_todas_sessoes_registaveis()


@router.get("/api/aulas/export", tags=["Aulas"])
async def export_aulas(
    projeto_ids: Optional[str] = None,
    sub_projeto_ids: Optional[str] = None,
    tipo_sessao: Optional[str] = "todas",
    estados: Optional[str] = None,
    mentor_id: Optional[int] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    user=Depends(get_current_user_required),
):
    """Exporta lista de atividades/sessões com filtros flexíveis (coordenadores e superiores)."""
    _require_coordenacao(user)
    projeto_ids_list = [int(p.strip()) for p in projeto_ids.split(",") if p.strip()] if projeto_ids else None
    sub_projeto_ids_list = [int(p.strip()) for p in sub_projeto_ids.split(",") if p.strip()] if sub_projeto_ids else None
    estados_list = [e.strip() for e in estados.split(",")] if estados else None
    mentor_id_int = int(mentor_id) if mentor_id else None
    return aula_service.listar_aulas_export(
        projeto_ids=projeto_ids_list,
        sub_projeto_ids=sub_projeto_ids_list,
        tipo_sessao=tipo_sessao or "todas",
        estados=estados_list,
        mentor_id=mentor_id_int,
        data_inicio=data_inicio,
        data_fim=data_fim,
    )


@router.post("/api/pre-registos/pdf", tags=["Registos"])
async def gerar_pre_registo_pdf(payload: PreRegistoPdfPayload, user=Depends(get_current_user_required)):
    from services import pdf_service
    config = projeto_service.obter_projeto_config(payload.projeto_id)
    if not config:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    pdf_bytes = pdf_service.gerar_pdf_pre_registo(payload.dict(), config)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="registo.pdf"'},
    )


@router.post("/api/aula-registos", tags=["Registos"])
async def create_aula_registo(data: AulaRegistoPayload, user=Depends(get_current_user_required)):
    res = aula_registo_service.criar_aula_registo(data.aula_id, data.storage_path, user["sub"])
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("erro", "Erro ao guardar registo"))
    return res


@router.get("/api/aula-registos/export", tags=["Registos"])
async def export_aula_registos(
    projeto_id: int,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    sub_projeto_id: Optional[int] = None,
    user=Depends(get_current_user_required),
):
    _require_direcao(user)
    zip_bytes = aula_registo_service.exportar_registos_zip(projeto_id, data_inicio, data_fim, sub_projeto_id)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=registos.zip"},
    )


@router.get("/api/aula-registos/{aula_id}", tags=["Registos"])
async def get_aula_registo(aula_id: int, user=Depends(get_current_user_required)):
    registo = aula_registo_service.obter_registo_por_aula(aula_id)
    if not registo:
        raise HTTPException(status_code=404, detail="Registo não encontrado")
    return registo


@router.post("/api/aula-evidencias", tags=["Registos"])
async def create_aula_evidencia(data: AulaEvidenciaPayload, user=Depends(get_current_user_required)):
    """Guarda path de uma foto de evidência de sessão."""
    res = aula_evidencia_service.criar_evidencia(data.aula_id, data.storage_path, user["sub"])
    if not res.get("ok"):
        raise HTTPException(status_code=400, detail=res.get("erro", "Erro ao guardar evidência"))
    return res


@router.get("/api/aula-evidencias/export", tags=["Registos"])
async def export_aula_evidencias(
    projeto_id: int,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    sub_projeto_id: Optional[int] = None,
    user=Depends(get_current_user_required),
):
    """Exporta fotos de evidência num ZIP organizado por pastas."""
    _require_coordenacao(user)
    zip_bytes = aula_evidencia_service.exportar_evidencias_zip(projeto_id, data_inicio, data_fim, sub_projeto_id)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=evidencias.zip"},
    )


@router.get("/api/aula-feedback/export", tags=["Registos"])
async def export_aula_feedback(
    projeto_id: int,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    sub_projeto_id: Optional[int] = None,
    user=Depends(get_current_user_required),
):
    """Exporta áudios de feedback num ZIP organizado por pastas."""
    _require_coordenacao(user)
    zip_bytes = aula_evidencia_service.exportar_feedback_zip(projeto_id, data_inicio, data_fim, sub_projeto_id)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=feedback.zip"},
    )


@router.get("/api/registos/leva-carro-dia", tags=["Registos"])
async def get_leva_carro_dia(data: str, user=Depends(get_current_user_required)):
    """Retorna a resposta 'leva_carro' já dada neste dia (null se ainda não respondeu)."""
    valor = _km_svc.obter_leva_carro_dia(user.get("sub"), data)
    return {"leva_carro": valor}


@router.get("/api/registos/leva-carro-resumo", tags=["Registos"])
async def get_leva_carro_resumo(
    data_inicio: str,
    data_fim: str,
    user=Depends(get_current_user_required),
):
    """Resumo semanal de mentores que levam carro, por dia (coordenadores e superiores)."""
    _require_coordenacao(user)
    return _km_svc.obter_leva_carro_resumo(data_inicio, data_fim)


@router.get("/api/registos", tags=["Registos"])
async def get_registos(user=Depends(get_current_user_required)):
    """Lista registos do user autenticado."""
    user_id = user.get("sub")
    return registo_service.listar_registos(user_id)


@router.get("/api/registos/todos", tags=["Registos"])
async def get_todos_registos(user=Depends(get_current_user_required)):
    """Lista todos os registos (para coordenadores)."""
    return registo_service.listar_registos()


@router.get("/api/registos/export", tags=["Registos"])
async def export_registos(
    data_inicio: str,
    data_fim: str,
    user_ids: Optional[str] = None,
    estabelecimento_ids: Optional[str] = None,
    user=Depends(get_current_user_required),
):
    """Exporta registos filtrados (para direção/coordenadores)."""
    _require_coordenacao(user)
    user_id_list = [uid.strip() for uid in user_ids.split(",")] if user_ids else None
    estab_id_list = [int(eid.strip()) for eid in estabelecimento_ids.split(",")] if estabelecimento_ids else None
    return registo_service.listar_registos_export(data_inicio, data_fim, user_id_list, estab_id_list)


@router.post("/api/registos", tags=["Registos"])
async def create_registo(registo: RegistoCreate, user=Depends(get_current_user_required)):
    """Cria um registo de sessão."""
    user_id = user.get("sub")
    resultado = registo_service.criar_registo(
        aula_id=registo.aula_id,
        user_id=user_id,
        numero_sessao=registo.numero_sessao,
        objetivos_gerais=registo.objetivos_gerais,
        sumario=registo.sumario,
        participantes=registo.participantes,
        atividade=registo.atividade,
        data_registo=registo.data_registo,
        local_registo=registo.local_registo,
        horario=registo.horario,
        tecnicos=registo.tecnicos,
        kms_percorridos=registo.kms_percorridos,
        leva_carro=registo.leva_carro,
    )
    if not resultado:
        raise HTTPException(status_code=500, detail="Erro ao criar registo. Verifica se a migração 002_registos.sql foi executada.")
    return resultado


@router.patch("/api/registos/{registo_id}", tags=["Registos"])
async def update_registo(registo_id: int, registo: RegistoUpdate, user=Depends(get_current_user_required)):
    """Edita os campos de um registo existente (apenas o próprio user)."""
    user_id = user.get("sub")
    dados = {k: v for k, v in registo.model_dump().items() if v is not None}
    sucesso = registo_service.atualizar_registo(registo_id, user_id, dados)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Registo não encontrado ou sem permissão para editar.")
    return {"message": "Registo atualizado com sucesso"}


@router.delete("/api/registos/{registo_id}", tags=["Registos"])
async def delete_registo(registo_id: int, user=Depends(get_current_user_required)):
    """Apaga um registo (devolve sessão ao dropdown)."""
    user_id = user.get("sub")
    sucesso = registo_service.apagar_registo(registo_id, user_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Registo não encontrado ou erro ao apagar")
    return {"message": "Registo apagado com sucesso"}

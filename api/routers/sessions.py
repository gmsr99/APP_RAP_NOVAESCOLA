import json
import os
import logging as _log
from datetime import datetime as _dt
from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import aula_service, turma_service, aluno_service, notification_service, estudio_service, registo_service, profile_service
from services import settings_service as _settings_svc
from models.sqlmodel_models import AulaCreate, AulaUpdate

router = APIRouter()


class AulaRecorrenteCreate(BaseModel):
    data_hora: str
    duracao_minutos: int = 120
    tipo_atividade: Optional[str] = None
    responsavel_user_id: Optional[str] = None
    observacoes: Optional[str] = None
    semanas: int = 4
    tema: Optional[str] = None
    projeto_id: Optional[int] = None
    # Adicionado para aulas regulares:
    turma_id: Optional[int] = None
    mentor_id: Optional[int] = None
    local: Optional[str] = None
    atividade_uuid: Optional[str] = None
    is_autonomous: bool = True
    tipo: str = "trabalho_autonomo"
    sumario: Optional[str] = None
    codigo_sessao: Optional[str] = None
    participantes_ids: List[str] = []


class AulaEstadoOverride(BaseModel):
    estado: str


class TerminarPayload(BaseModel):
    avaliacao: int = Field(ge=1, le=5)
    obs_termino: Optional[str] = None
    feedback_audio_path: Optional[str] = None


class TurmaCreate(BaseModel):
    nome: str
    estabelecimento_id: str


class AlunosUpdate(BaseModel):
    nomes: list[str]


def _check_session_permission(user: dict, aula_info: dict):
    """Verifica se o user tem permissão para alterar o estado da sessão.
    Coordenadores podem alterar todas. Outros users só as atribuídas a eles."""
    user_id = user.get("sub")
    perms = _perm_svc.get_user_permissions(user_id)
    # Root, direção e coordenação têm acesso total a sessões
    if perms["is_root"] or perms["is_direcao"] or perms["is_coordenacao"]:
        return True
    # Sessão regular: apenas o mentor atribuído pode agir
    if not aula_info.get("is_autonomous"):
        mentor_uid = aula_info.get("mentor_user_id")
        return mentor_uid is not None and mentor_uid == user_id
    # Trabalho autónomo: apenas o responsável pode agir
    else:
        return aula_info.get("responsavel_user_id") == user_id


@router.get("/api/aulas", tags=["Aulas"])
async def get_todas_aulas(user=Depends(get_current_user_required)):
    """
    Endpoint para listar todas as aulas existentes.
    Chama o serviço correspondente e retorna os dados.
    """
    try:
        user_id = user.get("sub")
        project_filter = _perm_svc.get_project_filter(user_id)
        hide_direcao = False
        if _settings_svc.ocultar_sessoes_direcao():
            perms = _perm_svc.get_user_permissions(user_id)
            if not perms["is_root"] and not perms["is_direcao"]:
                hide_direcao = True
        aulas = aula_service.listar_todas_aulas(
            allowed_project_ids=project_filter,
            hide_direcao_sessions=hide_direcao,
        )
        return aulas
    except Exception as e:
        return {"error": str(e)}


@router.get("/api/aulas/proximo-numero", tags=["Aulas"])
async def get_proximo_numero_sessao(
    atividade_uuid: Optional[str] = None,
    turma_id: Optional[int] = None,
    projeto_id: Optional[int] = None,
    is_autonomous: bool = False,
    responsavel_user_id: Optional[str] = None,
    user=Depends(get_current_user_required),
):
    """Retorna o próximo número de sessão (N+1).
    Preferência: conta por atividade_uuid. Fallback: por turma/projeto (legado).
    """
    proximo = aula_service.obter_proximo_numero_sessao(
        atividade_uuid=atividade_uuid,
        turma_id=turma_id,
        projeto_id=projeto_id,
        is_autonomous=is_autonomous,
        responsavel_user_id=responsavel_user_id,
    )
    return {"proximo": proximo}


@router.get("/api/aulas/{aula_id}", tags=["Aulas"])
async def get_aula_by_id(aula_id: int, user=Depends(get_current_user_required)):
    """
    Endpoint para obter os detalhes de uma aula específica.
    """
    try:
        aula = aula_service.obter_aula_por_id(aula_id)
        if aula:
            if _settings_svc.ocultar_sessoes_direcao():
                user_id = user.get("sub")
                perms = _perm_svc.get_user_permissions(user_id)
                if not perms["is_root"] and not perms["is_direcao"]:
                    direcao_ids = _settings_svc.obter_direcao_user_ids()
                    mentor_uid = aula.get("mentor_user_id") if isinstance(aula, dict) else getattr(aula, "mentor_user_id", None)
                    resp_uid = str((aula.get("responsavel_user_id") if isinstance(aula, dict) else getattr(aula, "responsavel_user_id", None)) or "")
                    if mentor_uid in direcao_ids or resp_uid in direcao_ids:
                        return {"message": "Aula não encontrada"}
            return aula
        return {"message": "Aula não encontrada"}
    except Exception as e:
        return {"error": str(e)}


@router.post("/api/aulas", tags=["Aulas"])
async def create_aula(aula: AulaCreate, user=Depends(get_current_user_required)):
    """
    Cria uma nova aula via API (regular ou trabalho autónomo).
    """
    nova_aula = aula_service.criar_aula(
        turma_id=aula.turma_id,
        data_hora=aula.data_hora,
        tipo=aula.tipo,
        duracao_minutos=aula.duracao_minutos,
        mentor_id=aula.mentor_id,
        local=aula.local,
        tema=aula.tema,
        objetivos=aula.objetivos,
        projeto_id=aula.projeto_id,
        observacoes=aula.observacoes,
        atividade_uuid=aula.atividade_uuid,
        is_autonomous=aula.is_autonomous,
        is_realized=aula.is_realized,
        tipo_atividade=aula.tipo_atividade,
        responsavel_user_id=aula.responsavel_user_id,
        musica_id=aula.musica_id,
        sumario=aula.sumario,
        codigo_sessao=aula.codigo_sessao,
        tarefa_id=getattr(aula, 'tarefa_id', None),
        participantes_ids=aula.participantes_ids or [],
        criador_user_id=user.get('sub') if user else None,
    )
    if nova_aula is None:
        raise HTTPException(
            status_code=500,
            detail="Erro ao criar aula. Verifica se a migração 001_trabalho_autonomo.sql foi executada no Supabase."
        )
    return nova_aula


@router.post("/api/aulas/recorrentes", tags=["Aulas"])
async def create_aulas_recorrentes(payload: AulaRecorrenteCreate, user=Depends(get_current_user_required)):
    """
    Cria N sessões com recorrência semanal. Funciona para Trabalho Autónomo e Aulas.
    """
    try:
        resultados = aula_service.criar_aulas_recorrentes(
            data_hora=payload.data_hora,
            duracao_minutos=payload.duracao_minutos,
            tipo_atividade=payload.tipo_atividade,
            responsavel_user_id=payload.responsavel_user_id,
            observacoes=payload.observacoes,
            semanas=payload.semanas,
            tema=payload.tema,
            projeto_id=payload.projeto_id,
            turma_id=payload.turma_id,
            mentor_id=payload.mentor_id,
            local=payload.local,
            atividade_uuid=payload.atividade_uuid,
            is_autonomous=payload.is_autonomous,
            tipo=payload.tipo,
            sumario=payload.sumario,
            codigo_sessao=payload.codigo_sessao,
            participantes_ids=payload.participantes_ids or [],
        )
        return {"criadas": len(resultados), "sessoes": resultados}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/aulas/{aula_id}", tags=["Aulas"])
async def update_aula(aula_id: int, aula: AulaUpdate, user=Depends(get_current_user_required)):
    """
    Atualiza uma aula existente.
    """
    try:
        # Filtrar campos None
        dados = {k: v for k, v in aula.model_dump().items() if v is not None}
        sucesso = aula_service.atualizar_aula(aula_id, dados)

        if sucesso:
            return {"message": "Aula atualizada com sucesso"}
        raise HTTPException(status_code=404, detail="Aula não encontrada ou erro ao atualizar")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/aulas/{aula_id}", tags=["Aulas"])
async def delete_aula(aula_id: int, user=Depends(get_current_user_required)):
    """
    Apaga uma aula.
    """
    try:
        sucesso = aula_service.apagar_aula(aula_id)
        if sucesso:
            return {"message": "Aula apagada com sucesso"}
        raise HTTPException(status_code=404, detail="Aula não encontrada ou erro ao apagar")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/aulas/{aula_id}/confirm", tags=["Aulas"])
async def confirm_aula(aula_id: int, user=Depends(get_current_user_required)):
    """Confirma uma aula (status -> 'confirmada')."""
    aula_info = aula_service.obter_aula_por_id(aula_id)
    if not aula_info:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    if not _check_session_permission(user, aula_info):
        raise HTTPException(status_code=403, detail="Sem permissão para alterar esta sessão.")
    try:
        sucesso = aula_service.mudar_estado_aula(aula_id, "confirmada")
        if sucesso:
            return {"message": "Aula confirmada com sucesso"}
        raise HTTPException(status_code=400, detail="Erro ao confirmar aula")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/aulas/{aula_id}/reject", tags=["Aulas"])
async def reject_aula(aula_id: int, user=Depends(get_current_user_required)):
    """Recusa uma aula (status -> 'recusada')."""
    aula_info = aula_service.obter_aula_por_id(aula_id)
    if not aula_info:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    if not _check_session_permission(user, aula_info):
        raise HTTPException(status_code=403, detail="Sem permissão para alterar esta sessão.")
    try:
        sucesso = aula_service.mudar_estado_aula(aula_id, "recusada")
        if sucesso:
            return {"message": "Aula recusada com sucesso"}
        raise HTTPException(status_code=400, detail="Erro ao recusar aula")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/api/aulas/{aula_id}/estado", tags=["Aulas"])
async def override_aula_estado(aula_id: int, payload: AulaEstadoOverride, user=Depends(get_current_user_required)):
    """Coordenador/direcao/it_support pode forçar mudança de estado numa sessão."""
    _require_coordenacao(user)
    estados_permitidos = ["rascunho", "pendente", "agendada", "confirmada", "recusada"]
    if payload.estado not in estados_permitidos:
        raise HTTPException(status_code=400, detail=f"Estado '{payload.estado}' não permitido via esta operação.")
    aula_info = aula_service.obter_aula_por_id(aula_id)
    if not aula_info:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    estado_anterior = aula_info.get("estado")
    if estado_anterior == "terminada":
        raise HTTPException(status_code=400, detail="Não é possível alterar o estado de uma sessão terminada.")
    sucesso = aula_service.mudar_estado_aula(aula_id, payload.estado)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao alterar estado da sessão.")

    # Notificar mentor se a sessão lhe estava atribuída
    mentor_user_id = aula_info.get("mentor_user_id")
    if mentor_user_id and estado_anterior in ("confirmada", "pendente", "agendada"):
        try:
            data_hora_raw = aula_info.get("data_hora", "")
            try:
                data_fmt = _dt.fromisoformat(str(data_hora_raw)).strftime("%d/%m/%Y às %H:%M")
            except Exception:
                data_fmt = str(data_hora_raw)
            tema = aula_info.get("tema") or ""
            sessao_label = f'"{tema}" ' if tema else ""
            if estado_anterior == "confirmada":
                mensagem = (
                    f"A sessão {sessao_label}de {data_fmt} que tinhas confirmado foi desmarcada por um supervisor. "
                    "Não precisas de comparecer. Para mais informações, fala com a supervisão."
                )
            else:
                mensagem = (
                    f"A sessão {sessao_label}de {data_fmt} que te estava atribuída foi desmarcada por um supervisor. "
                    "Para mais informações, fala com a supervisão."
                )
            notification_service.criar_notificacao(
                user_id=mentor_user_id,
                tipo="session_desmarcada",
                titulo="Sessão Desmarcada pelo Supervisor",
                mensagem=mensagem,
                link="/horarios",
                metadados={"aula_id": aula_id},
            )
        except Exception as e:
            _log.getLogger(__name__).warning("Erro ao notificar mentor sobre desmarcação: %s", e)

    return {"message": f"Sessão revertida para '{payload.estado}'."}


@router.post("/api/aulas/{aula_id}/realize", tags=["Aulas"])
async def realize_aula(aula_id: int, user=Depends(get_current_user_required)):
    """Marca trabalho autónomo como realizado (is_realized = True)."""
    aula_info = aula_service.obter_aula_por_id(aula_id)
    if not aula_info:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    if not _check_session_permission(user, aula_info):
        raise HTTPException(status_code=403, detail="Sem permissão para alterar esta sessão.")
    resultado = aula_service.realizar_trabalho_autonomo(aula_id)
    if resultado.get("ok"):
        return {"message": "Trabalho autónomo marcado como realizado"}
    raise HTTPException(status_code=400, detail=resultado.get("erro", "Erro ao realizar"))


@router.post("/api/aulas/{aula_id}/terminar", tags=["Aulas"])
async def terminar_aula(aula_id: int, payload: TerminarPayload, user=Depends(get_current_user_required)):
    """Marca sessão como terminada com avaliação (1-5), observações e/ou áudio de feedback."""
    aula_info = aula_service.obter_aula_por_id(aula_id)
    if not aula_info:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    if not _check_session_permission(user, aula_info):
        raise HTTPException(status_code=403, detail="Sem permissão para alterar esta sessão.")
    resultado = aula_service.terminar_aula(
        aula_id, payload.avaliacao, payload.obs_termino, payload.feedback_audio_path
    )
    if resultado.get("ok"):
        return {"message": "Sessão terminada com sucesso"}
    raise HTTPException(status_code=400, detail=resultado.get("erro", "Erro ao terminar sessão"))


@router.post("/api/turmas", tags=["Core"])
async def create_turma(turma: TurmaCreate, user=Depends(get_current_user_required)):
    """Cria uma nova turma."""
    _require_coordenacao(user)
    res = turma_service.criar_turma(turma.nome, turma.estabelecimento_id)
    if res:
        return res
    raise HTTPException(status_code=400, detail="Falha ao criar turma (pode já existir)")


@router.get("/api/turmas", tags=["Core"])
async def get_turmas(estabelecimento_id: Optional[int] = None, user=Depends(get_current_user_required)):
    """Lista todas as turmas com estabelecimentos. Opcionalmente filtra por estabelecimento_id."""
    return turma_service.listar_turmas_com_estabelecimento(estabelecimento_id)


@router.put("/api/turmas/{id}", tags=["Core"])
async def update_turma(id: int, turma: TurmaCreate, user=Depends(get_current_user_required)):
    """Atualiza uma turma."""
    _require_coordenacao(user)
    sucesso = turma_service.atualizar_turma(id, turma.nome, turma.estabelecimento_id)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar turma")
    return {"message": "Turma atualizada"}


@router.delete("/api/turmas/{id}", tags=["Core"])
async def delete_turma(id: int, user=Depends(get_current_user_required)):
    """Apaga uma turma."""
    _require_coordenacao(user)
    sucesso = turma_service.apagar_turma(id)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao apagar turma")
    return {"message": "Turma apagada"}


@router.get("/api/turmas/{turma_id}/alunos", tags=["Core"])
async def get_alunos_turma(turma_id: int, user=Depends(get_current_user_required)):
    """Lista os alunos de uma turma."""
    return aluno_service.listar_alunos_por_turma(turma_id)


@router.put("/api/turmas/{turma_id}/alunos", tags=["Core"])
async def update_alunos_turma(turma_id: int, payload: AlunosUpdate):
    """Substitui a lista de alunos de uma turma."""
    sucesso = aluno_service.definir_alunos_turma(turma_id, payload.nomes)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar alunos")
    return {"message": "Alunos atualizados"}


@router.get("/api/turmas/{turma_id}/disciplinas", tags=["Core"])
async def get_turma_disciplinas(turma_id: int, user=Depends(get_current_user_required)):
    """Lista as disciplinas locais de uma turma."""
    return turma_service.listar_disciplinas_turma(turma_id)


@router.get("/api/mentores", tags=["Core"])
async def get_mentores(user=Depends(get_current_user_required)):
    """Lista todos os mentores para dropdown."""
    return turma_service.listar_mentores()


@router.get("/api/codigos-sessao", tags=["Core"])
async def get_codigos_sessao(perfil: str = "", disciplina: str = "", user=Depends(get_current_user_required)):
    """
    Retorna códigos de sessão (sumário + objetivo) filtrados por perfil do mentor e disciplina.
    perfil: 'mentor' | 'produtor' | 'mentor_produtor' | 'coordenador' | 'direcao' | 'it_support'
    disciplina: nome da turma_disciplina (ex: 'Clube de RAP')
    """
    data_path = os.path.join(os.path.dirname(__file__), "..", "..", "services", "data", "codigos_sessao.json")
    with open(data_path, encoding="utf-8") as f:
        all_roles = json.load(f)

    # Map perfil → JSON role labels
    perfil_lower = perfil.lower()
    if perfil_lower in ("coordenador", "direcao", "it_support"):
        target_roles = {"Coordenador; Direcao; It_support"}
    elif perfil_lower == "produtor":
        target_roles = {"Produtor"}
    elif perfil_lower == "mentor_produtor":
        target_roles = {"Mentor", "Produtor"}
    else:  # mentor or empty
        target_roles = {"Mentor"}

    result = []
    seen = set()
    for role_entry in all_roles:
        if role_entry["role"] not in target_roles:
            continue
        for disc in role_entry["disciplinas"]:
            if disciplina and disc["nome"].lower() != disciplina.lower():
                continue
            for cod in disc["codigos"]:
                key = (disc["nome"], cod["codigo"])
                if key not in seen:
                    seen.add(key)
                    result.append({
                        "disciplina": disc["nome"],
                        "codigo": cod["codigo"],
                        "sumario": cod["sumario"],
                        "objetivo": cod["objetivo"],
                    })
    return result


@router.get("/api/produtores", tags=["Core"])
async def get_produtores(user=Depends(get_current_user_required)):
    """Lista todos os produtores para dropdown."""
    return turma_service.listar_produtores()

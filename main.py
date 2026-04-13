"""
==============================================================================
RAP NOVA ESCOLA - API de Coordenação de Equipa
==============================================================================
Ficheiro Principal (main.py)
Este é o ponto de entrada da API web.

Responsabilidades:
- Arrancar a aplicação web com FastAPI
- Definir as rotas (endpoints) da API
- Configurar CORS para permitir comunicação com o frontend

Autor: Equipa RAP Nova Escola (adaptado para API por Gemini)
Versão: 2.0
==============================================================================
"""

# Importações de bibliotecas
import uvicorn
from typing import List, Optional
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, Field
import os

# Carregar variáveis de ambiente
load_dotenv()

# Importações dos nossos módulos de serviço
from services import aula_service
from auth import get_current_user_optional, get_current_user_required

# -----------------------------------------------------------------------------
# 1. CRIAÇÃO E CONFIGURAÇÃO DA APLICAÇÃO FASTAPI
# -----------------------------------------------------------------------------

# Criar a instância principal da aplicação
app = FastAPI(
    title="RAP Nova Escola API",
    description="API para gerir as operações da aplicação RAP Nova Escola.",
    version="1.0.0"
)

# Definir as origens estáticas que podem fazer pedidos à nossa API
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "https://app-rap-novaescola.vercel.app",
    "https://bpm.rapnovaescola.pt"
]

# Adicionar o middleware de CORS à aplicação
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"(https://app-rap-novaescola(-[a-z0-9]+)*\.vercel\.app|https://([a-z0-9-]+\.)?rapnovaescola\.pt|http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+)",
    allow_credentials=True,
    allow_methods=["*"],  # Permite todos os métodos (GET, POST, PUT, etc)
    allow_headers=["*"],  # Permite todos os cabeçalhos
)

# -----------------------------------------------------------------------------
# Endpoints de Estúdio
# -----------------------------------------------------------------------------
# -----------------------------------------------------------------------------
# Endpoints de Estúdio
# -----------------------------------------------------------------------------

@app.get("/api/estudio/reservas", tags=["Estudio"])
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

@app.post("/api/estudio/reservas", tags=["Estudio"])
async def create_estudio_reserva(reserva: ReservaCreate, user=Depends(get_current_user_required)):
    """Cria uma nova reserva de estúdio."""
    resultado = estudio_service.criar_reserva(reserva.dict())
    if not resultado:
        raise HTTPException(status_code=500, detail="Erro ao criar reserva")
    return resultado
@app.delete("/api/estudio/reservas/{reserva_id}", tags=["Estudio"])
async def delete_estudio_reserva(reserva_id: int, user=Depends(get_current_user_required)):
    """Apaga uma reserva de estúdio."""
    sucesso = estudio_service.apagar_reserva(reserva_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Reserva não encontrada ou erro ao apagar")
    return {"message": "Reserva apagada com sucesso"}
# -----------------------------------------------------------------------------
# 2. DEFINIÇÃO DAS ROTAS DA API (ENDPOINTS)
# -----------------------------------------------------------------------------

@app.get("/", tags=["Root"])
async def read_root():
    """
    Endpoint principal. Retorna uma mensagem de boas-vindas.
    Útil para verificar se a API está a funcionar.
    """
    return {"message": "Bem-vindo à API do RAP Nova Escola!"}


# --- Autenticação (user atual via JWT Supabase) ---
@app.get("/api/me", tags=["Auth"])
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


# --- Rotas para Aulas ---
@app.get("/api/aulas", tags=["Aulas"])
async def get_todas_aulas(user=Depends(get_current_user_required)):
    """
    Endpoint para listar todas as aulas existentes.
    Chama o serviço correspondente e retorna os dados.
    """
    try:
        aulas = aula_service.listar_todas_aulas()
        return aulas
    except Exception as e:
        return {"error": str(e)}

@app.get("/api/aulas/proximo-numero", tags=["Aulas"])
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


@app.get("/api/aulas/registaveis", tags=["Registos"])
async def get_sessoes_registaveis(user=Depends(get_current_user_required)):
    """Sessões terminadas/realizadas do user ainda sem registo."""
    user_id = user.get("sub")
    return registo_service.listar_sessoes_registaveis(user_id)

@app.get("/api/aulas/registaveis/todas", tags=["Registos"])
async def get_todas_sessoes_registaveis(user=Depends(get_current_user_required)):
    """Todas as sessões terminadas/realizadas sem registo (coordenadores/direção)."""
    role = user.get("user_metadata", {}).get("role", "")
    if role not in ["coordenador", "direcao", "it_support"]:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return registo_service.listar_todas_sessoes_registaveis()

@app.get("/api/aulas/export", tags=["Aulas"])
async def export_aulas(
    projeto_ids: Optional[str] = None,
    tipo_sessao: Optional[str] = "todas",
    estados: Optional[str] = None,
    mentor_id: Optional[int] = None,
    data_inicio: Optional[str] = None,
    data_fim: Optional[str] = None,
    user=Depends(get_current_user_required),
):
    """Exporta lista de atividades/sessões com filtros flexíveis (coordenadores e superiores)."""
    role = user.get("user_metadata", {}).get("role", "")
    if role not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Sem permissão para exportar atividades.")
    projeto_ids_list = [int(p.strip()) for p in projeto_ids.split(",") if p.strip()] if projeto_ids else None
    estados_list = [e.strip() for e in estados.split(",")] if estados else None
    mentor_id_int = int(mentor_id) if mentor_id else None
    return aula_service.listar_aulas_export(
        projeto_ids=projeto_ids_list,
        tipo_sessao=tipo_sessao or "todas",
        estados=estados_list,
        mentor_id=mentor_id_int,
        data_inicio=data_inicio,
        data_fim=data_fim,
    )


@app.get("/api/aulas/{aula_id}", tags=["Aulas"])
async def get_aula_by_id(aula_id: int, user=Depends(get_current_user_required)):
    """
    Endpoint para obter os detalhes de uma aula específica.
    """
    try:
        aula = aula_service.obter_aula_por_id(aula_id)
        if aula:
            return aula
        return {"message": "Aula não encontrada"}
    except Exception as e:
        return {"error": str(e)}

# Modelos Pydantic para validação
from models.sqlmodel_models import AulaCreate, AulaUpdate

COORD_ROLES = {"coordenador", "direcao", "it_support"}

@app.post("/api/aulas", tags=["Aulas"])
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
    )
    if nova_aula is None:
        raise HTTPException(
            status_code=500,
            detail="Erro ao criar aula. Verifica se a migração 001_trabalho_autonomo.sql foi executada no Supabase."
        )
    return nova_aula


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


@app.post("/api/aulas/recorrentes", tags=["Aulas"])
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
        )
        return {"criadas": len(resultados), "sessoes": resultados}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/aulas/{aula_id}", tags=["Aulas"])
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

@app.delete("/api/aulas/{aula_id}", tags=["Aulas"])
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

def _check_session_permission(user: dict, aula_info: dict):
    """Verifica se o user tem permissão para alterar o estado da sessão.
    Coordenadores podem alterar todas. Outros users só as atribuídas a eles."""
    user_id = user.get("sub")
    role = (user.get("user_metadata") or {}).get("role", "")
    # Coordenadores, direção e IT têm acesso total
    if role in ("coordenador", "direcao", "it_support"):
        return True
    # Sessão regular: apenas o mentor atribuído pode agir
    if not aula_info.get("is_autonomous"):
        mentor_uid = aula_info.get("mentor_user_id")
        return mentor_uid is not None and mentor_uid == user_id
    # Trabalho autónomo: apenas o responsável pode agir
    else:
        return aula_info.get("responsavel_user_id") == user_id

@app.post("/api/aulas/{aula_id}/confirm", tags=["Aulas"])
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

@app.post("/api/aulas/{aula_id}/reject", tags=["Aulas"])
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

@app.post("/api/aulas/{aula_id}/realize", tags=["Aulas"])
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

class TerminarPayload(BaseModel):
    avaliacao: int = Field(ge=1, le=5)
    obs_termino: Optional[str] = None

@app.post("/api/aulas/{aula_id}/terminar", tags=["Aulas"])
async def terminar_aula(aula_id: int, payload: TerminarPayload, user=Depends(get_current_user_required)):
    """Marca sessão como terminada com avaliação (1-5) e observações."""
    aula_info = aula_service.obter_aula_por_id(aula_id)
    if not aula_info:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")
    if not _check_session_permission(user, aula_info):
        raise HTTPException(status_code=403, detail="Sem permissão para alterar esta sessão.")
    resultado = aula_service.terminar_aula(aula_id, payload.avaliacao, payload.obs_termino)
    if resultado.get("ok"):
        return {"message": "Sessão terminada com sucesso"}
    raise HTTPException(status_code=400, detail=resultado.get("erro", "Erro ao terminar sessão"))

# --- Rotas para Notificações ---

from auth import get_current_user_required

@app.get("/api/notifications", tags=["Notifications"])
async def get_notifications(user=Depends(get_current_user_required)):
    """
    Lista notificações de um utilizador.
    O user_id é extraído do token JWT (sub).
    """
    try:
        # Extrair user_id do token (campo 'sub' é o UUID no Supabase)
        uid = user.get("sub")
        
        if not uid:
            raise HTTPException(status_code=401, detail="Token inválido ou sem ID")

        notificacoes = notification_service.listar_notificacoes(uid)
        return notificacoes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/notifications/{id}/read", tags=["Notifications"])
async def mark_notification_read(id: int, user=Depends(get_current_user_required)):
    """
    Marca notificação como lida (apenas do próprio utilizador).
    """
    uid = user.get("sub")
    notif = notification_service.obter_notificacao(id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    if notif.get("user_id") != uid:
        raise HTTPException(status_code=403, detail="Sem permissão para esta notificação")
    sucesso = notification_service.marcar_como_lida(id)
    if sucesso:
        return {"message": "Notificação marcada como lida"}
    raise HTTPException(status_code=500, detail="Erro ao marcar notificação")

@app.delete("/api/notifications/{id}", tags=["Notifications"])
async def delete_notification(id: int, user=Depends(get_current_user_required)):
    """
    Apaga notificação (apenas do próprio utilizador).
    """
    uid = user.get("sub")
    notif = notification_service.obter_notificacao(id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    if notif.get("user_id") != uid:
        raise HTTPException(status_code=403, detail="Sem permissão para esta notificação")
    sucesso = notification_service.apagar_notificacao(id)
    if sucesso:
        return {"message": "Notificação apagada"}
    raise HTTPException(status_code=500, detail="Erro ao apagar notificação")

@app.delete("/api/notifications", tags=["Notifications"])
async def delete_all_notifications(user=Depends(get_current_user_required)):
    """Apaga todas as notificações do user autenticado."""
    uid = user.get("sub")
    count = notification_service.apagar_todas_notificacoes(uid)
    return {"message": f"{count} notificações apagadas"}

# --- Rotas para Web Push Notifications ---
import os
from services import push_service

class PushSubscribePayload(BaseModel):
    endpoint: str
    p256dh: str
    auth: str

class PushUnsubscribePayload(BaseModel):
    endpoint: str

@app.get("/api/push/vapid-key", tags=["Push"])
async def get_vapid_public_key():
    """Retorna a chave pública VAPID para o frontend subscrever push."""
    key = os.getenv("VAPID_PUBLIC_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Push notifications não configuradas")
    return {"public_key": key}

@app.post("/api/push/subscribe", tags=["Push"])
async def push_subscribe(payload: PushSubscribePayload, user=Depends(get_current_user_required)):
    """Guarda subscrição push do utilizador autenticado."""
    uid = user.get("sub")
    sucesso = push_service.guardar_subscricao(uid, payload.endpoint, payload.p256dh, payload.auth)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao guardar subscrição")
    return {"ok": True}

@app.post("/api/push/unsubscribe", tags=["Push"])
async def push_unsubscribe(payload: PushUnsubscribePayload, user=Depends(get_current_user_required)):
    """Remove subscrição push do utilizador autenticado."""
    uid = user.get("sub")
    push_service.remover_subscricao(uid, payload.endpoint)
    return {"ok": True}

# --- Rotas para Projetos ---
from services import projeto_service

class ProjetoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None

class ProjetoEstabAssoc(BaseModel):
    estabelecimento_id: int

@app.get("/api/projetos", tags=["Projetos"])
async def get_projetos(user=Depends(get_current_user_required)):
    """Lista todos os projetos."""
    return projeto_service.listar_projetos()

@app.post("/api/projetos", tags=["Projetos"])
async def create_projeto(data: ProjetoCreate, user=Depends(get_current_user_required)):
    """Cria um novo projeto."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    res = projeto_service.criar_projeto(data.nome, data.descricao)
    if not res:
        raise HTTPException(status_code=400, detail="Falha ao criar projeto")
    return res

@app.put("/api/projetos/{id}", tags=["Projetos"])
async def update_projeto(id: int, data: ProjetoCreate, user=Depends(get_current_user_required)):
    """Atualiza um projeto."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    sucesso = projeto_service.atualizar_projeto(id, data.nome, data.descricao)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar projeto")
    return {"message": "Projeto atualizado"}

@app.delete("/api/projetos/{id}", tags=["Projetos"])
async def delete_projeto(id: int, user=Depends(get_current_user_required)):
    """Apaga um projeto."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    sucesso = projeto_service.apagar_projeto(id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return {"message": "Projeto apagado"}

@app.get("/api/projetos/{id}/estabelecimentos", tags=["Projetos"])
async def get_projeto_estabelecimentos(id: int, user=Depends(get_current_user_required)):
    """Lista estabelecimentos de um projeto."""
    return projeto_service.listar_estabelecimentos_por_projeto(id)

@app.post("/api/projetos/{id}/estabelecimentos", tags=["Projetos"])
async def add_projeto_estabelecimento(id: int, data: ProjetoEstabAssoc, user=Depends(get_current_user_required)):
    """Associa um estabelecimento a um projeto."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    sucesso = projeto_service.associar_estabelecimento(id, data.estabelecimento_id)
    if not sucesso:
        raise HTTPException(status_code=400, detail="Falha ao associar estabelecimento")
    return {"message": "Estabelecimento associado"}

@app.delete("/api/projetos/{id}/estabelecimentos/{estab_id}", tags=["Projetos"])
async def remove_projeto_estabelecimento(id: int, estab_id: int, user=Depends(get_current_user_required)):
    """Remove associação entre projeto e estabelecimento."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    sucesso = projeto_service.desassociar_estabelecimento(id, estab_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Associação não encontrada")
    return {"message": "Estabelecimento desassociado"}

# --- Rotas para Turmas/Estabelecimentos ---
from services import turma_service, profile_service, estudio_service, notification_service, registo_service, aluno_service

@app.get("/api/equipa", tags=["Core"])
async def get_equipa(user=Depends(get_current_user_required)):
    """Lista todos os membros da equipa (perfis públicos)."""
    return profile_service.listar_perfis()

@app.delete("/api/equipa/{user_id}", tags=["Core"])
async def delete_equipa_member(user_id: str, user=Depends(get_current_user_required)):
    """Apaga permanentemente um membro da equipa (apenas direção)."""
    caller_id = user.get("sub")
    perfis = profile_service.listar_perfis()
    caller_profile = next((p for p in perfis if p.get("id") == caller_id), None)
    if not caller_profile or caller_profile.get("role") not in ("direcao", "it_support"):
        raise HTTPException(status_code=403, detail="Apenas a direção pode apagar membros.")
    if user_id == caller_id:
        raise HTTPException(status_code=400, detail="Não podes apagar a tua própria conta.")
    target_profile = next((p for p in perfis if p.get("id") == user_id), None)
    if not target_profile:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado.")
    try:
        profile_service.apagar_utilizador(user_id)
        return {"message": "Utilizador apagado com sucesso."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class EquipaMembroUpdate(BaseModel):
    role: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

@app.patch("/api/equipa/{user_id}", tags=["Core"])
async def update_equipa_member(user_id: str, payload: EquipaMembroUpdate, user=Depends(get_current_user_required)):
    """Atualiza role, nome e avatar de um membro (apenas direção/it_support)."""
    caller_id = user.get("sub")
    perfis = profile_service.listar_perfis()
    caller_profile = next((p for p in perfis if p.get("id") == caller_id), None)
    if not caller_profile or caller_profile.get("role") not in ("direcao", "it_support"):
        raise HTTPException(status_code=403, detail="Apenas a direção pode editar membros.")
    if user_id == caller_id:
        raise HTTPException(status_code=400, detail="Usa a página de perfil para editar os teus dados.")
    target_profile = next((p for p in perfis if p.get("id") == user_id), None)
    if not target_profile:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado.")
    ROLES_VALIDOS = {"mentor", "produtor", "mentor_produtor", "coordenador", "direcao", "it_support"}
    if payload.role is not None and payload.role not in ROLES_VALIDOS:
        raise HTTPException(status_code=400, detail="Role inválido.")
    dados = {k: v for k, v in payload.model_dump().items() if v is not None}
    sucesso = profile_service.atualizar_membro(user_id, dados)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar membro.")
    return {"ok": True}


# --- Rota para Perfil / Avatar ---

class AvatarPayload(BaseModel):
    avatar_url: str

@app.patch("/api/profile/avatar", tags=["Core"])
async def update_avatar(payload: AvatarPayload, user=Depends(get_current_user_required)):
    """Atualiza avatar_url na tabela profiles."""
    from db import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE profiles SET avatar_url = %s WHERE id = %s",
            (payload.avatar_url, user["sub"])
        )
        conn.commit()
        cur.close()
        return {"ok": True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# --- Rotas para Equipamento ---
from services import equipment_service

@app.get("/api/equipamento/categorias", tags=["Equipamento"])
async def get_categorias_equipamento(user=Depends(get_current_user_required)):
    """Lista categorias de equipamento com os seus itens."""
    return equipment_service.listar_categorias()

@app.get("/api/aulas/{aula_id}/equipamento", tags=["Equipamento"])
async def get_equipamento_sessao(aula_id: int, user=Depends(get_current_user_required)):
    """Lista itens de equipamento atribuídos a uma sessão."""
    return equipment_service.listar_equipamento_sessao(aula_id)

class EquipamentoAtribuir(BaseModel):
    item_ids: list[int]

@app.put("/api/aulas/{aula_id}/equipamento", tags=["Equipamento"])
async def put_equipamento_sessao(aula_id: int, payload: EquipamentoAtribuir, user=Depends(get_current_user_required)):
    """Atribui itens de equipamento a uma sessão."""
    sucesso = equipment_service.atribuir_equipamento_sessao(aula_id, payload.item_ids)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atribuir equipamento")
    return {"message": "Equipamento atribuído"}

class ConflitosVerificar(BaseModel):
    item_ids: list[int]
    data_hora: str
    duracao_minutos: int
    excluir_aula_id: Optional[int] = None

@app.post("/api/equipamento/verificar-conflitos", tags=["Equipamento"])
async def verificar_conflitos_equipamento(payload: ConflitosVerificar, user=Depends(get_current_user_required)):
    """Verifica conflitos temporais de equipamento."""
    conflitos = equipment_service.verificar_conflitos(
        payload.item_ids, payload.data_hora, payload.duracao_minutos, payload.excluir_aula_id
    )
    # Enviar notificacoes de conflito
    for c in conflitos:
        if 'item_nome' in c and 'item_identificador' in c:
            equipment_service.notificar_conflito(
                c['item_nome'], c['item_identificador'],
                f"Conflito com sessao #{c.get('aula_id', '?')}"
            )
    return {"conflitos": conflitos, "tem_conflitos": len(conflitos) > 0}

# --- Rotas para Equipamento Individual (CRUD) ---

@app.get("/api/equipamento/itens", tags=["Equipamento"])
async def get_equipamento_itens(
    categoria_id: Optional[int] = None,
    estado: Optional[str] = None,
    user=Depends(get_current_user_required),
):
    """Lista todos os itens individuais de equipamento (localizacao/responsavel derivados de sessoes)."""
    return equipment_service.listar_itens(categoria_id, estado)

@app.get("/api/equipamento/stats", tags=["Equipamento"])
async def get_equipamento_stats(user=Depends(get_current_user_required)):
    """Estatisticas globais de equipamento."""
    return equipment_service.obter_stats()

class ItemCreate(BaseModel):
    categoria_id: int
    nome: str
    identificador: str
    estado: str = 'excelente'
    observacoes: Optional[str] = None

@app.post("/api/equipamento/itens", tags=["Equipamento"])
async def post_equipamento_item(item: ItemCreate, user=Depends(get_current_user_required)):
    """Cria um novo item de equipamento individual."""
    resultado = equipment_service.criar_item(item.dict())
    if not resultado:
        raise HTTPException(status_code=500, detail="Erro ao criar item")
    return resultado

class ItemUpdate(BaseModel):
    nome: Optional[str] = None
    identificador: Optional[str] = None
    estado: Optional[str] = None
    observacoes: Optional[str] = None
    categoria_id: Optional[int] = None

@app.put("/api/equipamento/itens/{item_id}", tags=["Equipamento"])
async def put_equipamento_item(item_id: int, item: ItemUpdate, user=Depends(get_current_user_required)):
    """Atualiza um item de equipamento."""
    dados = {k: v for k, v in item.dict().items() if v is not None}
    sucesso = equipment_service.atualizar_item(item_id, dados)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Item nao encontrado ou erro ao atualizar")
    return {"message": "Item atualizado"}

@app.delete("/api/equipamento/itens/{item_id}", tags=["Equipamento"])
async def delete_equipamento_item(item_id: int, user=Depends(get_current_user_required)):
    """Remove um item de equipamento."""
    sucesso = equipment_service.apagar_item(item_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Item nao encontrado")
    return {"message": "Item removido"}

class UtilizacaoCreate(BaseModel):
    user_id: str
    user_nome: Optional[str] = None
    aula_id: Optional[int] = None
    observacoes: Optional[str] = None

@app.post("/api/equipamento/itens/{item_id}/utilizacao", tags=["Equipamento"])
async def post_utilizacao(item_id: int, payload: UtilizacaoCreate, user=Depends(get_current_user_required)):
    """Regista utilizacao de um item."""
    sucesso = equipment_service.registar_utilizacao(
        item_id, payload.user_id, payload.user_nome, payload.aula_id, payload.observacoes
    )
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao registar utilizacao")
    return {"message": "Utilizacao registada"}

@app.get("/api/equipamento/itens/{item_id}/historico", tags=["Equipamento"])
async def get_historico_item(item_id: int, user=Depends(get_current_user_required)):
    """Lista historico de utilizacao de um item."""
    return equipment_service.listar_historico(item_id)

@app.get("/api/equipamento/itens/{item_id}/ocupacoes", tags=["Equipamento"])
async def get_ocupacoes_item(item_id: int, user=Depends(get_current_user_required)):
    """Lista sessoes futuras que usam este item."""
    return equipment_service.listar_ocupacoes_item(item_id)


class LocalizacaoPayload(BaseModel):
    tipo: str  # 'estabelecimento' | 'mentor' | 'estudio'
    ref_id: Optional[str] = None
    nome: str


@app.patch("/api/equipamento/itens/{item_id}/localizacao", tags=["Equipamento"])
async def patch_localizacao_item(item_id: int, payload: LocalizacaoPayload, user=Depends(get_current_user_required)):
    """Atualiza a localizacao manual de um item de equipamento."""
    if payload.tipo not in ('estabelecimento', 'mentor', 'estudio'):
        raise HTTPException(status_code=400, detail="Tipo de localização inválido. Usar: estabelecimento, mentor, estudio")
    ok = equipment_service.atualizar_localizacao(
        item_id, payload.tipo, payload.ref_id, payload.nome, user["sub"]
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    return {"message": "Localização atualizada"}


@app.get("/api/equipamento/localizacoes", tags=["Equipamento"])
async def get_localizacoes_possiveis(user=Depends(get_current_user_required)):
    """Lista todas as localizacoes possiveis para equipamento (estabelecimentos, membros, estudio)."""
    return equipment_service.listar_localizacoes_possiveis()


class TurmaCreate(BaseModel):
    nome: str
    estabelecimento_id: str

@app.post("/api/turmas", tags=["Core"])
async def create_turma(turma: TurmaCreate, user=Depends(get_current_user_required)):
    """Cria uma nova turma."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    res = turma_service.criar_turma(turma.nome, turma.estabelecimento_id)
    if res:
        return res
    raise HTTPException(status_code=400, detail="Falha ao criar turma (pode já existir)")

@app.get("/api/turmas", tags=["Core"])
async def get_turmas(estabelecimento_id: Optional[int] = None, user=Depends(get_current_user_required)):
    """Lista todas as turmas com estabelecimentos. Opcionalmente filtra por estabelecimento_id."""
    return turma_service.listar_turmas_com_estabelecimento(estabelecimento_id)

@app.put("/api/turmas/{id}", tags=["Core"])
async def update_turma(id: int, turma: TurmaCreate, user=Depends(get_current_user_required)):
    """Atualiza uma turma."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    sucesso = turma_service.atualizar_turma(id, turma.nome, turma.estabelecimento_id)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar turma")
    return {"message": "Turma atualizada"}

@app.delete("/api/turmas/{id}", tags=["Core"])
async def delete_turma(id: int, user=Depends(get_current_user_required)):
    """Apaga uma turma."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    sucesso = turma_service.apagar_turma(id)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao apagar turma")
    return {"message": "Turma apagada"}

class AlunosUpdate(BaseModel):
    nomes: list[str]

@app.get("/api/turmas/{turma_id}/alunos", tags=["Core"])
async def get_alunos_turma(turma_id: int, user=Depends(get_current_user_required)):
    """Lista os alunos de uma turma."""
    return aluno_service.listar_alunos_por_turma(turma_id)

@app.put("/api/turmas/{turma_id}/alunos", tags=["Core"])
async def update_alunos_turma(turma_id: int, payload: AlunosUpdate):
    """Substitui a lista de alunos de uma turma."""
    sucesso = aluno_service.definir_alunos_turma(turma_id, payload.nomes)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar alunos")
    return {"message": "Alunos atualizados"}

@app.get("/api/turmas/{turma_id}/disciplinas", tags=["Core"])
async def get_turma_disciplinas(turma_id: int, user=Depends(get_current_user_required)):
    """Lista as disciplinas locais de uma turma."""
    return turma_service.listar_disciplinas_turma(turma_id)

@app.get("/api/mentores", tags=["Core"])
async def get_mentores(user=Depends(get_current_user_required)):
    """Lista todos os mentores para dropdown."""
    return turma_service.listar_mentores()


@app.get("/api/codigos-sessao", tags=["Core"])
async def get_codigos_sessao(perfil: str = "", disciplina: str = "", user=Depends(get_current_user_required)):
    """
    Retorna códigos de sessão (sumário + objetivo) filtrados por perfil do mentor e disciplina.
    perfil: 'mentor' | 'produtor' | 'mentor_produtor' | 'coordenador' | 'direcao' | 'it_support'
    disciplina: nome da turma_disciplina (ex: 'Clube de RAP')
    """
    import json, os
    data_path = os.path.join(os.path.dirname(__file__), "services", "data", "codigos_sessao.json")
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

@app.get("/api/produtores", tags=["Core"])
async def get_produtores(user=Depends(get_current_user_required)):
    """Lista todos os produtores para dropdown."""
    return turma_service.listar_produtores()



# -----------------------------------------------------------------------------
# Endpoints de Produção Musical
# -----------------------------------------------------------------------------
from services import musica_service

@app.get("/api/musicas", tags=["Producao"])
async def get_musicas(arquivadas: bool = False, projeto_id: Optional[int] = None, user=Depends(get_current_user_optional)):
    """Lista todas as músicas (ativas ou arquivadas), com filtro opcional por projeto."""
    user_id = user.get("sub") if user else None
    role = (user.get("user_metadata") or {}).get("role") if user else None
    return musica_service.listar_musicas(arquivadas, user_id, role, projeto_id)

class MusicaCreate(BaseModel):
    titulo: str
    turma_id: int
    disciplina: Optional[str] = None
    disciplina_id: Optional[int] = None
    projeto_id: Optional[int] = None

@app.post("/api/musicas", tags=["Producao"])
async def create_musica(musica: MusicaCreate, user=Depends(get_current_user_required)):
    """Cria uma nova música."""
    criador_id = user.get("sub")
    criador_role = (user.get("user_metadata") or {}).get("role")
    resultado = musica_service.criar_musica(musica.dict(), criador_id, criador_role)
    if not resultado:
        raise HTTPException(status_code=500, detail="Erro ao criar música")
    return resultado

class MusicaEstadoUpdate(BaseModel):
    estado: str

@app.patch("/api/musicas/{musica_id}/estado", tags=["Producao"])
async def update_musica_estado(musica_id: int, update: MusicaEstadoUpdate):
    """Atualiza o estado de uma música (Manual - Admin only idealmente)."""
    sucesso, mensagem = musica_service.atualizar_estado(musica_id, update.estado)
    if not sucesso:
        raise HTTPException(status_code=400, detail=mensagem)
    return {"message": mensagem}

@app.post("/api/musicas/{musica_id}/avancar", tags=["Producao"])
async def avancar_fase_musica(musica_id: int, dados: Optional[dict] = None, user=Depends(get_current_user_required)):
    """Avança a música para a próxima fase."""
    user_id = user.get("sub")
    sucesso, mensagem = musica_service.avancar_fase(musica_id, user_id, dados)
    if not sucesso:
        raise HTTPException(status_code=400, detail=mensagem)
    return {"message": mensagem}

@app.post("/api/musicas/{musica_id}/aceitar", tags=["Producao"])
async def aceitar_tarefa_musica(musica_id: int, user=Depends(get_current_user_required)):
    """Aceita uma tarefa da pool."""
    user_id = user.get("sub")
    sucesso, mensagem = musica_service.aceitar_tarefa(musica_id, user_id)
    if not sucesso:
        raise HTTPException(status_code=400, detail=mensagem)
    return {"message": mensagem}

@app.patch("/api/musicas/{musica_id}/arquivar", tags=["Producao"])
async def arquivar_musica(musica_id: int):
    """Arquiva uma música (apenas se estiver em Finalização)."""
    sucesso, mensagem = musica_service.arquivar_musica(musica_id)
    if not sucesso:
        raise HTTPException(status_code=400, detail=mensagem)
    return {"message": mensagem}

# -----------------------------------------------------------------------------
# Endpoints de Registos de Sessão
# -----------------------------------------------------------------------------

@app.get("/api/registos", tags=["Registos"])
async def get_registos(user=Depends(get_current_user_required)):
    """Lista registos do user autenticado."""
    user_id = user.get("sub")
    return registo_service.listar_registos(user_id)

@app.get("/api/registos/todos", tags=["Registos"])
async def get_todos_registos(user=Depends(get_current_user_required)):
    """Lista todos os registos (para coordenadores)."""
    return registo_service.listar_registos()

@app.get("/api/registos/export", tags=["Registos"])
async def export_registos(
    data_inicio: str,
    data_fim: str,
    user_ids: Optional[str] = None,
    estabelecimento_ids: Optional[str] = None,
    user=Depends(get_current_user_required),
):
    """Exporta registos filtrados (para direção/coordenadores)."""
    from services import profile_service
    user_id = user.get("sub")
    perfis = profile_service.listar_perfis()
    user_profile = next((p for p in perfis if str(p.get("id")) == user_id), None)
    if not user_profile or user_profile.get("role") not in ("coordenador", "direcao", "it_support"):
        raise HTTPException(status_code=403, detail="Sem permissão para exportar registos.")
    user_id_list = [uid.strip() for uid in user_ids.split(",")] if user_ids else None
    estab_id_list = [int(eid.strip()) for eid in estabelecimento_ids.split(",")] if estabelecimento_ids else None
    return registo_service.listar_registos_export(data_inicio, data_fim, user_id_list, estab_id_list)

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

@app.post("/api/registos", tags=["Registos"])
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
    )
    if not resultado:
        raise HTTPException(status_code=500, detail="Erro ao criar registo. Verifica se a migração 002_registos.sql foi executada.")
    return resultado

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

@app.patch("/api/registos/{registo_id}", tags=["Registos"])
async def update_registo(registo_id: int, registo: RegistoUpdate, user=Depends(get_current_user_required)):
    """Edita os campos de um registo existente (apenas o próprio user)."""
    user_id = user.get("sub")
    dados = {k: v for k, v in registo.model_dump().items() if v is not None}
    sucesso = registo_service.atualizar_registo(registo_id, user_id, dados)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Registo não encontrado ou sem permissão para editar.")
    return {"message": "Registo atualizado com sucesso"}

@app.delete("/api/registos/{registo_id}", tags=["Registos"])
async def delete_registo(registo_id: int, user=Depends(get_current_user_required)):
    """Apaga um registo (devolve sessão ao dropdown)."""
    user_id = user.get("sub")
    sucesso = registo_service.apagar_registo(registo_id, user_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Registo não encontrado ou erro ao apagar")
    return {"message": "Registo apagado com sucesso"}

# -----------------------------------------------------------------------------

@app.patch("/api/musicas/{musica_id}/desarquivar", tags=["Producao"])
async def desarquivar_musica(musica_id: int):
    """Desarquiva uma música."""
    sucesso, mensagem = musica_service.desarquivar_musica(musica_id)
    if not sucesso:
        raise HTTPException(status_code=400, detail=mensagem)
    return {"message": mensagem}

class MusicaDetalhesUpdate(BaseModel):
    titulo: Optional[str] = None
    deadline: Optional[str] = None
    notas: Optional[str] = None
    link_demo: Optional[str] = None
    turma_id: Optional[int] = None
    disciplina_id: Optional[int] = None

@app.patch("/api/musicas/{musica_id}", tags=["Producao"])
async def update_musica_detalhes(musica_id: int, payload: MusicaDetalhesUpdate, user=Depends(get_current_user_required)):
    """Atualiza detalhes editáveis de uma música (deadline, notas, link_demo, titulo)."""
    sucesso = musica_service.atualizar_detalhes(musica_id, {k: v for k, v in payload.model_dump().items() if v is not None})
    if not sucesso:
        raise HTTPException(status_code=400, detail="Erro ao atualizar música")
    return {"message": "Música atualizada"}

@app.delete("/api/musicas/{musica_id}", tags=["Producao"])
async def delete_musica(musica_id: int, user=Depends(get_current_user_required)):
    """Apaga permanentemente uma música. Restrito a coordenador, direção e IT support."""
    role = (user.get("user_metadata") or {}).get("role", "")
    if role not in {"coordenador", "direcao", "it_support"}:
        raise HTTPException(status_code=403, detail="Sem permissão para apagar músicas.")
    sucesso = musica_service.apagar_musica(musica_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Música não encontrada.")
    return {"message": "Música apagada."}

@app.post("/api/producao/verificar-deadlines", tags=["Producao"])
async def verificar_deadlines_musicas(user=Depends(get_current_user_required)):
    """Verifica músicas em atraso e notifica os responsáveis. Chamar diariamente (cron)."""
    role = (user.get("user_metadata") or {}).get("role", "")
    if role not in {"coordenador", "direcao", "it_support"}:
        raise HTTPException(status_code=403, detail="Sem permissão.")
    count = musica_service.verificar_e_notificar_deadlines()
    return {"notificacoes_enviadas": count}

@app.get("/api/producao/stats/instituicao", tags=["Producao"])
async def get_stats_instituicao(projeto_id: Optional[int] = None, user=Depends(get_current_user_required)):
    """Stats de progresso agrupados por estabelecimento > turma."""
    return musica_service.listar_stats_instituicao(projeto_id)

@app.get("/api/producao/stats/equipa", tags=["Producao"])
async def get_stats_equipa(projeto_id: Optional[int] = None, user=Depends(get_current_user_required)):
    """Stats de músicas agrupados por membro da equipa."""
    return musica_service.listar_stats_equipa(projeto_id)

@app.get("/api/stats/feedback", tags=["Estatisticas"])
async def get_stats_feedback(projeto_id: Optional[int] = None, user=Depends(get_current_user_required)):
    """Lista feedback/avaliações de sessões terminadas."""
    return aula_service.listar_feedback_sessoes(projeto_id)

@app.get("/api/stats/equipa-horas", tags=["Estatisticas"])
async def get_stats_equipa_horas(projeto_id: Optional[int] = None, user=Depends(get_current_user_required)):
    """Horas por colaborador (aulas vs trabalho autónomo)."""
    return aula_service.listar_horas_equipa(projeto_id)

@app.get("/api/stats/sessoes-turma", tags=["Estatisticas"])
async def get_sessoes_turma(turma_id: int, projeto_id: Optional[int] = None, user=Depends(get_current_user_required)):
    """Lista sessões terminadas de uma turma, ordenadas por data."""
    return aula_service.listar_sessoes_turma(turma_id, projeto_id)


@app.get("/api/stats/sessoes-user/{user_id}", tags=["Estatisticas"])
async def get_stats_sessoes_user(user_id: str, user=Depends(get_current_user_required)):
    """Conta sessões concluídas de um user (para pré-preencher Nº Sessão)."""
    return aula_service.contar_sessoes_user(user_id)


# -----------------------------------------------------------------------------
# 9. DASHBOARD (Estatísticas para Produtores)
# -----------------------------------------------------------------------------
from services import dashboard_service

@app.get("/api/dashboard/produtor", tags=["Dashboard"])
async def get_produtor_dashboard(user=Depends(get_current_user_required)):
    """Retorna estatísticas e dados do dashboard para produtores."""
    user_id = user.get("sub")
    dashboard_data = dashboard_service.get_produtor_dashboard(user_id)
    if not dashboard_data:
        raise HTTPException(status_code=500, detail="Erro ao obter dados do dashboard")
    return dashboard_data

# -----------------------------------------------------------------------------
# GEOCODING & DISTÂNCIA (OpenStreetMap / OSRM)
# -----------------------------------------------------------------------------
import httpx

@app.get("/api/geocode/search", tags=["Geocoding"])
async def geocode_search(q: str, user=Depends(get_current_user_required)):
    """Proxy para Nominatim — pesquisa de moradas (Portugal)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": q, "format": "json", "limit": 5, "countrycodes": "pt"},
            headers={"User-Agent": "RAPNovaEscola/1.0 (rap-nova-escola@edu.pt)"},
        )
        return resp.json()

@app.get("/api/distance", tags=["Geocoding"])
async def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float, user=Depends(get_current_user_required)):
    """Calcula distância de condução via OSRM (km)."""
    url = f"https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=false"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        data = resp.json()
        if data.get("routes"):
            distance_km = round(data["routes"][0]["distance"] / 1000, 1)
            return {"distance_km": distance_km}
        return {"distance_km": None, "error": "Rota não encontrada"}


# -----------------------------------------------------------------------------
# MENTOR — LOCALIZAÇÃO
# -----------------------------------------------------------------------------

MENTOR_ROLES = {'mentor', 'produtor', 'mentor_produtor', 'coordenador'}

@app.get("/api/mentores/me", tags=["Core"])
async def get_my_mentor(user=Depends(get_current_user_required)):
    """Retorna o registo de mentor do user autenticado (auto-cria se necessário)."""
    user_id = user.get("sub")
    email = user.get("email")
    mentor = turma_service.obter_mentor_por_user_id(user_id, email)
    if not mentor:
        # Auto-criar se o role do user justifica entrada na tabela mentores
        meta = user.get("user_metadata") or {}
        role = meta.get("role", "")
        if role in MENTOR_ROLES:
            nome = meta.get("full_name") or (email or "").split("@")[0]
            mentor = turma_service.criar_mentor(user_id, nome, email, role)
    if not mentor:
        raise HTTPException(status_code=404, detail="Mentor não encontrado")
    return mentor


class MentorLocationUpdate(BaseModel):
    morada: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@app.patch("/api/mentores/{mentor_id}/location", tags=["Core"])
async def update_mentor_location(mentor_id: int, payload: MentorLocationUpdate, user=Depends(get_current_user_required)):
    """Atualiza a morada e coordenadas de um mentor."""
    sucesso = turma_service.atualizar_localizacao_mentor(
        mentor_id, payload.morada, payload.latitude, payload.longitude
    )
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar localização.")
    return {"ok": True}


# -----------------------------------------------------------------------------
# 10. CURRÍCULO (Competências e Avaliações)
# -----------------------------------------------------------------------------
class EstabelecimentoWikiCreate(BaseModel):
    nome: str
    sigla: Optional[str] = None
    morada: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@app.get("/api/estabelecimentos", tags=["Wiki"])
async def get_estabelecimentos(user=Depends(get_current_user_required)):
    return turma_service.listar_estabelecimentos()

@app.post("/api/estabelecimentos", tags=["Wiki"])
async def create_estabelecimento(inst: EstabelecimentoWikiCreate, user=Depends(get_current_user_required)):
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    res = turma_service.criar_estabelecimento(inst.nome, inst.sigla, inst.morada, inst.latitude, inst.longitude)
    if not res:
        raise HTTPException(status_code=400, detail="Erro ao criar. Possível duplicado.")
    return res

@app.put("/api/estabelecimentos/{id}", tags=["Wiki"])
async def update_estabelecimento(id: int, inst: EstabelecimentoWikiCreate, user=Depends(get_current_user_required)):
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    sucesso = turma_service.atualizar_estabelecimento(id, inst.nome, inst.sigla, inst.morada, inst.latitude, inst.longitude)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar.")
    return {"message": "Atualizado com sucesso"}

@app.delete("/api/estabelecimentos/{id}", tags=["Wiki"])
async def delete_estabelecimento(id: int, user=Depends(get_current_user_required)):
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    sucesso = turma_service.apagar_estabelecimento(id)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao apagar.")
    return {"message": "Apagado com sucesso"}

class ContactoCreate(BaseModel):
    tipo: str  # telefone | email | maps | website | outro
    valor: str
    descricao: Optional[str] = None

@app.get("/api/estabelecimentos/contactos", tags=["Wiki"])
async def get_todos_contactos(user=Depends(get_current_user_required)):
    """Lista todos os contactos de todos os estabelecimentos."""
    return turma_service.listar_todos_contactos()

@app.get("/api/estabelecimentos/{id}/contactos", tags=["Wiki"])
async def get_contactos_estabelecimento(id: int, user=Depends(get_current_user_required)):
    """Lista contactos de um estabelecimento."""
    return turma_service.listar_contactos_estabelecimento(id)

@app.post("/api/estabelecimentos/{id}/contactos", tags=["Wiki"])
async def create_contacto_estabelecimento(id: int, data: ContactoCreate, user=Depends(get_current_user_required)):
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    if data.tipo not in ('telefone', 'email', 'maps', 'website', 'outro'):
        raise HTTPException(status_code=400, detail="Tipo inválido")
    res = turma_service.criar_contacto_estabelecimento(id, data.tipo, data.valor, data.descricao)
    if not res:
        raise HTTPException(status_code=500, detail="Erro ao criar contacto.")
    return res

@app.put("/api/contactos/{id}", tags=["Wiki"])
async def update_contacto(id: int, data: ContactoCreate, user=Depends(get_current_user_required)):
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    sucesso = turma_service.atualizar_contacto_estabelecimento(id, data.tipo, data.valor, data.descricao)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar contacto.")
    return {"message": "Contacto atualizado"}

@app.delete("/api/contactos/{id}", tags=["Wiki"])
async def delete_contacto(id: int, user=Depends(get_current_user_required)):
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    sucesso = turma_service.apagar_contacto_estabelecimento(id)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao apagar contacto.")
    return {"message": "Contacto apagado"}

# -----------------------------------------------------------------------------
# Endpoints de Currículo (Wiki)
# -----------------------------------------------------------------------------
from services import curriculo_service
from services import wiki_service

# --- Legacy: currículo global (mantido para compatibilidade) ---
@app.get("/api/curriculo", tags=["Wiki"])
async def get_curriculo(user=Depends(get_current_user_required)):
    """Lista todo o currículo global (disciplinas e atividades)."""
    return curriculo_service.listar_curriculo()

# --- Wiki v2: disciplinas e atividades locais por turma ---

@app.get("/api/wiki/projeto/{projeto_id}", tags=["Wiki"])
async def get_wiki_hierarquia(projeto_id: int, user=Depends(get_current_user_required)):
    """Hierarquia completa: Projeto > Estabelecimentos > Turmas > Disciplinas > Atividades."""
    result = wiki_service.listar_hierarquia_projeto(projeto_id)
    return result

@app.get("/api/wiki/turma/{turma_id}/disciplinas", tags=["Wiki"])
async def get_wiki_turma_disciplinas(turma_id: int, user=Depends(get_current_user_required)):
    """Lista disciplinas locais de uma turma com atividades."""
    return wiki_service.listar_disciplinas_turma(turma_id)

class TurmaDisciplinaCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    musicas_previstas: int = 0
    atividades: list = []

@app.post("/api/wiki/turma/{turma_id}/disciplinas", tags=["Wiki"])
async def create_wiki_disciplina(turma_id: int, payload: TurmaDisciplinaCreate, user=Depends(get_current_user_required)):
    """Cria disciplina local com atividades em batch."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    result = wiki_service.criar_disciplina_turma(
        turma_id, payload.nome, payload.descricao,
        payload.musicas_previstas, payload.atividades
    )
    if not result:
        raise HTTPException(status_code=500, detail="Erro ao criar disciplina")
    return result

class TurmaDisciplinaUpdate(BaseModel):
    nome: str
    descricao: Optional[str] = None
    musicas_previstas: int = 0

@app.put("/api/wiki/disciplinas/{td_id}", tags=["Wiki"])
async def update_wiki_disciplina(td_id: int, payload: TurmaDisciplinaUpdate, user=Depends(get_current_user_required)):
    """Atualiza uma disciplina local."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    sucesso = wiki_service.atualizar_disciplina_turma(td_id, payload.nome, payload.descricao, payload.musicas_previstas)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar disciplina")
    return {"id": td_id, "nome": payload.nome}

@app.delete("/api/wiki/disciplinas/{td_id}", tags=["Wiki"])
async def delete_wiki_disciplina(td_id: int, user=Depends(get_current_user_required)):
    """Remove disciplina local (cascade apaga atividades)."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    sucesso = wiki_service.apagar_disciplina_turma(td_id)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao apagar disciplina")
    return {"message": "Disciplina apagada"}

class TurmaAtividadeCreate(BaseModel):
    turma_disciplina_id: int
    nome: str
    codigo: Optional[str] = None
    sessoes_previstas: int = 0
    horas_por_sessao: float = 0
    musicas_previstas: int = 0
    role: Optional[str] = None
    is_autonomous: bool = False

@app.post("/api/wiki/atividades", tags=["Wiki"])
async def create_wiki_atividade(payload: TurmaAtividadeCreate, user=Depends(get_current_user_required)):
    """Cria uma atividade local."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    result = wiki_service.criar_atividade(
        payload.turma_disciplina_id, payload.nome, payload.codigo,
        payload.sessoes_previstas, payload.horas_por_sessao,
        payload.musicas_previstas, payload.role, payload.is_autonomous
    )
    if not result:
        raise HTTPException(status_code=500, detail="Erro ao criar atividade")
    return result

class TurmaAtividadeUpdate(BaseModel):
    nome: str
    codigo: Optional[str] = None
    sessoes_previstas: int = 0
    horas_por_sessao: float = 0
    musicas_previstas: int = 0
    role: Optional[str] = None
    is_autonomous: bool = False

@app.put("/api/wiki/atividades/{uuid}", tags=["Wiki"])
async def update_wiki_atividade(uuid: str, payload: TurmaAtividadeUpdate, user=Depends(get_current_user_required)):
    """Atualiza uma atividade local por UUID."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    sucesso = wiki_service.atualizar_atividade(uuid, payload.dict())
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar atividade")
    return {"uuid": uuid, "nome": payload.nome}

@app.delete("/api/wiki/atividades/{uuid}", tags=["Wiki"])
async def delete_wiki_atividade(uuid: str, user=Depends(get_current_user_required)):
    """Remove uma atividade local por UUID."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES:
        raise HTTPException(status_code=403, detail="Acesso negado")
    sucesso = wiki_service.apagar_atividade(uuid)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao apagar atividade")
    return {"message": "Atividade removida"}

# -----------------------------------------------------------------------------
# Endpoints de Chat
# -----------------------------------------------------------------------------
from services import chat_service

class ChatNotifyPayload(BaseModel):
    channel_id: str

@app.post("/api/chat/notify", tags=["Chat"])
async def chat_notify(payload: ChatNotifyPayload, user=Depends(get_current_user_required)):
    """Cria notificacao singleton para membros do canal (exceto sender)."""
    sender_id = user.get("sub")
    chat_service.notificar_mensagem_chat(payload.channel_id, sender_id)
    return {"ok": True}

@app.post("/api/chat/mark-read", tags=["Chat"])
async def chat_mark_read(user=Depends(get_current_user_required)):
    """Marca a notificacao chat_unread como lida para o user."""
    user_id = user.get("sub")
    chat_service.marcar_chat_notificacao_lida(user_id)
    return {"ok": True}

class DMPayload(BaseModel):
    other_user_id: str

@app.post("/api/chat/dm", tags=["Chat"])
async def get_or_create_dm(payload: DMPayload, user=Depends(get_current_user_required)):
    """Obtem ou cria um canal DM entre o user e outro."""
    user_id = user.get("sub")
    result = chat_service.obter_ou_criar_dm(user_id, payload.other_user_id)
    if not result:
        raise HTTPException(status_code=500, detail="Erro ao criar DM")
    return result

# -----------------------------------------------------------------------------
# Endpoints do Agente AI
# -----------------------------------------------------------------------------
from services import ai_agent_service

class AIAgentMessage(BaseModel):
    mensagem: str
    historico: Optional[list] = None

@app.post("/api/ai/agent/horarios", tags=["AI Agent"])
async def ai_agent_horarios(payload: AIAgentMessage, user=Depends(get_current_user_required)):
    """
    Processa uma mensagem de linguagem natural via Agente AI (Gemini).
    Apenas acessível a coordenadores, direção e IT support.
    """
    # Validar permissões
    user_id = user.get("sub")
    perfis = profile_service.listar_perfis()
    user_profile = next((p for p in perfis if str(p.get("id")) == user_id), None)
    if not user_profile or user_profile.get("role") not in ("coordenador", "direcao", "it_support"):
        raise HTTPException(status_code=403, detail="Sem permissão para usar o agente AI.")

    # Processar mensagem
    resultado = ai_agent_service.processar_mensagem(
        mensagem=payload.mensagem,
        historico=payload.historico,
    )
    return resultado


# -----------------------------------------------------------------------------
# Endpoint do Chatbot (Assistente Virtual RNE)
# -----------------------------------------------------------------------------
from google import genai as _genai
from google.genai import types as _genai_types
import logging as _logging

_chatbot_logger = _logging.getLogger(__name__)

class ChatbotMessage(BaseModel):
    role: str  # "user" ou "assistant"
    content: str

class ChatbotRequest(BaseModel):
    messages: List[ChatbotMessage]

# Cache em memória: evita reler o ficheiro a cada request
_kb_cache: Optional[str] = None

def _get_knowledge_base() -> str:
    global _kb_cache
    if _kb_cache is not None:
        return _kb_cache
    kb_path = os.path.join(os.path.dirname(__file__), "KNOWLEDGE_BASE.md")
    if os.path.exists(kb_path):
        with open(kb_path, "r", encoding="utf-8") as f:
            _kb_cache = f.read()
    else:
        _kb_cache = ""
    return _kb_cache

def _invalidate_kb_cache():
    global _kb_cache
    _kb_cache = None

_CHATBOT_SYSTEM_PROMPT = """
Tu és o assistente virtual do RAP Nova Escola.
És um membro da equipa: próximo, tranquilo, claro e alinhado com a cultura hip-hop e com a missão social e artística do projeto.
A tua função é apoiar mentores e equipa com orientações práticas, sempre em coerência com a intenção da intervenção do RAP Nova Escola.

MISSÃO E PRIORIDADE DA INTERVENÇÃO:
• O RAP Nova Escola usa a música, a escrita e a produção como ferramentas de expressão, reflexão e crescimento pessoal.
• A prioridade do projeto é gerar impacto construtivo: artístico, humano e social.
• Em qualquer contexto, a intervenção deve ter intenção, orientação e liderança.
• O foco está no processo, na evolução e na valorização do esforço individual e coletivo.

CONSCIÊNCIA DE CONTEXTO:
• Em contexto escolar, a prioridade é pedagógica: aprendizagem, conteúdos curriculares e consolidação de competências através da criatividade.
• Em intervenções prolongadas (clubes), o foco combina três dimensões:
  • artística (expressão, escrita, performance, produção);
  • social (escuta, empatia, trabalho coletivo, superação);
  • humana (confiança, voz própria, consciência emocional).
• Em contextos de maior vulnerabilidade (prisões e centros de acolhimento), a prioridade é clara:
  • a sessão deve deixar o participante num estado melhor do que aquele em que entrou;
  • a expressão é acompanhada de orientação e responsabilidade;
  • temas sensíveis exigem condução, reflexão e consciência — nunca censura cega, nunca permissividade sem guia.

POSTURA DO ASSISTENTE:
• Comunica com calor, respeito e sentido de responsabilidade.
• Valoriza sempre a reflexão, a consciência e o crescimento.
• Nunca glorifica violência, crime ou discursos destrutivos.
• Reconhece a criatividade como ferramenta, não como fim solto.
• Fala como alguém da equipa, alinhado com os valores do projeto.

ESTILO DE COMUNICAÇÃO:
• Português de Portugal.
• Linguagem próxima, urbana e acessível (hip-hop, street), sem exageros.
• Pouco formal, clara e direta.
• Frases curtas.
• Tom humano, tranquilo e agregador.

REGRAS DE ESTILO:
1. Usa **negrito** para destacar palavras-chave, nomes de documentos ou conceitos importantes.
2. Sempre que mencionares um link ou recurso, usa formatação Markdown: [texto do link](url).
3. Mantém a resposta visualmente organizada com listas e parágrafos curtos.

FORMA DE RESPONDER:
• Prioriza respostas práticas e orientadas para a ação.
• Sempre que fizer sentido, organiza a informação em passos claros, bullet points ou listas numeradas.
• Mantém uma arquitetura visual limpa e fácil de ler.
• Vai direto ao essencial.

REGRAS IMPORTANTES:
1. Usa APENAS a informação presente na "BASE DE CONHECIMENTO".
2. Nunca inventes processos, regras, decisões ou interpretações.
3. Se a informação não existir na base de conhecimento:
    - Diz isso de forma clara e tranquila.
    - Sugere falar diretamente com o Elton (liderança do projeto).
4. Não assumes intenções nem contextos não explícitos.
5. Não dês opiniões pessoais — partilha apenas conhecimento alinhado com o projeto.
6. Mantém sempre um tom ético, humano e responsável.

EXEMPLO DE FECHO QUANDO NÃO HÁ INFO:
"Sobre isso não tenho informação documentada. O melhor é falares diretamente com o Elton para alinhar."

NO FINAL DE CADA RESPOSTA:
• Baseada na informação fornecida, podes indicar o documento onde podem encontrar esta informação.
• IMPORTANTE: Deixa dois parágrafos de espaço em branco entre a resposta e o documento de referência.

BASE DE CONHECIMENTO:
{knowledge_base}
"""

@app.post("/api/chatbot", tags=["Chatbot"])
async def chatbot(payload: ChatbotRequest, _user=Depends(get_current_user_required)):
    """Assistente virtual do RAP Nova Escola (Gemini + Knowledge Base)."""
    system_instruction = _CHATBOT_SYSTEM_PROMPT.format(knowledge_base=_get_knowledge_base())

    # Filtrar saudação inicial do assistant e construir histórico
    msgs = payload.messages
    if msgs and msgs[0].role == "assistant":
        msgs = msgs[1:]

    if not msgs:
        raise HTTPException(status_code=400, detail="Sem mensagens para processar.")

    contents = []
    for m in msgs[:-1]:
        role = "user" if m.role == "user" else "model"
        contents.append(_genai_types.Content(role=role, parts=[_genai_types.Part(text=m.content)]))

    contents.append(_genai_types.Content(role="user", parts=[_genai_types.Part(text=msgs[-1].content)]))

    try:
        client = _genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents,
            config=_genai_types.GenerateContentConfig(
                system_instruction=system_instruction,
                max_output_tokens=1000,
            ),
        )
        return {"role": "assistant", "content": response.text}
    except Exception as exc:
        _chatbot_logger.error(f"Erro Gemini no chatbot: {exc}")
        raise HTTPException(status_code=502, detail="Erro ao comunicar com o modelo AI.")


# -----------------------------------------------------------------------------
# Sync da Drive + Cron Job (Knowledge Base)
# -----------------------------------------------------------------------------
from services import drive_sync_service
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

_scheduler = BackgroundScheduler(timezone=pytz.timezone("Europe/Lisbon"))

def _scheduled_sync():
    try:
        stats = drive_sync_service.sync_knowledge_base()
        _invalidate_kb_cache()
        _chatbot_logger.info(f"Sync agendado concluído: {stats}")
    except Exception as exc:
        _chatbot_logger.error(f"Erro no sync agendado: {exc}")

_scheduler.add_job(
    _scheduled_sync,
    trigger=CronTrigger(hour=18, minute=0),
    id="drive_sync_daily",
    replace_existing=True,
)

SYNC_ROLES = {"direcao", "it_support", "coordenador"}

@app.on_event("startup")
async def start_scheduler():
    if not _scheduler.running:
        _scheduler.start()

@app.post("/api/chatbot/sync", tags=["Chatbot"])
async def chatbot_sync(user=Depends(get_current_user_required)):
    """Força uma sincronização imediata da pasta Drive → KNOWLEDGE_BASE. Apenas admins."""
    user_id = user.get("sub")
    perfis = profile_service.listar_perfis()
    user_profile = next((p for p in perfis if str(p.get("id")) == user_id), None)
    if not user_profile or user_profile.get("role") not in SYNC_ROLES:
        raise HTTPException(status_code=403, detail="Sem permissão para sincronizar a knowledge base.")

    try:
        stats = drive_sync_service.sync_knowledge_base()
        _invalidate_kb_cache()
        return stats
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro durante o sync: {exc}")


# -----------------------------------------------------------------------------
# Endpoints de Atalhos
# -----------------------------------------------------------------------------
from services import atalho_service

ATALHO_EDITOR_ROLES = {"direcao", "it_support"}

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

@app.get("/api/atalhos", tags=["Atalhos"])
async def get_atalhos(user=Depends(get_current_user_required)):
    """Lista todos os atalhos. Acessível a todos os utilizadores autenticados."""
    return atalho_service.listar_atalhos()

@app.post("/api/atalhos", tags=["Atalhos"])
async def post_atalho(payload: AtalhoCreate, user=Depends(get_current_user_required)):
    """Cria um novo atalho. Apenas direcao e it_support."""
    user_id = user.get("sub")
    role = atalho_service.get_user_role(user_id)
    if role not in ATALHO_EDITOR_ROLES:
        raise HTTPException(status_code=403, detail="Sem permissão para criar atalhos.")
    resultado = atalho_service.criar_atalho(payload.dict())
    if not resultado:
        raise HTTPException(status_code=500, detail="Erro ao criar atalho.")
    return resultado

@app.put("/api/atalhos/{atalho_id}", tags=["Atalhos"])
async def put_atalho(atalho_id: int, payload: AtalhoUpdate, user=Depends(get_current_user_required)):
    """Atualiza um atalho existente. Apenas direcao e it_support."""
    user_id = user.get("sub")
    role = atalho_service.get_user_role(user_id)
    if role not in ATALHO_EDITOR_ROLES:
        raise HTTPException(status_code=403, detail="Sem permissão para editar atalhos.")
    resultado = atalho_service.atualizar_atalho(atalho_id, payload.dict())
    if not resultado:
        raise HTTPException(status_code=404, detail="Atalho não encontrado.")
    return resultado

@app.delete("/api/atalhos/{atalho_id}", tags=["Atalhos"])
async def delete_atalho(atalho_id: int, user=Depends(get_current_user_required)):
    """Apaga um atalho. Apenas direcao e it_support."""
    user_id = user.get("sub")
    role = atalho_service.get_user_role(user_id)
    if role not in ATALHO_EDITOR_ROLES:
        raise HTTPException(status_code=403, detail="Sem permissão para apagar atalhos.")
    sucesso = atalho_service.apagar_atalho(atalho_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Atalho não encontrado.")
    return {"ok": True}

# -----------------------------------------------------------------------------
# TAREFAS INTERNAS
# -----------------------------------------------------------------------------
from services import tarefas_service

COORD_ROLES_TAREFAS = {"coordenador", "direcao", "it_support"}

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

@app.get("/api/tarefas", tags=["Tarefas"])
async def get_tarefas(user=Depends(get_current_user_required)):
    """Lista tarefas do user autenticado (+ gerais). Coordenadores vêem todas."""
    user_id = user.get("sub")
    role = user.get("user_metadata", {}).get("role", "")
    if role in COORD_ROLES_TAREFAS:
        return tarefas_service.listar_todas_tarefas()
    return tarefas_service.listar_tarefas_para_user(user_id)

@app.post("/api/tarefas", tags=["Tarefas"])
async def post_tarefa(payload: TarefaCreate, user=Depends(get_current_user_required)):
    """Cria uma tarefa. Apenas coordenadores e superiores."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES_TAREFAS:
        raise HTTPException(status_code=403, detail="Acesso negado")
    user_id = user.get("sub")
    res = tarefas_service.criar_tarefa(
        payload.titulo, user_id, payload.descricao,
        payload.prioridade, payload.data_limite, payload.user_ids or []
    )
    if not res:
        raise HTTPException(status_code=500, detail="Erro ao criar tarefa")
    return res

@app.put("/api/tarefas/{id}", tags=["Tarefas"])
async def put_tarefa(id: int, payload: TarefaUpdate, user=Depends(get_current_user_required)):
    """Atualiza uma tarefa."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES_TAREFAS:
        raise HTTPException(status_code=403, detail="Acesso negado")
    ok = tarefas_service.atualizar_tarefa(
        id, payload.titulo, payload.descricao,
        payload.prioridade, payload.data_limite, payload.user_ids
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Erro ao atualizar tarefa")
    return {"ok": True}

@app.delete("/api/tarefas/{id}", tags=["Tarefas"])
async def delete_tarefa(id: int, user=Depends(get_current_user_required)):
    """Apaga uma tarefa."""
    if user.get("user_metadata", {}).get("role") not in COORD_ROLES_TAREFAS:
        raise HTTPException(status_code=403, detail="Acesso negado")
    ok = tarefas_service.apagar_tarefa(id)
    if not ok:
        raise HTTPException(status_code=500, detail="Erro ao apagar tarefa")
    return {"ok": True}

@app.patch("/api/tarefas/{id}/estado", tags=["Tarefas"])
async def patch_tarefa_estado(id: int, payload: TarefaEstado, user=Depends(get_current_user_required)):
    """User marca o seu estado numa tarefa (pendente → em_progresso → concluida)."""
    if payload.estado not in ('pendente', 'em_progresso', 'concluida'):
        raise HTTPException(status_code=400, detail="Estado inválido")
    user_id = user.get("sub")
    ok = tarefas_service.marcar_estado_tarefa(id, user_id, payload.estado)
    if not ok:
        raise HTTPException(status_code=404, detail="Atribuição não encontrada")
    return {"ok": True}

# --- Shutdown gracioso do pool de conexões ---
from database.connection import close_pool

@app.on_event("shutdown")
async def shutdown_event():
    close_pool()
    if _scheduler.running:
        _scheduler.shutdown(wait=False)

# 3. PONTO DE ENTRADA PARA ARRANCAR O SERVIDOR
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    """
    Este bloco será executado quando o script for chamado diretamente.
    Ele arranca o servidor Uvicorn, que por sua vez corre a nossa aplicação FastAPI.
    
    - `host="0.0.0.0"`: Faz o servidor ser acessível na rede local.
    - `port=8000`: A porta onde a API estará a ouvir.
    - `reload=True`: O servidor reiniciará automaticamente sempre que houver
      uma alteração no código, o que é muito útil durante o desenvolvimento.
    """
    import logging
    logging.basicConfig(level=logging.INFO)
    logging.getLogger(__name__).info("A arrancar a API do RAP Nova Escola em http://localhost:8000")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

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
from typing import Optional
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
    allow_origin_regex=r"(https://app-rap-novaescola.*\.vercel\.app|https://.*\.rapnovaescola\.pt|http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):\d+)",
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
async def get_estudio_reservas():
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
    notas: str = None
    criado_por_id: str = None

@app.post("/api/estudio/reservas", tags=["Estudio"])
async def create_estudio_reserva(reserva: ReservaCreate):
    """Cria uma nova reserva de estúdio."""
    resultado = estudio_service.criar_reserva(reserva.dict())
    if not resultado:
        raise HTTPException(status_code=500, detail="Erro ao criar reserva")
    return resultado
@app.delete("/api/estudio/reservas/{reserva_id}", tags=["Estudio"])
async def delete_estudio_reserva(reserva_id: int):
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
async def get_todas_aulas():
    """
    Endpoint para listar todas as aulas existentes.
    Chama o serviço correspondente e retorna os dados.
    """
    try:
        aulas = aula_service.listar_todas_aulas()
        return aulas
    except Exception as e:
        # Em produção, seria melhor ter um tratamento de erros mais robusto
        return {"error": str(e)}

@app.get("/api/aulas/proximo-numero", tags=["Aulas"])
async def get_proximo_numero_sessao(
    atividade_uuid: Optional[str] = None,
    turma_id: Optional[int] = None,
    projeto_id: Optional[int] = None,
    is_autonomous: bool = False,
    responsavel_user_id: Optional[str] = None,
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
    """Sessões confirmadas/realizadas do user ainda sem registo."""
    user_id = user.get("sub")
    return registo_service.listar_sessoes_registaveis(user_id)

@app.get("/api/aulas/{aula_id}", tags=["Aulas"])
async def get_aula_by_id(aula_id: int):
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

@app.post("/api/aulas", tags=["Aulas"])
async def create_aula(aula: AulaCreate):
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
        objetivos=None,
        projeto_id=aula.projeto_id,
        observacoes=aula.observacoes,
        atividade_id=aula.atividade_id,
        atividade_uuid=aula.atividade_uuid,
        is_autonomous=aula.is_autonomous,
        is_realized=aula.is_realized,
        tipo_atividade=aula.tipo_atividade,
        responsavel_user_id=aula.responsavel_user_id,
        musica_id=aula.musica_id,
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
    atividade_id: Optional[int] = None
    atividade_uuid: Optional[str] = None
    is_autonomous: bool = True
    tipo: str = "trabalho_autonomo"


@app.post("/api/aulas/recorrentes", tags=["Aulas"])
async def create_aulas_recorrentes(payload: AulaRecorrenteCreate):
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
            atividade_id=payload.atividade_id,
            atividade_uuid=payload.atividade_uuid,
            is_autonomous=payload.is_autonomous,
            tipo=payload.tipo,
        )
        return {"criadas": len(resultados), "sessoes": resultados}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/aulas/{aula_id}", tags=["Aulas"])
async def update_aula(aula_id: int, aula: AulaUpdate):
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
async def delete_aula(aula_id: int):
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
    from services import profile_service
    user_id = user.get("sub")
    # Check if user is coordinator
    perfis = profile_service.listar_perfis()
    user_profile = next((p for p in perfis if p.get("id") == user_id), None)
    if user_profile and user_profile.get("role") in ("coordenador", "direcao", "it_support"):
        return True
    # For regular sessions: check if user is the assigned mentor
    if not aula_info.get("is_autonomous"):
        if aula_info.get("mentor_user_id") == user_id:
            return True
    # For autonomous sessions: check if user is the responsavel
    else:
        if aula_info.get("responsavel_user_id") == user_id:
            return True
    return False

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
        # Se for erro de auth, já foi tratado pelo Depends
        print(f"Erro ao listar notificações: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/notifications/{id}/read", tags=["Notifications"])
async def mark_notification_read(id: int):
    """
    Marca notificação como lida.
    """
    try:
        sucesso = notification_service.marcar_como_lida(id)
        if sucesso:
            return {"message": "Notificação marcada como lida"}
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/notifications/{id}", tags=["Notifications"])
async def delete_notification(id: int):
    """
    Apaga notificação.
    """
    try:
        sucesso = notification_service.apagar_notificacao(id)
        if sucesso:
            return {"message": "Notificação apagada"}
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/notifications", tags=["Notifications"])
async def delete_all_notifications(user=Depends(get_current_user_required)):
    """Apaga todas as notificações do user autenticado."""
    uid = user.get("sub")
    count = notification_service.apagar_todas_notificacoes(uid)
    return {"message": f"{count} notificações apagadas"}

# --- Rotas para Projetos ---
from services import projeto_service

class ProjetoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None

class ProjetoEstabAssoc(BaseModel):
    estabelecimento_id: int

@app.get("/api/projetos", tags=["Projetos"])
async def get_projetos():
    """Lista todos os projetos."""
    return projeto_service.listar_projetos()

@app.post("/api/projetos", tags=["Projetos"])
async def create_projeto(data: ProjetoCreate):
    """Cria um novo projeto."""
    res = projeto_service.criar_projeto(data.nome, data.descricao)
    if not res:
        raise HTTPException(status_code=400, detail="Falha ao criar projeto")
    return res

@app.put("/api/projetos/{id}", tags=["Projetos"])
async def update_projeto(id: int, data: ProjetoCreate):
    """Atualiza um projeto."""
    sucesso = projeto_service.atualizar_projeto(id, data.nome, data.descricao)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar projeto")
    return {"message": "Projeto atualizado"}

@app.delete("/api/projetos/{id}", tags=["Projetos"])
async def delete_projeto(id: int):
    """Apaga um projeto."""
    sucesso = projeto_service.apagar_projeto(id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return {"message": "Projeto apagado"}

@app.get("/api/projetos/{id}/estabelecimentos", tags=["Projetos"])
async def get_projeto_estabelecimentos(id: int):
    """Lista estabelecimentos de um projeto."""
    return projeto_service.listar_estabelecimentos_por_projeto(id)

@app.post("/api/projetos/{id}/estabelecimentos", tags=["Projetos"])
async def add_projeto_estabelecimento(id: int, data: ProjetoEstabAssoc):
    """Associa um estabelecimento a um projeto."""
    sucesso = projeto_service.associar_estabelecimento(id, data.estabelecimento_id)
    if not sucesso:
        raise HTTPException(status_code=400, detail="Falha ao associar estabelecimento")
    return {"message": "Estabelecimento associado"}

@app.delete("/api/projetos/{id}/estabelecimentos/{estab_id}", tags=["Projetos"])
async def remove_projeto_estabelecimento(id: int, estab_id: int):
    """Remove associação entre projeto e estabelecimento."""
    sucesso = projeto_service.desassociar_estabelecimento(id, estab_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Associação não encontrada")
    return {"message": "Estabelecimento desassociado"}

# --- Rotas para Turmas/Estabelecimentos ---
from services import turma_service, profile_service, estudio_service, notification_service, registo_service, aluno_service

@app.get("/api/equipa", tags=["Core"])
async def get_equipa():
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
async def get_categorias_equipamento():
    """Lista categorias de equipamento com os seus itens."""
    return equipment_service.listar_categorias()

@app.get("/api/aulas/{aula_id}/equipamento", tags=["Equipamento"])
async def get_equipamento_sessao(aula_id: int):
    """Lista itens de equipamento atribuídos a uma sessão."""
    return equipment_service.listar_equipamento_sessao(aula_id)

class EquipamentoAtribuir(BaseModel):
    item_ids: list[int]

@app.put("/api/aulas/{aula_id}/equipamento", tags=["Equipamento"])
async def put_equipamento_sessao(aula_id: int, payload: EquipamentoAtribuir):
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
async def verificar_conflitos_equipamento(payload: ConflitosVerificar):
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
):
    """Lista todos os itens individuais de equipamento (localizacao/responsavel derivados de sessoes)."""
    return equipment_service.listar_itens(categoria_id, estado)

@app.get("/api/equipamento/stats", tags=["Equipamento"])
async def get_equipamento_stats():
    """Estatisticas globais de equipamento."""
    return equipment_service.obter_stats()

class ItemCreate(BaseModel):
    categoria_id: int
    nome: str
    identificador: str
    estado: str = 'excelente'
    observacoes: Optional[str] = None

@app.post("/api/equipamento/itens", tags=["Equipamento"])
async def post_equipamento_item(item: ItemCreate):
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
async def put_equipamento_item(item_id: int, item: ItemUpdate):
    """Atualiza um item de equipamento."""
    dados = {k: v for k, v in item.dict().items() if v is not None}
    sucesso = equipment_service.atualizar_item(item_id, dados)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Item nao encontrado ou erro ao atualizar")
    return {"message": "Item atualizado"}

@app.delete("/api/equipamento/itens/{item_id}", tags=["Equipamento"])
async def delete_equipamento_item(item_id: int):
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
async def post_utilizacao(item_id: int, payload: UtilizacaoCreate):
    """Regista utilizacao de um item."""
    sucesso = equipment_service.registar_utilizacao(
        item_id, payload.user_id, payload.user_nome, payload.aula_id, payload.observacoes
    )
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao registar utilizacao")
    return {"message": "Utilizacao registada"}

@app.get("/api/equipamento/itens/{item_id}/historico", tags=["Equipamento"])
async def get_historico_item(item_id: int):
    """Lista historico de utilizacao de um item."""
    return equipment_service.listar_historico(item_id)

@app.get("/api/equipamento/itens/{item_id}/ocupacoes", tags=["Equipamento"])
async def get_ocupacoes_item(item_id: int):
    """Lista sessoes futuras que usam este item."""
    return equipment_service.listar_ocupacoes_item(item_id)



@app.get("/api/estabelecimentos", tags=["Core"])
async def get_estabelecimentos():
    """Lista estabelecimentos."""
    return turma_service.listar_estabelecimentos()

class EstabelecimentoCreate(BaseModel):
    nome: str

@app.post("/api/estabelecimentos", tags=["Core"])
async def create_estabelecimento(inst: EstabelecimentoCreate):
    """Cria um novo estabelecimento."""
    res = turma_service.criar_estabelecimento(inst.nome)
    if res:
        return res
    raise HTTPException(status_code=400, detail="Falha ao criar estabelecimento (pode já existir)")

class TurmaCreate(BaseModel):
    nome: str
    estabelecimento_id: str

@app.post("/api/turmas", tags=["Core"])
async def create_turma(turma: TurmaCreate):
    """Cria uma nova turma."""
    res = turma_service.criar_turma(turma.nome, turma.estabelecimento_id)
    if res:
        return res
    raise HTTPException(status_code=400, detail="Falha ao criar turma (pode já existir)")

@app.get("/api/turmas", tags=["Core"])
async def get_turmas(estabelecimento_id: Optional[int] = None):
    """Lista todas as turmas com estabelecimentos. Opcionalmente filtra por estabelecimento_id."""
    return turma_service.listar_turmas_com_estabelecimento(estabelecimento_id)

@app.put("/api/turmas/{id}", tags=["Core"])
async def update_turma(id: int, turma: TurmaCreate):
    """Atualiza uma turma."""
    sucesso = turma_service.atualizar_turma(id, turma.nome, turma.estabelecimento_id)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar turma")
    return {"message": "Turma atualizada"}

@app.delete("/api/turmas/{id}", tags=["Core"])
async def delete_turma(id: int):
    """Apaga uma turma."""
    sucesso = turma_service.apagar_turma(id)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao apagar turma")
    return {"message": "Turma apagada"}

class AlunosUpdate(BaseModel):
    nomes: list[str]

@app.get("/api/turmas/{turma_id}/alunos", tags=["Core"])
async def get_alunos_turma(turma_id: int):
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
async def get_turma_disciplinas(turma_id: int):
    """Lista as disciplinas locais de uma turma."""
    return turma_service.listar_disciplinas_turma(turma_id)
    return {"message": "Disciplinas atualizadas"}

@app.get("/api/mentores", tags=["Core"])
async def get_mentores():
    """Lista todos os mentores para dropdown."""
    return turma_service.listar_mentores()

@app.get("/api/produtores", tags=["Core"])
async def get_produtores():
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
    disciplina: str = None
    projeto_id: Optional[int] = None

@app.post("/api/musicas", tags=["Producao"])
async def create_musica(musica: MusicaCreate, user=Depends(get_current_user_required)):
    """Cria uma nova música."""
    criador_id = user.get("sub")
    resultado = musica_service.criar_musica(musica.dict(), criador_id)
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
    user_profile = next((p for p in perfis if p.get("id") == user_id), None)
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

@app.patch("/api/musicas/{musica_id}", tags=["Producao"])
async def update_musica_detalhes(musica_id: int, payload: dict, user=Depends(get_current_user_required)):
    """Atualiza detalhes editáveis de uma música (deadline, notas, link_demo, titulo)."""
    sucesso = musica_service.atualizar_detalhes(musica_id, payload)
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
async def geocode_search(q: str):
    """Proxy para Nominatim — pesquisa de moradas (Portugal)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": q, "format": "json", "limit": 5, "countrycodes": "pt"},
            headers={"User-Agent": "RAPNovaEscola/1.0 (rap-nova-escola@edu.pt)"},
        )
        return resp.json()

@app.get("/api/distance", tags=["Geocoding"])
async def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float):
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
async def update_mentor_location(mentor_id: int, payload: MentorLocationUpdate):
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
    sigla: str = None
    morada: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

@app.get("/api/estabelecimentos", tags=["Wiki"])
async def get_estabelecimentos():
    return turma_service.listar_estabelecimentos()

@app.post("/api/estabelecimentos", tags=["Wiki"])
async def create_estabelecimento(inst: EstabelecimentoWikiCreate):
    res = turma_service.criar_estabelecimento(inst.nome, inst.sigla, inst.morada, inst.latitude, inst.longitude)
    if not res:
        raise HTTPException(status_code=400, detail="Erro ao criar. Possível duplicado.")
    return res

@app.put("/api/estabelecimentos/{id}", tags=["Wiki"])
async def update_estabelecimento(id: int, inst: EstabelecimentoWikiCreate):
    sucesso = turma_service.atualizar_estabelecimento(id, inst.nome, inst.sigla, inst.morada, inst.latitude, inst.longitude)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar.")
    return {"message": "Atualizado com sucesso"}

@app.delete("/api/estabelecimentos/{id}", tags=["Wiki"])
async def delete_estabelecimento(id: int):
    sucesso = turma_service.apagar_estabelecimento(id)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao apagar.")
    return {"message": "Apagado com sucesso"}

# -----------------------------------------------------------------------------
# Endpoints de Currículo (Wiki)
# -----------------------------------------------------------------------------
from services import curriculo_service
from services import wiki_service

# --- Legacy: currículo global (mantido para compatibilidade) ---
@app.get("/api/curriculo", tags=["Wiki"])
async def get_curriculo():
    """Lista todo o currículo global (disciplinas e atividades)."""
    return curriculo_service.listar_curriculo()

# --- Wiki v2: disciplinas e atividades locais por turma ---

@app.get("/api/wiki/projeto/{projeto_id}", tags=["Wiki"])
async def get_wiki_hierarquia(projeto_id: int):
    """Hierarquia completa: Projeto > Estabelecimentos > Turmas > Disciplinas > Atividades."""
    result = wiki_service.listar_hierarquia_projeto(projeto_id)
    print(f"[DEBUG wiki] projeto_id={projeto_id} → {len(result)} estabelecimentos")
    return result

@app.get("/api/wiki/debug/{projeto_id}", tags=["Wiki"])
async def debug_wiki(projeto_id: int):
    """Debug: mostra o que a DB retorna passo a passo."""
    from database.connection import get_db_connection
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT e.id, e.nome FROM estabelecimentos e JOIN projeto_estabelecimentos pe ON pe.estabelecimento_id = e.id WHERE pe.projeto_id = %s", (projeto_id,))
        estabs = cur.fetchall()
        cur.execute("SELECT COUNT(*) FROM turma_disciplinas")
        td_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM turma_atividades")
        ta_count = cur.fetchone()[0]
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='turmas' ORDER BY column_name")
        turma_cols = [r[0] for r in cur.fetchall()]
        return {
            "estabelecimentos_no_projeto": [{"id": e[0], "nome": e[1]} for e in estabs],
            "turma_disciplinas_count": td_count,
            "turma_atividades_count": ta_count,
            "turmas_columns": turma_cols,
        }
    except Exception as e:
        return {"error": str(e)}
    finally:
        cur.close()
        conn.close()

@app.get("/api/wiki/turma/{turma_id}/disciplinas", tags=["Wiki"])
async def get_wiki_turma_disciplinas(turma_id: int):
    """Lista disciplinas locais de uma turma com atividades."""
    return wiki_service.listar_disciplinas_turma(turma_id)

class TurmaDisciplinaCreate(BaseModel):
    nome: str
    descricao: str = None
    musicas_previstas: int = 0
    atividades: list = []

@app.post("/api/wiki/turma/{turma_id}/disciplinas", tags=["Wiki"])
async def create_wiki_disciplina(turma_id: int, payload: TurmaDisciplinaCreate):
    """Cria disciplina local com atividades em batch."""
    result = wiki_service.criar_disciplina_turma(
        turma_id, payload.nome, payload.descricao,
        payload.musicas_previstas, payload.atividades
    )
    if not result:
        raise HTTPException(status_code=500, detail="Erro ao criar disciplina")
    return result

class TurmaDisciplinaUpdate(BaseModel):
    nome: str
    descricao: str = None
    musicas_previstas: int = 0

@app.put("/api/wiki/disciplinas/{td_id}", tags=["Wiki"])
async def update_wiki_disciplina(td_id: int, payload: TurmaDisciplinaUpdate):
    """Atualiza uma disciplina local."""
    sucesso = wiki_service.atualizar_disciplina_turma(td_id, payload.nome, payload.descricao, payload.musicas_previstas)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar disciplina")
    return {"id": td_id, "nome": payload.nome}

@app.delete("/api/wiki/disciplinas/{td_id}", tags=["Wiki"])
async def delete_wiki_disciplina(td_id: int):
    """Remove disciplina local (cascade apaga atividades)."""
    sucesso = wiki_service.apagar_disciplina_turma(td_id)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao apagar disciplina")
    return {"message": "Disciplina apagada"}

class TurmaAtividadeCreate(BaseModel):
    turma_disciplina_id: int
    nome: str
    codigo: str = None
    sessoes_previstas: int = 0
    horas_por_sessao: float = 0
    musicas_previstas: int = 0
    perfil_mentor: str = None
    is_autonomous: bool = False

@app.post("/api/wiki/atividades", tags=["Wiki"])
async def create_wiki_atividade(payload: TurmaAtividadeCreate):
    """Cria uma atividade local."""
    result = wiki_service.criar_atividade(
        payload.turma_disciplina_id, payload.nome, payload.codigo,
        payload.sessoes_previstas, payload.horas_por_sessao,
        payload.musicas_previstas, payload.perfil_mentor, payload.is_autonomous
    )
    if not result:
        raise HTTPException(status_code=500, detail="Erro ao criar atividade")
    return result

class TurmaAtividadeUpdate(BaseModel):
    nome: str
    codigo: str = None
    sessoes_previstas: int = 0
    horas_por_sessao: float = 0
    musicas_previstas: int = 0
    perfil_mentor: str = None
    is_autonomous: bool = False

@app.put("/api/wiki/atividades/{uuid}", tags=["Wiki"])
async def update_wiki_atividade(uuid: str, payload: TurmaAtividadeUpdate):
    """Atualiza uma atividade local por UUID."""
    sucesso = wiki_service.atualizar_atividade(uuid, payload.dict())
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar atividade")
    return {"uuid": uuid, "nome": payload.nome}

@app.delete("/api/wiki/atividades/{uuid}", tags=["Wiki"])
async def delete_wiki_atividade(uuid: str):
    """Remove uma atividade local por UUID."""
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
    user_profile = next((p for p in perfis if p.get("id") == user_id), None)
    if not user_profile or user_profile.get("role") not in ("coordenador", "direcao", "it_support"):
        raise HTTPException(status_code=403, detail="Sem permissão para usar o agente AI.")

    # Processar mensagem
    resultado = ai_agent_service.processar_mensagem(
        mensagem=payload.mensagem,
        historico=payload.historico,
    )
    return resultado


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
    print("A arrancar a API do RAP Nova Escola em http://localhost:8000")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

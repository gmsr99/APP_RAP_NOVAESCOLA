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

# Definir as origens que podem fazer pedidos à nossa API
# Durante o desenvolvimento, o servidor do React (Vite) corre em localhost:5173
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]

# Adicionar o middleware de CORS à aplicação
# Isto é crucial para que o frontend possa comunicar com o backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
from typing import Optional
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
        observacoes=aula.observacoes,
        atividade_id=aula.atividade_id,
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
    tipo_atividade: str
    responsavel_user_id: str
    observacoes: Optional[str] = None
    semanas: int = 4


@app.post("/api/aulas/recorrentes", tags=["Aulas"])
async def create_aulas_recorrentes(payload: AulaRecorrenteCreate):
    """
    Cria N sessões de trabalho autónomo com recorrência semanal.
    """
    try:
        resultados = aula_service.criar_aulas_recorrentes(
            data_hora=payload.data_hora,
            duracao_minutos=payload.duracao_minutos,
            tipo_atividade=payload.tipo_atividade,
            responsavel_user_id=payload.responsavel_user_id,
            observacoes=payload.observacoes,
            semanas=payload.semanas,
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

@app.post("/api/aulas/{aula_id}/confirm", tags=["Aulas"])
async def confirm_aula(aula_id: int):
    """
    Confirma uma aula (status -> 'confirmada').
    """
    try:
        sucesso = aula_service.mudar_estado_aula(aula_id, "confirmada")
        if sucesso:
            return {"message": "Aula confirmada com sucesso"}
        raise HTTPException(status_code=400, detail="Erro ao confirmar aula")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/aulas/{aula_id}/reject", tags=["Aulas"])
async def reject_aula(aula_id: int):
    """
    Recusa uma aula (status -> 'recusada').
    """
    try:
        sucesso = aula_service.mudar_estado_aula(aula_id, "recusada")
        if sucesso:
            return {"message": "Aula recusada com sucesso"}
        raise HTTPException(status_code=400, detail="Erro ao recusar aula")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TerminarPayload(BaseModel):
    avaliacao: int = Field(ge=1, le=5)
    obs_termino: Optional[str] = None

@app.post("/api/aulas/{aula_id}/terminar", tags=["Aulas"])
async def terminar_aula(aula_id: int, payload: TerminarPayload, user=Depends(get_current_user_required)):
    """Marca sessão como terminada com avaliação (1-5) e observações."""
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

# --- Rotas para Turmas/Estabelecimentos ---
from services import turma_service, profile_service, estudio_service, notification_service, registo_service, aluno_service

@app.get("/api/equipa", tags=["Core"])
async def get_equipa():
    """Lista todos os membros da equipa (perfis públicos)."""
    return profile_service.listar_perfis()


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
    return {"conflitos": conflitos, "tem_conflitos": len(conflitos) > 0}




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
async def get_turmas():
    """Lista todas as turmas com estabelecimentos."""
    return turma_service.listar_turmas_com_estabelecimento()

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
async def get_musicas(arquivadas: bool = False, user=Depends(get_current_user_optional)):
    """Lista todas as músicas (ativas ou arquivadas)."""
    user_id = user.get("sub") if user else None
    role = (user.get("user_metadata") or {}).get("role") if user else None
    return musica_service.listar_musicas(arquivadas, user_id, role)

class MusicaCreate(BaseModel):
    titulo: str
    turma_id: int
    disciplina: str = None

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
# 10. CURRÍCULO (Competências e Avaliações)
# -----------------------------------------------------------------------------
class EstabelecimentoWikiCreate(BaseModel):
    nome: str
    sigla: str = None

@app.get("/api/estabelecimentos", tags=["Wiki"])
async def get_estabelecimentos():
    return turma_service.listar_estabelecimentos()

@app.post("/api/estabelecimentos", tags=["Wiki"])
async def create_estabelecimento(inst: EstabelecimentoWikiCreate):
    res = turma_service.criar_estabelecimento(inst.nome, inst.sigla)
    if not res:
        raise HTTPException(status_code=400, detail="Erro ao criar. Possível duplicado.")
    return res

@app.put("/api/estabelecimentos/{id}", tags=["Wiki"])
async def update_estabelecimento(id: int, inst: EstabelecimentoWikiCreate):
    sucesso = turma_service.atualizar_estabelecimento(id, inst.nome, inst.sigla)
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

@app.get("/api/curriculo", tags=["Wiki"])
async def get_curriculo():
    """Lista todo o currículo (disciplinas e atividades)."""
    return curriculo_service.listar_curriculo()

class DisciplinaCreate(BaseModel):
    nome: str
    descricao: str = None

@app.post("/api/disciplinas", tags=["Wiki"])
async def create_disciplina(disc: DisciplinaCreate):
    """Cria uma nova disciplina."""
    id = curriculo_service.adicionar_disciplina(disc.nome, disc.descricao)
    if not id:
        raise HTTPException(status_code=500, detail="Erro ao criar disciplina")
    return {"id": id, "nome": disc.nome}

class AtividadeCreate(BaseModel):
    disciplina_id: int
    codigo: str
    nome: str
    sessoes_padrao: int = None
    horas_padrao: int = None
    producoes_esperadas: int = 0
    perfil_mentor: str = None

@app.post("/api/atividades", tags=["Wiki"])
async def create_atividade(act: AtividadeCreate):
    """Cria uma nova atividade."""
    id = curriculo_service.adicionar_atividade(
        act.disciplina_id, act.codigo, act.nome, 
        act.sessoes_padrao, act.horas_padrao, 
        act.producoes_esperadas, act.perfil_mentor
    )
    if not id:
        raise HTTPException(status_code=500, detail="Erro ao criar atividade")
    return {"id": id}

@app.put("/api/atividades/{id}", tags=["Wiki"])
async def update_atividade(id: int, act: AtividadeCreate):
    """Atualiza uma atividade existente."""
    sucesso = curriculo_service.atualizar_atividade(id, act.dict())
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar atividade")
    return {"message": "Atividade atualizada"}

@app.delete("/api/atividades/{id}", tags=["Wiki"])
async def delete_atividade(id: int):
    """Remove uma atividade."""
    sucesso = curriculo_service.apagar_atividade(id)
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

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
from pydantic import BaseModel
import os

# Carregar variáveis de ambiente
load_dotenv()

# Importações dos nossos módulos de serviço
from services import aula_service
from auth import get_current_user_optional

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
# Endpoints de Equipa (Cross-functional)
# -----------------------------------------------------------------------------

@app.get("/api/equipa", tags=["Core"])
async def get_equipa():
    """Lista toda a equipa (Mentores, Produtores, Coordenadores)."""
    return estudio_service.listar_equipa()

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

class AulaCreate(BaseModel):
    turma_id: int
    data_hora: str  # YYYY-MM-DD HH:MM
    duracao_minutos: int = 90
    mentor_id: Optional[int] = None
    local: Optional[str] = None
    tema: Optional[str] = None
    observacoes: Optional[str] = None
    tipo: str = "pratica_escrita"

@app.post("/api/aulas", tags=["Aulas"])
async def create_aula(aula: AulaCreate):
    """
    Cria uma nova aula via API.
    """
    try:
        nova_aula = aula_service.criar_aula(
            turma_id=aula.turma_id,
            data_hora=aula.data_hora,
            tipo=aula.tipo,
            duracao_minutos=aula.duracao_minutos,
            mentor_id=aula.mentor_id,
            local=aula.local,
            tema=aula.tema,
            observacoes=aula.observacoes
        )
        if nova_aula:
            return nova_aula
        return {"error": "Falha ao criar aula"}
    except Exception as e:
        return {"error": str(e)}

# --- Rotas para Turmas/Instituições ---
from services import turma_service, profile_service, estudio_service

@app.get("/api/equipa", tags=["Core"])
async def get_equipa():
    """Lista todos os membros da equipa (perfis públicos)."""
    return profile_service.listar_perfis()


# --- Rotas para Equipamento ---
from services import equipment_service

@app.get("/api/equipamento", tags=["Core"])
async def get_equipamento():
    """Lista todo o equipamento."""
    return equipment_service.listar_equipamento()




@app.get("/api/instituicoes", tags=["Core"])
async def get_instituicoes():
    """Lista instituições."""
    return turma_service.listar_instituicoes()

class InstituicaoCreate(BaseModel):
    nome: str

@app.post("/api/instituicoes", tags=["Core"])
async def create_instituicao(inst: InstituicaoCreate):
    """Cria uma nova instituição."""
    res = turma_service.criar_instituicao(inst.nome)
    if res:
        return res
    raise HTTPException(status_code=400, detail="Falha ao criar instituição (pode já existir)")

class TurmaCreate(BaseModel):
    nome: str
    instituicao_id: str

@app.post("/api/turmas", tags=["Core"])
async def create_turma(turma: TurmaCreate):
    """Cria uma nova turma."""
    res = turma_service.criar_turma(turma.nome, turma.instituicao_id)
    if res:
        return res
    raise HTTPException(status_code=400, detail="Falha ao criar turma (pode já existir)")

@app.get("/api/turmas", tags=["Core"])
async def get_turmas():
    """Lista todas as turmas com instituições."""
    return turma_service.listar_turmas_com_instituicao()

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
async def get_musicas(arquivadas: bool = False):
    """Lista todas as músicas (ativas ou arquivadas)."""
    return musica_service.listar_musicas(arquivadas)

class MusicaCreate(BaseModel):
    titulo: str
    turma_id: int
    disciplina: str = None

@app.post("/api/musicas", tags=["Producao"])
async def create_musica(musica: MusicaCreate):
    """Cria uma nova música."""
    resultado = musica_service.criar_musica(musica.dict())
    if not resultado:
        raise HTTPException(status_code=500, detail="Erro ao criar música")
    return resultado

class MusicaEstadoUpdate(BaseModel):
    estado: str

@app.patch("/api/musicas/{musica_id}/estado", tags=["Producao"])
async def update_musica_estado(musica_id: int, update: MusicaEstadoUpdate):
    """Atualiza o estado de uma música."""
    sucesso, mensagem = musica_service.atualizar_estado(musica_id, update.estado)
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

@app.patch("/api/musicas/{musica_id}/desarquivar", tags=["Producao"])
async def desarquivar_musica(musica_id: int):
    """Desarquiva uma música."""
    sucesso, mensagem = musica_service.desarquivar_musica(musica_id)
    if not sucesso:
        raise HTTPException(status_code=400, detail=mensagem)
    return {"message": mensagem}


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

import os
import logging as _logging
import pytz
from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from google import genai as _genai
from google.genai import types as _genai_types
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import ai_agent_service, drive_sync_service

router = APIRouter()

_chatbot_logger = _logging.getLogger(__name__)

# Scheduler para sync periódico da Drive
_scheduler = BackgroundScheduler(timezone=pytz.timezone("Europe/Lisbon"))

# Cache em memória: evita reler o ficheiro a cada request
_kb_cache: Optional[str] = None


def _get_knowledge_base() -> str:
    global _kb_cache
    if _kb_cache is not None:
        return _kb_cache
    kb_path = os.path.join(os.path.dirname(__file__), "..", "..", "KNOWLEDGE_BASE.md")
    if os.path.exists(kb_path):
        with open(kb_path, "r", encoding="utf-8") as f:
            _kb_cache = f.read()
    else:
        _kb_cache = ""
    return _kb_cache


def _invalidate_kb_cache():
    global _kb_cache
    _kb_cache = None


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


class AIAgentMessage(BaseModel):
    mensagem: str
    historico: Optional[list] = None


class ChatbotMessage(BaseModel):
    role: str  # "user" ou "assistant"
    content: str


class ChatbotRequest(BaseModel):
    messages: List[ChatbotMessage]


@router.post("/api/ai/agent/horarios", tags=["AI Agent"])
async def ai_agent_horarios(payload: AIAgentMessage, user=Depends(get_current_user_required)):
    """
    Processa uma mensagem de linguagem natural via Agente AI (Gemini).
    Apenas acessível a coordenadores, direção e IT support.
    """
    _require_coordenacao(user)

    # Processar mensagem
    resultado = ai_agent_service.processar_mensagem(
        mensagem=payload.mensagem,
        historico=payload.historico,
    )
    return resultado


@router.post("/api/chatbot", tags=["Chatbot"])
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


@router.post("/api/chatbot/sync", tags=["Chatbot"])
async def chatbot_sync(user=Depends(get_current_user_required)):
    """Força uma sincronização imediata da pasta Drive → KNOWLEDGE_BASE. Apenas admins."""
    _require_coordenacao(user)

    try:
        stats = drive_sync_service.sync_knowledge_base()
        _invalidate_kb_cache()
        return stats
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro durante o sync: {exc}")

"""
==============================================================================
RAP NOVA ESCOLA — Serviço do Agente AI (Gemini)
==============================================================================
Integra o modelo Gemini com Function Calling para gerir sessões de trabalho
via linguagem natural.

Autor: Equipa RAP Nova Escola
==============================================================================
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Configuração do Gemini
# ---------------------------------------------------------------------------

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

SYSTEM_PROMPT = f"""Tu és o Assistente de Agendamento da RAP Nova Escola.
O teu papel é ajudar coordenadores a gerir sessões de trabalho (aulas, trabalhos autónomos, eventos).

Data e hora atuais: {{current_datetime}}

Regras:
1. Responde SEMPRE em Português de Portugal.
2. Antes de APAGAR uma sessão, pede confirmação ao utilizador.
3. Quando crias uma sessão, confirma os detalhes ao utilizador na resposta.
4. Se não tiveres informação suficiente para executar uma ação, pergunta ao utilizador.
5. Usa as ferramentas disponíveis para consultar dados reais do sistema.
6. Quando mencionares datas, usa o formato dia/mês/ano (ex: 05/03/2026).
7. Sê conciso e profissional nas respostas.
8. Quando listares sessões, apresenta-as de forma organizada e legível.

Tipos de sessão disponíveis: teorica, pratica_escrita, pratica_gravacao, producao_musical, ensaio, showcase, trabalho_autonomo.
Estados disponíveis: rascunho, pendente, confirmada, recusada, em_curso, concluida, cancelada, terminada.
Tipos de trabalho autónomo: Produção Musical, Preparação Aulas, Edição/Captura, Reunião, Manutenção.
"""

# ---------------------------------------------------------------------------
# Definição das ferramentas (Function Calling)
# ---------------------------------------------------------------------------

TOOLS = [
    {
        "function_declarations": [
            {
                "name": "listar_sessoes",
                "description": "Lista todas as sessões/aulas existentes no sistema. Retorna dados como data, tipo, estado, turma, mentor, etc.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "limite": {
                            "type": "INTEGER",
                            "description": "Número máximo de sessões a retornar. Default: 50.",
                        }
                    },
                },
            },
            {
                "name": "obter_sessao",
                "description": "Obtém os detalhes completos de uma sessão específica pelo seu ID.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "aula_id": {
                            "type": "INTEGER",
                            "description": "ID da sessão/aula a consultar.",
                        }
                    },
                    "required": ["aula_id"],
                },
            },
            {
                "name": "criar_sessao",
                "description": "Cria uma nova sessão/aula. Para aulas regulares, turma_id é obrigatório. Para trabalho autónomo, definir is_autonomous=true e responsavel_user_id.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "turma_id": {
                            "type": "INTEGER",
                            "description": "ID da turma (obrigatório para aulas regulares, null para autónomo).",
                        },
                        "data_hora": {
                            "type": "STRING",
                            "description": "Data e hora no formato 'YYYY-MM-DD HH:MM'.",
                        },
                        "tipo": {
                            "type": "STRING",
                            "description": "Tipo de aula: teorica, pratica_escrita, pratica_gravacao, producao_musical, ensaio, showcase.",
                        },
                        "duracao_minutos": {
                            "type": "INTEGER",
                            "description": "Duração em minutos. Default: 90.",
                        },
                        "mentor_id": {
                            "type": "INTEGER",
                            "description": "ID do mentor a atribuir à sessão.",
                        },
                        "local": {
                            "type": "STRING",
                            "description": "Local da sessão.",
                        },
                        "tema": {
                            "type": "STRING",
                            "description": "Tema ou número da sessão.",
                        },
                        "observacoes": {
                            "type": "STRING",
                            "description": "Observações adicionais.",
                        },
                        "projeto_id": {
                            "type": "INTEGER",
                            "description": "ID do projeto associado.",
                        },
                        "is_autonomous": {
                            "type": "BOOLEAN",
                            "description": "Se é trabalho autónomo (true) ou aula regular (false).",
                        },
                        "tipo_atividade": {
                            "type": "STRING",
                            "description": "Tipo de atividade autónoma: Produção Musical, Preparação Aulas, Edição/Captura, Reunião, Manutenção.",
                        },
                        "responsavel_user_id": {
                            "type": "STRING",
                            "description": "UUID do responsável pelo trabalho autónomo.",
                        },
                    },
                    "required": ["data_hora"],
                },
            },
            {
                "name": "atualizar_sessao",
                "description": "Atualiza campos de uma sessão existente.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "aula_id": {
                            "type": "INTEGER",
                            "description": "ID da sessão a atualizar.",
                        },
                        "dados": {
                            "type": "OBJECT",
                            "description": "Campos a atualizar (ex: data_hora, tipo, local, tema, mentor_id, observacoes, estado).",
                            "properties": {
                                "data_hora": {"type": "STRING"},
                                "tipo": {"type": "STRING"},
                                "local": {"type": "STRING"},
                                "tema": {"type": "STRING"},
                                "mentor_id": {"type": "INTEGER"},
                                "observacoes": {"type": "STRING"},
                                "duracao_minutos": {"type": "INTEGER"},
                                "turma_id": {"type": "INTEGER"},
                            },
                        },
                    },
                    "required": ["aula_id", "dados"],
                },
            },
            {
                "name": "apagar_sessao",
                "description": "Apaga uma sessão do sistema. ATENÇÃO: ação irreversível.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "aula_id": {
                            "type": "INTEGER",
                            "description": "ID da sessão a apagar.",
                        }
                    },
                    "required": ["aula_id"],
                },
            },
            {
                "name": "mudar_estado_sessao",
                "description": "Altera o estado de uma sessão (ex: pendente, confirmada, recusada, cancelada, terminada).",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {
                        "aula_id": {
                            "type": "INTEGER",
                            "description": "ID da sessão.",
                        },
                        "novo_estado": {
                            "type": "STRING",
                            "description": "Novo estado: rascunho, pendente, confirmada, recusada, em_curso, concluida, cancelada, terminada.",
                        },
                    },
                    "required": ["aula_id", "novo_estado"],
                },
            },
            {
                "name": "listar_turmas",
                "description": "Lista todas as turmas com os respetivos estabelecimentos.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {},
                },
            },
            {
                "name": "listar_mentores",
                "description": "Lista todos os mentores disponíveis.",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {},
                },
            },
            {
                "name": "listar_equipa",
                "description": "Lista todos os membros da equipa com os seus perfis (nome, email, role).",
                "parameters": {
                    "type": "OBJECT",
                    "properties": {},
                },
            },
        ]
    }
]


# ---------------------------------------------------------------------------
# Executar ferramentas (mapeia function calls → serviços reais)
# ---------------------------------------------------------------------------

def _executar_ferramenta(nome: str, args: Dict[str, Any]) -> Any:
    """Executa uma ferramenta e devolve o resultado."""
    from services import aula_service, turma_service, profile_service

    try:
        if nome == "listar_sessoes":
            limite = args.get("limite", 50)
            sessoes = aula_service.listar_todas_aulas(limite=limite)
            # Resumir para não exceder contexto
            resumo = []
            for s in sessoes:
                resumo.append({
                    "id": s.get("id"),
                    "data_hora": str(s.get("data_hora")),
                    "tipo": s.get("tipo"),
                    "estado": s.get("estado"),
                    "turma_nome": s.get("turma_nome"),
                    "mentor_nome": s.get("mentor_nome"),
                    "tema": s.get("tema"),
                    "duracao_minutos": s.get("duracao_minutos"),
                    "is_autonomous": s.get("is_autonomous"),
                    "tipo_atividade": s.get("tipo_atividade"),
                    "local": s.get("local"),
                })
            return {"sucesso": True, "total": len(resumo), "sessoes": resumo}

        elif nome == "obter_sessao":
            sessao = aula_service.obter_aula_por_id(args["aula_id"])
            if sessao:
                return {"sucesso": True, "sessao": sessao}
            return {"sucesso": False, "erro": "Sessão não encontrada."}

        elif nome == "criar_sessao":
            resultado = aula_service.criar_aula(
                turma_id=args.get("turma_id"),
                data_hora=args.get("data_hora"),
                tipo=args.get("tipo", "pratica_escrita"),
                duracao_minutos=args.get("duracao_minutos", 90),
                mentor_id=args.get("mentor_id"),
                local=args.get("local"),
                tema=args.get("tema"),
                projeto_id=args.get("projeto_id"),
                observacoes=args.get("observacoes"),
                is_autonomous=args.get("is_autonomous", False),
                tipo_atividade=args.get("tipo_atividade"),
                responsavel_user_id=args.get("responsavel_user_id"),
            )
            if resultado:
                return {"sucesso": True, "sessao_criada": resultado}
            return {"sucesso": False, "erro": "Erro ao criar sessão."}

        elif nome == "atualizar_sessao":
            sucesso = aula_service.atualizar_aula(args["aula_id"], args.get("dados", {}))
            if sucesso:
                return {"sucesso": True, "mensagem": f"Sessão #{args['aula_id']} atualizada."}
            return {"sucesso": False, "erro": "Erro ao atualizar sessão."}

        elif nome == "apagar_sessao":
            sucesso = aula_service.apagar_aula(args["aula_id"])
            if sucesso:
                return {"sucesso": True, "mensagem": f"Sessão #{args['aula_id']} apagada."}
            return {"sucesso": False, "erro": "Sessão não encontrada ou erro ao apagar."}

        elif nome == "mudar_estado_sessao":
            sucesso = aula_service.mudar_estado_aula(args["aula_id"], args["novo_estado"])
            if sucesso:
                return {"sucesso": True, "mensagem": f"Estado da sessão #{args['aula_id']} alterado para '{args['novo_estado']}'."}
            return {"sucesso": False, "erro": "Erro ao alterar estado."}

        elif nome == "listar_turmas":
            turmas = turma_service.listar_turmas_com_estabelecimento()
            resumo = [{"id": t.get("id"), "nome": t.get("nome"), "estabelecimento": t.get("estabelecimento_nome")} for t in turmas]
            return {"sucesso": True, "turmas": resumo}

        elif nome == "listar_mentores":
            mentores = turma_service.listar_mentores()
            resumo = [{"id": m.get("id"), "nome": m.get("nome")} for m in mentores]
            return {"sucesso": True, "mentores": resumo}

        elif nome == "listar_equipa":
            perfis = profile_service.listar_perfis()
            resumo = [{"id": p.get("id"), "nome": p.get("nome"), "email": p.get("email"), "role": p.get("role")} for p in perfis]
            return {"sucesso": True, "equipa": resumo}

        else:
            return {"sucesso": False, "erro": f"Ferramenta '{nome}' desconhecida."}

    except Exception as e:
        return {"sucesso": False, "erro": str(e)}


# ---------------------------------------------------------------------------
# Processar mensagem (loop principal)
# ---------------------------------------------------------------------------

def processar_mensagem(
    mensagem: str,
    historico: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Processa uma mensagem do utilizador com o Gemini.
    Devolve {'resposta': str, 'historico': list}.
    """
    if not os.getenv("GEMINI_API_KEY"):
        return {
            "resposta": "⚠️ A chave da API do Gemini não está configurada. Adiciona GEMINI_API_KEY ao ficheiro .env.",
            "historico": historico or [],
        }

    # Construir system prompt com data atual
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    system_instruction = SYSTEM_PROMPT.replace("{current_datetime}", now)

    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=system_instruction,
        tools=TOOLS,
    )

    # Reconstruir o histórico de conversa para o Gemini
    contents = []
    if historico:
        for item in historico:
            role = item.get("role", "user")
            parts = item.get("parts", [])
            if parts:
                contents.append({"role": role, "parts": parts})

    # Adicionar a nova mensagem do utilizador
    contents.append({"role": "user", "parts": [{"text": mensagem}]})

    try:
        # Loop de function calling (máx 10 iterações para segurança)
        for _ in range(10):
            response = model.generate_content(contents)

            # Verificar se o modelo quer chamar uma ferramenta
            candidate = response.candidates[0]
            has_function_call = False

            for part in candidate.content.parts:
                if hasattr(part, "function_call") and part.function_call.name:
                    has_function_call = True
                    fc = part.function_call
                    nome_funcao = fc.name
                    args_funcao = dict(fc.args) if fc.args else {}

                    print(f"🤖 AI Agent: chamando {nome_funcao}({json.dumps(args_funcao, ensure_ascii=False)})")

                    # Executar a ferramenta
                    resultado = _executar_ferramenta(nome_funcao, args_funcao)

                    # Adicionar a resposta da ferramenta ao contexto
                    contents.append({
                        "role": "model",
                        "parts": [part],
                    })
                    contents.append({
                        "role": "user",
                        "parts": [{
                            "function_response": {
                                "name": nome_funcao,
                                "response": resultado,
                            }
                        }],
                    })
                    break  # Reiniciar loop para nova chamada ao modelo

            if not has_function_call:
                # Resposta textual final
                resposta_texto = candidate.content.parts[0].text

                # Guardar no histórico
                novo_historico = list(historico or [])
                novo_historico.append({"role": "user", "parts": [{"text": mensagem}]})
                novo_historico.append({"role": "model", "parts": [{"text": resposta_texto}]})

                # Limitar histórico a últimas 20 mensagens
                if len(novo_historico) > 20:
                    novo_historico = novo_historico[-20:]

                return {
                    "resposta": resposta_texto,
                    "historico": novo_historico,
                }

        return {
            "resposta": "⚠️ O agente atingiu o limite de iterações. Por favor, tenta reformular o pedido.",
            "historico": historico or [],
        }

    except Exception as e:
        print(f"❌ Erro no AI Agent: {e}")
        return {
            "resposta": f"❌ Ocorreu um erro ao processar o pedido: {str(e)}",
            "historico": historico or [],
        }

"""
Serviço de integração com Slack para notificações da coordenação.
"""
import os
import json
import urllib.request

# URL do Webhook (Em produção, deve vir de variáveis de ambiente)
# Exemplo: https://hooks.slack.com/services/T000...
WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")

# Alias para compatibilidade com testes
SLACK_WEBHOOK_URL = WEBHOOK_URL

def enviar_payload(payload, webhook_url=None):
    """
    Envia um payload JSON para o Slack.
    Retorna True se sucesso, False caso contrário.
    """
    url_to_use = webhook_url if webhook_url else WEBHOOK_URL
    
    if not url_to_use:
        # Silencioso se não estiver configurado para não atrapalhar testes locais
        return False
        
    try:
        req = urllib.request.Request(
            url_to_use,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        
        # ⚠️ AVISO: Desabilitar a verificação SSL pode ser um risco de segurança.
        # Considere configurar certificados CA adequados no ambiente de produção.
        import ssl
        context = ssl._create_unverified_context()
        with urllib.request.urlopen(req, context=context) as res:
            if res.status == 200:
                print("✅ Notificação enviada para a Coordenação.")
                return True
            else:
                print(f"⚠️  Erro Slack: {res.status}")
                return False
                
    except Exception as e:
        print(f"⚠️  Falha ao notificar Slack: {e}")
        return False

def testar_slack_notification():
    """
    Envia uma mensagem de teste simples para verificar se o Slack está funcionando.
    """
    payload = {
        "text": "🧪 Teste de notificação - Sistema RAP NOVA ESCOLA funcionando!"
    }
    return enviar_payload(payload)

def notificar_aula_atribuida(aula_id, mentor_nome, turma_nome, data_hora, tipo_aula, instituicao_nome, tema=None):
    """
    Notifica quando uma aula é atribuída a um mentor.
    """
    payload = {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📚 Nova Aula Atribuída",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Mentor:*\n{mentor_nome}"},
                    {"type": "mrkdwn", "text": f"*Turma:*\n{turma_nome}"},
                    {"type": "mrkdwn", "text": f"*Data/Hora:*\n{data_hora}"},
                    {"type": "mrkdwn", "text": f"*ID Aula:*\n#{aula_id}"},
                    {"type": "mrkdwn", "text": f"*Tipo:*\n{tipo_aula}"},
                    {"type": "mrkdwn", "text": f"*Instituição:*\n{instituicao_nome}"}
                ]
            }
        ]
    }
    
    if tema:
        payload["blocks"].append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Tema:*\n{tema}"
            }
        })
    
    return enviar_payload(payload)

def notificar_aula_recusada(aula_id, mentor_nome, turma_nome, data_hora, motivo):
    """
    Envia alerta de aula recusada com destaque para o motivo.
    """
    payload = {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🚨 ALERTA: Aula Recusada",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Mentor:*\n{mentor_nome}"},
                    {"type": "mrkdwn", "text": f"*Turma:*\n{turma_nome}"},
                    {"type": "mrkdwn", "text": f"*Data/Hora:*\n{data_hora}"},
                    {"type": "mrkdwn", "text": f"*ID Aula:*\n#{aula_id}"}
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Motivo da Recusa:*\n> {motivo}"
                }
            },
            {
                "type": "context",
                "elements": [
                    {"type": "mrkdwn", "text": "⚠️ Ação necessária: Verificar disponibilidade ou reatribuir."}
                ]
            }
        ]
    }
    return enviar_payload(payload)

def send_slack_notification(mensagem, titulo, cor=None, campos=None, webhook_url=None):
    """
    Envia notificação genérica com suporte a cores e campos (attachments).
    Usado pelo serviço de exceções.
    """
    payload = {
        "attachments": [
            {
                "color": cor,
                "title": titulo,
                "text": mensagem,
                "fields": campos if campos else [],
                "mrkdwn_in": ["text", "fields"]
            }
        ]
    }
    return enviar_payload(payload, webhook_url)

def notificar_aula_confirmada(aula_id, mentor_nome, turma_nome, data_hora, observacao=None):
    """
    Envia confirmação simples de aula.
    """
    texto = f"✅ *Aula Confirmada* | {mentor_nome} | {turma_nome} | {data_hora}"
    if observacao:
        texto += f"\n> Obs: {observacao}"
        
    payload = {
        "text": texto
    }
    return enviar_payload(payload)

def notificar_falta_equipamento(tipo_aula, data_hora, itens_em_falta):
    """
    Alerta sobre falta de equipamento para uma aula.
    """
    lista_itens = "\n".join([f"• {item}" for item in itens_em_falta])
    
    payload = {
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "⚠️ ALERTA: Falta de Equipamento",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*Tipo de Aula:*\n{tipo_aula}"},
                    {"type": "mrkdwn", "text": f"*Data/Hora:*\n{data_hora}"}
                ]
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Itens em Falta no Inventário:*\n{lista_itens}"
                }
            },
            {
                "type": "context",
                "elements": [
                    {"type": "mrkdwn", "text": "ℹ️ A aula foi criada, mas verifique o stock ou alugue equipamento."}
                ]
            }
        ]
    }
    return enviar_payload(payload)

    
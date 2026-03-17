"""
==============================================================================
RAP NOVA ESCOLA - Serviço de Notificação de Exceções à Coordenação
==============================================================================
Ficheiro: services/excecoes_service.py

Este serviço gere notificações de situações excecionais que requerem
atenção da coordenação:

- Aulas recusadas (precisa atribuir outro mentor)
- Cancelamentos de última hora
- Conflitos de horário
- Falta de equipamento
- Outros problemas críticos

Fluxo:
1. Detecta exceção (ex: aula recusada)
2. Cria log detalhado na BD
3. Envia notificação Slack URGENTE para coordenação
4. Retorna confirmação

==============================================================================
"""

import sys
import os
import logging

# Adiciona o diretório pai ao sys.path para permitir importações quando executado diretamente
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

logger = logging.getLogger(__name__)

from database.connection import get_db_connection
from datetime import datetime


# ==============================================================================
# CONFIGURAÇÕES
# ==============================================================================

# Canal Slack específico para coordenação (opcional)
# Se não definido, usa o webhook padrão
SLACK_COORDENACAO_WEBHOOK = os.getenv("SLACK_COORDENACAO_WEBHOOK")

# Níveis de urgência
URGENCIA_BAIXA = "baixa"      # Informativo
URGENCIA_MEDIA = "media"      # Requer atenção
URGENCIA_ALTA = "alta"        # Requer ação imediata
URGENCIA_CRITICA = "critica"  # Bloqueante


# ==============================================================================
# FUNÇÃO PRINCIPAL: NOTIFICAR EXCEÇÃO À COORDENAÇÃO
# ==============================================================================

def notificar_excecao_coordenacao(
    tipo_excecao,
    titulo,
    descricao,
    entidade,
    entidade_id,
    urgencia=URGENCIA_MEDIA,
    dados_contexto=None,
    acoes_sugeridas=None
):
    """
    Notifica a coordenação sobre uma situação excepcional.
    
    Esta é a função central do sistema de exceções.
    Cria log + Envia Slack em uma única operação.
    
    Parâmetros:
        tipo_excecao (str): Tipo da exceção
            - 'aula_recusada'
            - 'cancelamento_urgente'
            - 'conflito_horario'
            - 'falta_equipamento'
            - 'mentor_indisponivel'
            
        titulo (str): Título curto da exceção
            Ex: "Aula #5 Recusada"
            
        descricao (str): Descrição detalhada do problema
            Ex: "Mentor João Silva recusou aula de Gravação para turma 10ºA"
            
        entidade (str): Tipo de entidade afetada ('aula', 'mentor', etc.)
        
        entidade_id (int): ID da entidade afetada
        
        urgencia (str): Nível de urgência (baixa, media, alta, critica)
            - baixa: FYI, não urgente
            - media: Requer atenção (padrão)
            - alta: Requer ação rápida
            - critica: Bloqueante, ação imediata
            
        dados_contexto (dict): Dados adicionais para contexto
            Ex: {
                'turma': '10ºA',
                'data_hora': '2024-12-20 14:00',
                'motivo': 'Doença'
            }
            
        acoes_sugeridas (list): Lista de ações sugeridas
            Ex: [
                'Atribuir mentor substituto',
                'Remarcar aula para próxima semana'
            ]
    
    Retorna:
        dict: Resultado da notificação
            {
                'sucesso': True,
                'log_id': 123,
                'slack_enviado': True
            }
    
    Exemplo:
        notificar_excecao_coordenacao(
            tipo_excecao='aula_recusada',
            titulo='Aula #5 Recusada',
            descricao='Mentor João recusou por doença',
            entidade='aula',
            entidade_id=5,
            urgencia='alta',
            dados_contexto={
                'turma': '10ºA',
                'mentor': 'João Silva',
                'motivo': 'Doença súbita'
            },
            acoes_sugeridas=[
                'Atribuir mentor substituto urgente',
                'Contactar turma para avisar'
            ]
        )
    """
    
    logger.warning(f"EXCECAO DETECTADA: {tipo_excecao} | Urgencia: {urgencia.upper()}")

    # 1. CRIAR LOG NA BASE DE DADOS
    logger.info("1/3 - A criar log de excecao na BD...")
    
    log_id = criar_log_excecao(
        tipo_excecao=tipo_excecao,
        titulo=titulo,
        descricao=descricao,
        entidade=entidade,
        entidade_id=entidade_id,
        urgencia=urgencia,
        dados_contexto=dados_contexto
    )
    
    if not log_id:
        logger.error("Erro ao criar log!")
        return {
            'sucesso': False,
            'log_id': None,
            'slack_enviado': False
        }

    logger.info(f"Log #{log_id} criado")

    # 2. ENVIAR NOTIFICAÇÃO SLACK
    logger.info("2/3 - A enviar notificacao Slack...")
    
    slack_enviado = enviar_slack_coordenacao(
        tipo_excecao=tipo_excecao,
        titulo=titulo,
        descricao=descricao,
        urgencia=urgencia,
        dados_contexto=dados_contexto,
        acoes_sugeridas=acoes_sugeridas,
        log_id=log_id
    )
    
    if slack_enviado:
        logger.info("Slack enviado")
    else:
        logger.warning("Slack nao enviado (verificar configuracao)")

    # 3. CONFIRMAÇÃO FINAL
    logger.info("3/3 - Coordenacao notificada!")
    
    return {
        'sucesso': True,
        'log_id': log_id,
        'slack_enviado': slack_enviado
    }


# ==============================================================================
# FUNÇÃO: CRIAR LOG DE EXCEÇÃO
# ==============================================================================

def criar_log_excecao(tipo_excecao, titulo, descricao, entidade, entidade_id, 
                      urgencia, dados_contexto=None):
    """
    Cria registo de log específico para exceções.
    
    Diferente dos logs normais:
    - Tabela separada (logs_excecoes) OU
    - Campo urgencia na tabela logs existente
    
    Parâmetros:
        (mesmo que notificar_excecao_coordenacao)
    
    Retorna:
        int: ID do log criado, ou None se erro
    """
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Preparar dados adicionais (contexto + urgência)
        import json
        
        dados_log = {
            'urgencia': urgencia,
            'contexto': dados_contexto if dados_contexto else {}
        }
        
        dados_json = json.dumps(dados_log, ensure_ascii=False)
        
        # Criar descrição completa
        descricao_completa = f"[EXCEÇÃO - {urgencia.upper()}] {titulo}\n{descricao}"
        
        # Inserir log
        query = """
            INSERT INTO logs (
                tipo_acao,
                entidade,
                entidade_id,
                descricao,
                usuario,
                dados_adicionais
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id;
        """
        
        cur.execute(query, (
            tipo_excecao,
            entidade,
            entidade_id,
            descricao_completa,
            'Sistema - Coordenação',
            dados_json
        ))
        
        log_id = cur.fetchone()[0]
        conn.commit()
        
        cur.close()
        conn.close()
        
        return log_id
        
    except Exception as e:
        logger.error(f"Erro ao criar log de excecao: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ==============================================================================
# FUNÇÃO: ENVIAR SLACK PARA COORDENAÇÃO
# ==============================================================================

def enviar_slack_coordenacao(tipo_excecao, titulo, descricao, urgencia, 
                              dados_contexto=None, acoes_sugeridas=None, log_id=None):
    """
    Envia notificação Slack formatada para a coordenação.
    
    Usa cores e emojis diferentes conforme urgência.
    
    Parâmetros:
        (mesmo que notificar_excecao_coordenacao)
    
    Retorna:
        bool: True se enviou com sucesso
    """
    
    try:
        from notifications import slack_service
        
        # Definir cor e emoji conforme urgência
        if urgencia == URGENCIA_CRITICA:
            cor = "danger"  # Vermelho
            emoji = "🔴"
            prefixo = "CRÍTICO"
        elif urgencia == URGENCIA_ALTA:
            cor = "warning"  # Laranja
            emoji = "🟠"
            prefixo = "URGENTE"
        elif urgencia == URGENCIA_MEDIA:
            cor = "warning"  # Laranja
            emoji = "🟡"
            prefixo = "ATENÇÃO"
        else:  # BAIXA
            cor = "good"  # Verde
            emoji = "🔵"
            prefixo = "INFO"
        
        # Construir mensagem
        mensagem = f"{emoji} **[{prefixo}]** {titulo}\n\n{descricao}"
        
        # Construir campos
        campos = []
        
        # Adicionar dados de contexto
        if dados_contexto:
            for chave, valor in dados_contexto.items():
                campos.append({
                    "title": chave.replace('_', ' ').title(),
                    "value": str(valor),
                    "short": True
                })
        
        # Adicionar urgência
        campos.append({
            "title": "⚡ Nível de Urgência",
            "value": urgencia.upper(),
            "short": True
        })
        
        # Adicionar timestamp
        campos.append({
            "title": "🕐 Detectado em",
            "value": datetime.now().strftime("%d/%m/%Y às %H:%M"),
            "short": True
        })
        
        # Adicionar log ID
        if log_id:
            campos.append({
                "title": "📋 Log ID",
                "value": f"#{log_id}",
                "short": True
            })
        
        # Adicionar ações sugeridas
        if acoes_sugeridas:
            acoes_texto = "\n".join([f"• {acao}" for acao in acoes_sugeridas])
            campos.append({
                "title": "💡 Ações Sugeridas",
                "value": acoes_texto,
                "short": False
            })
        
        # Determinar webhook a usar
        webhook_url = SLACK_COORDENACAO_WEBHOOK or os.getenv("SLACK_WEBHOOK_URL")
        
        # Enviar notificação
        sucesso = slack_service.send_slack_notification(
            mensagem=mensagem,
            titulo=f"🚨 EXCEÇÃO: {tipo_excecao.replace('_', ' ').title()}",
            cor=cor,
            campos=campos,
            webhook_url=webhook_url
        )
        
        return sucesso
        
    except ImportError:
        logger.warning("Modulo slack_service nao encontrado. Notificacao nao enviada.")
        return False
        
    except Exception as e:
        logger.error(f"Erro ao enviar Slack: {e}")
        return False


# ==============================================================================
# FUNÇÕES ESPECÍFICAS POR TIPO DE EXCEÇÃO
# ==============================================================================

def notificar_aula_recusada(aula_id, mentor_nome, turma_nome, data_hora, motivo):
    """
    Notifica coordenação sobre aula recusada.
    
    Esta é a notificação mais comum e importante!
    Indica que precisa urgentemente atribuir outro mentor.
    
    Parâmetros:
        aula_id (int): ID da aula recusada
        mentor_nome (str): Nome do mentor que recusou
        turma_nome (str): Nome da turma
        data_hora (str/datetime): Data e hora da aula
        motivo (str): Motivo da recusa
    
    Retorna:
        dict: Resultado da notificação
    
    Exemplo:
        notificar_aula_recusada(
            aula_id=5,
            mentor_nome="João Silva",
            turma_nome="10ºA",
            data_hora="2024-12-20 14:00",
            motivo="Doença súbita"
        )
    """
    
    # Formatar data/hora
    if isinstance(data_hora, str):
        data_hora_formatada = data_hora
    else:
        data_hora_formatada = data_hora.strftime("%d/%m/%Y às %H:%M")
    
    return notificar_excecao_coordenacao(
        tipo_excecao='aula_recusada',
        titulo=f'Aula #{aula_id} Recusada - {turma_nome}',
        descricao=f'O mentor {mentor_nome} recusou a aula agendada para {data_hora_formatada}.',
        entidade='aula',
        entidade_id=aula_id,
        urgencia=URGENCIA_ALTA,  # Alta porque precisa ação rápida
        dados_contexto={
            'Mentor': mentor_nome,
            'Turma': turma_nome,
            'Data/Hora': data_hora_formatada,
            'Motivo': motivo
        },
        acoes_sugeridas=[
            '🔄 Atribuir mentor substituto',
            '📞 Contactar turma para avisar',
            '📅 Ou remarcar aula para outra data'
        ]
    )


def notificar_cancelamento_urgente(aula_id, turma_nome, data_hora, motivo, horas_antecedencia):
    """
    Notifica coordenação sobre cancelamento de última hora.
    
    Cancelamentos com menos de 24h são críticos.
    
    Parâmetros:
        aula_id (int): ID da aula
        turma_nome (str): Nome da turma
        data_hora (str/datetime): Data e hora da aula
        motivo (str): Motivo do cancelamento
        horas_antecedencia (int): Quantas horas antes da aula foi cancelada
    
    Retorna:
        dict: Resultado da notificação
    """
    
    # Formatar data/hora
    if isinstance(data_hora, str):
        data_hora_formatada = data_hora
    else:
        data_hora_formatada = data_hora.strftime("%d/%m/%Y às %H:%M")
    
    # Determinar urgência baseada nas horas de antecedência
    if horas_antecedencia < 6:
        urgencia = URGENCIA_CRITICA  # Menos de 6h
    elif horas_antecedencia < 24:
        urgencia = URGENCIA_ALTA  # Menos de 24h
    else:
        urgencia = URGENCIA_MEDIA
    
    return notificar_excecao_coordenacao(
        tipo_excecao='cancelamento_urgente',
        titulo=f'Cancelamento Urgente - Aula #{aula_id}',
        descricao=f'Aula cancelada com apenas {horas_antecedencia}h de antecedência!',
        entidade='aula',
        entidade_id=aula_id,
        urgencia=urgencia,
        dados_contexto={
            'Turma': turma_nome,
            'Data/Hora Prevista': data_hora_formatada,
            'Antecedência': f'{horas_antecedencia} horas',
            'Motivo': motivo
        },
        acoes_sugeridas=[
            '📞 Contactar turma URGENTE',
            '🔄 Tentar remarcar',
            '📧 Avisar instituição'
        ]
    )


def notificar_conflito_horario(aula1_id, aula2_id, mentor_nome, data_hora):
    """
    Notifica sobre conflito de horário (mentor com 2 aulas sobrepostas).
    
    Parâmetros:
        aula1_id (int): ID da primeira aula
        aula2_id (int): ID da segunda aula (conflito)
        mentor_nome (str): Nome do mentor
        data_hora (str/datetime): Data/hora do conflito
    
    Retorna:
        dict: Resultado da notificação
    """
    
    # Formatar data/hora
    if isinstance(data_hora, str):
        data_hora_formatada = data_hora
    else:
        data_hora_formatada = data_hora.strftime("%d/%m/%Y às %H:%M")
    
    return notificar_excecao_coordenacao(
        tipo_excecao='conflito_horario',
        titulo=f'Conflito de Horário - {mentor_nome}',
        descricao=f'O mentor {mentor_nome} tem 2 aulas marcadas para o mesmo horário!',
        entidade='mentor',
        entidade_id=None,  # Afeta 2 aulas
        urgencia=URGENCIA_ALTA,
        dados_contexto={
            'Mentor': mentor_nome,
            'Data/Hora': data_hora_formatada,
            'Aula 1': f'#{aula1_id}',
            'Aula 2': f'#{aula2_id}'
        },
        acoes_sugeridas=[
            '📅 Remarcar uma das aulas',
            '🔄 Atribuir mentor substituto para uma delas',
            '🔍 Verificar outras aulas do mentor'
        ]
    )


def notificar_falta_equipamento(aula_id, equipamento_tipo, quantidade_necessaria, data_hora):
    """
    Notifica sobre falta de equipamento para uma aula.
    
    Parâmetros:
        aula_id (int): ID da aula
        equipamento_tipo (str): Tipo de equipamento em falta
        quantidade_necessaria (int): Quantidade necessária
        data_hora (str/datetime): Data/hora da aula
    
    Retorna:
        dict: Resultado da notificação
    """
    
    # Formatar data/hora
    if isinstance(data_hora, str):
        data_hora_formatada = data_hora
    else:
        data_hora_formatada = data_hora.strftime("%d/%m/%Y às %H:%M")
    
    return notificar_excecao_coordenacao(
        tipo_excecao='falta_equipamento',
        titulo=f'Falta de Equipamento - Aula #{aula_id}',
        descricao=f'Equipamento insuficiente para aula: {equipamento_tipo}',
        entidade='aula',
        entidade_id=aula_id,
        urgencia=URGENCIA_MEDIA,
        dados_contexto={
            'Tipo Equipamento': equipamento_tipo,
            'Quantidade Necessária': quantidade_necessaria,
            'Data/Hora Aula': data_hora_formatada
        },
        acoes_sugeridas=[
            f'🔧 Arranjar {quantidade_necessaria}x {equipamento_tipo}',
            '📦 Verificar stock',
            '🔄 Ou usar equipamento alternativo'
        ]
    )


# ==============================================================================
# FUNÇÕES AUXILIARES
# ==============================================================================

def listar_excecoes_pendentes(urgencia_minima=URGENCIA_MEDIA):
    """
    Lista exceções que ainda não foram resolvidas.
    
    Útil para dashboard de coordenação.
    
    Parâmetros:
        urgencia_minima (str): Mostrar apenas urgência >= esta
    
    Retorna:
        list: Lista de exceções pendentes
    """
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Mapear urgências para ordem
        ordem_urgencia = {
            URGENCIA_CRITICA: 4,
            URGENCIA_ALTA: 3,
            URGENCIA_MEDIA: 2,
            URGENCIA_BAIXA: 1
        }
        
        # Buscar logs de exceções
        query = """
            SELECT 
                id,
                tipo_acao,
                descricao,
                entidade,
                entidade_id,
                dados_adicionais,
                criado_em
            FROM logs
            WHERE tipo_acao IN (
                'aula_recusada',
                'cancelamento_urgente',
                'conflito_horario',
                'falta_equipamento'
            )
            ORDER BY criado_em DESC
            LIMIT 50;
        """
        
        cur.execute(query)
        resultados = cur.fetchall()
        
        excecoes = []
        import json
        
        for row in resultados:
            dados_json = row[5] if row[5] else '{}'
            dados = json.loads(dados_json)
            
            urgencia_log = dados.get('urgencia', URGENCIA_MEDIA)
            
            # Filtrar por urgência mínima
            if ordem_urgencia.get(urgencia_log, 0) >= ordem_urgencia.get(urgencia_minima, 0):
                excecoes.append({
                    'id': row[0],
                    'tipo': row[1],
                    'descricao': row[2],
                    'entidade': row[3],
                    'entidade_id': row[4],
                    'urgencia': urgencia_log,
                    'criado_em': row[6]
                })
        
        cur.close()
        conn.close()
        
        return excecoes
        
    except Exception as e:
        logger.error(f"Erro ao listar excecoes: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ==============================================================================
# EXEMPLO DE USO
# ==============================================================================

if __name__ == "__main__":
    """
    Exemplos de como usar o serviço de exceções.
    Execute: python services/excecoes_service.py
    """
    
    logger.info("TESTE DO SERVICO DE EXCECOES A COORDENACAO")

    # Teste 1: Aula recusada
    logger.info("Teste 1: Notificar aula recusada")
    
    resultado = notificar_aula_recusada(
        aula_id=999,
        mentor_nome="João Silva (TESTE)",
        turma_nome="10ºA",
        data_hora="2024-12-25 14:00",
        motivo="Teste - Doença súbita"
    )
    
    logger.info(f"Resultado: {resultado}")
    
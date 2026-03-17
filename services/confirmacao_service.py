"""
==============================================================================
RAP NOVA ESCOLA - Serviço de Confirmação/Recusa de Aulas
==============================================================================
Ficheiro: services/confirmacao_service.py

Este serviço gere o fluxo de confirmação e recusa de aulas:
- Mentor pode confirmar ou recusar aulas
- Cria logs automáticos de todas as ações
- Guarda motivos de recusa
- Atualiza timestamps automaticamente

Fluxo:
    Aula "pendente" 
        ↓
    Mentor decide
        ├─→ Confirmar → "confirmada"
        └─→ Recusar → "recusada"
    
==============================================================================
"""

import logging

from database.connection import get_db_connection
from datetime import datetime

logger = logging.getLogger(__name__)


# ==============================================================================
# FUNÇÃO AUXILIAR: CRIAR LOG
# ==============================================================================

def criar_log(tipo_acao, entidade, entidade_id, descricao, usuario=None, dados_adicionais=None):
    """
    Cria um registo de log na base de dados.
    
    Esta função é chamada automaticamente sempre que há uma ação importante
    (confirmar, recusar, cancelar, etc.) para manter histórico completo.
    
    Parâmetros:
        tipo_acao (str): Tipo de ação ('confirmar', 'recusar', 'cancelar', etc.)
        entidade (str): Tipo de entidade afetada ('aula', 'mentor', etc.)
        entidade_id (int): ID da entidade afetada
        descricao (str): Descrição da ação
        usuario (str): Quem fez a ação (nome do mentor, admin, etc.)
        dados_adicionais (str): Informação extra em JSON ou texto
    
    Retorna:
        int: ID do log criado, ou None se erro
    
    Exemplo:
        criar_log(
            tipo_acao='confirmar',
            entidade='aula',
            entidade_id=5,
            descricao='Aula #5 confirmada pelo mentor João Silva',
            usuario='João Silva'
        )
    """
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
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
            tipo_acao,
            entidade,
            entidade_id,
            descricao,
            usuario,
            dados_adicionais
        ))
        
        log_id = cur.fetchone()[0]
        conn.commit()
        
        logger.info(f"Log #{log_id} criado: {tipo_acao} - {entidade} #{entidade_id}")
        
        cur.close()
        conn.close()
        
        return log_id
        
    except Exception as e:
        logger.warning(f"Erro ao criar log: {e}")
        # Não interrompe o fluxo principal se o log falhar
        if 'conn' in locals() and conn:
            conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ==============================================================================
# FUNÇÃO 1: CONFIRMAR AULA
# ==============================================================================

def confirmar_aula(aula_id, mentor_id, observacao=None):
    """
    Confirma uma aula (mentor aceita dar a aula).
    
    O que acontece:
    1. Verifica se a aula existe e está em estado "pendente"
    2. Verifica se o mentor_id corresponde ao mentor atribuído
    3. Muda o estado para "confirmada"
    4. Adiciona observação (se fornecida)
    5. Atualiza timestamp
    6. Cria log automático da confirmação
    
    Parâmetros:
        aula_id (int): ID da aula a confirmar
        mentor_id (int): ID do mentor que está a confirmar (para validação)
        observacao (str): Observação opcional do mentor
    
    Retorna:
        dict: Informação da confirmação ou None se erro
            {
                'sucesso': True,
                'aula_id': 5,
                'estado_anterior': 'pendente',
                'estado_novo': 'confirmada',
                'mentor_nome': 'João Silva',
                'log_id': 123
            }
    
    Exemplo:
        resultado = confirmar_aula(
            aula_id=5,
            mentor_id=2,
            observacao="Equipamento verificado, pronto para a sessão"
        )
    """
    
    if not aula_id or not mentor_id:
        logger.error("aula_id e mentor_id sao obrigatorios!")
        return None

    conn = None
    cur = None

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # 1. Buscar informação da aula
        query_aula = """
            SELECT
                a.estado,
                a.mentor_id,
                a.tema,
                a.data_hora,
                m.nome as mentor_nome,
                t.nome as turma_nome
            FROM aulas a
            LEFT JOIN mentores m ON a.mentor_id = m.id
            LEFT JOIN turmas t ON a.turma_id = t.id
            WHERE a.id = %s;
        """

        cur.execute(query_aula, (aula_id,))
        aula = cur.fetchone()

        if not aula:
            logger.error(f"Aula #{aula_id} nao encontrada!")
            return None

        estado_atual = aula[0]
        mentor_aula_id = aula[1]
        tema = aula[2]
        data_hora = aula[3]
        mentor_nome = aula[4]
        turma_nome = aula[5]

        # 2. Validar se o mentor que está a confirmar é o mentor da aula
        if mentor_aula_id != mentor_id:
            logger.error(f"Mentor #{mentor_id} nao esta atribuido a esta aula! Esta aula esta atribuida ao mentor #{mentor_aula_id}")
            return None

        # 3. Validar se a aula está em estado "pendente"
        if estado_atual != "pendente":
            logger.error(f"Aula nao esta pendente! Estado atual: '{estado_atual}'. So podes confirmar aulas com estado 'pendente'")
            return None
        
        # 4. Atualizar estado para "confirmada"
        nota_confirmacao = f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Confirmada por {mentor_nome}"
        if observacao:
            nota_confirmacao += f" | {observacao}"
        
        query_update = """
            UPDATE aulas
            SET estado = 'confirmada',
                observacoes = COALESCE(observacoes || E'\n', '') || %s,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = %s;
        """
        
        cur.execute(query_update, (nota_confirmacao, aula_id))
        
        # 5. Criar log da confirmação
        descricao_log = f"Aula #{aula_id} confirmada"
        if tema:
            descricao_log += f" (Tema: {tema})"
        descricao_log += f" | Turma: {turma_nome} | Data: {data_hora}"
        
        dados_adicionais = f"Estado anterior: {estado_atual}"
        if observacao:
            dados_adicionais += f" | Observação: {observacao}"
        
        # Commit das alterações
        conn.commit()
        
        # Criar log (após commit para garantir que a aula foi atualizada)
        log_id = criar_log(
            tipo_acao='confirmar',
            entidade='aula',
            entidade_id=aula_id,
            descricao=descricao_log,
            usuario=mentor_nome,
            dados_adicionais=dados_adicionais
        )
        
        logger.info(f"Aula #{aula_id} CONFIRMADA com sucesso! Mentor: {mentor_nome}, Turma: {turma_nome}, Data/Hora: {data_hora}" + (f", Observacao: {observacao}" if observacao else ""))
        
        # Enviar notificação Slack
        try:
            from notifications import slack_service
            
            slack_service.notificar_aula_confirmada(
                aula_id=aula_id,
                mentor_nome=mentor_nome,
                turma_nome=turma_nome,
                data_hora=data_hora,
                observacao=observacao
            )
        except Exception as e:
            logger.warning(f"Erro ao enviar notificacao Slack: {e}")

        return {
            'sucesso': True,
            'aula_id': aula_id,
            'estado_anterior': estado_atual,
            'estado_novo': 'confirmada',
            'mentor_nome': mentor_nome,
            'turma_nome': turma_nome,
            'log_id': log_id
        }

    except Exception as e:
        logger.error(f"Erro ao confirmar aula: {e}")
        if conn:
            conn.rollback()
        return None
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# ==============================================================================
# FUNÇÃO 2: RECUSAR AULA
# ==============================================================================

def recusar_aula(aula_id, mentor_id, motivo):
    """
    Recusa uma aula (mentor não pode/quer dar a aula).
    
    O que acontece:
    1. Verifica se a aula existe e está em estado "pendente"
    2. Verifica se o mentor_id corresponde ao mentor atribuído
    3. Muda o estado para "recusada"
    4. OBRIGATÓRIO: Guarda o motivo da recusa
    5. Atualiza timestamp
    6. Cria log automático da recusa
    
    Parâmetros:
        aula_id (int): ID da aula a recusar
        mentor_id (int): ID do mentor que está a recusar
        motivo (str): Motivo da recusa (OBRIGATÓRIO!)
    
    Retorna:
        dict: Informação da recusa ou None se erro
    
    Exemplo:
        resultado = recusar_aula(
            aula_id=7,
            mentor_id=2,
            motivo="Conflito de horário com outra atividade"
        )
    """
    
    # Validar parâmetros obrigatórios
    if not aula_id or not mentor_id:
        logger.error("aula_id e mentor_id sao obrigatorios!")
        return None

    if not motivo or motivo.strip() == "":
        logger.error("Motivo da recusa e OBRIGATORIO! Por favor, indica porque estas a recusar esta aula.")
        return None
    
    conn = None
    cur = None
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. Buscar informação da aula
        query_aula = """
            SELECT 
                a.estado,
                a.mentor_id,
                a.tema,
                a.data_hora,
                m.nome as mentor_nome,
                t.nome as turma_nome
            FROM aulas a
            LEFT JOIN mentores m ON a.mentor_id = m.id
            LEFT JOIN turmas t ON a.turma_id = t.id
            WHERE a.id = %s;
        """
        
        cur.execute(query_aula, (aula_id,))
        aula = cur.fetchone()
        
        if not aula:
            logger.error(f"Aula #{aula_id} nao encontrada!")
            return None

        estado_atual = aula[0]
        mentor_aula_id = aula[1]
        tema = aula[2]
        data_hora = aula[3]
        mentor_nome = aula[4]
        turma_nome = aula[5]

        # 2. Validar se o mentor que está a recusar é o mentor da aula
        if mentor_aula_id != mentor_id:
            logger.error(f"Mentor #{mentor_id} nao esta atribuido a esta aula! Esta aula esta atribuida ao mentor #{mentor_aula_id}")
            return None

        # 3. Validar se a aula está em estado "pendente"
        if estado_atual != "pendente":
            logger.error(f"Aula nao esta pendente! Estado atual: '{estado_atual}'. So podes recusar aulas com estado 'pendente'")
            return None
        
        # 4. Atualizar estado para "recusada"
        nota_recusa = f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Recusada por {mentor_nome}"
        nota_recusa += f" | MOTIVO: {motivo}"
        
        query_update = """
            UPDATE aulas
            SET estado = 'recusada',
                observacoes = COALESCE(observacoes || E'\n', '') || %s,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = %s;
        """
        
        cur.execute(query_update, (nota_recusa, aula_id))
        
        # 5. Criar log da recusa
        descricao_log = f"Aula #{aula_id} RECUSADA"
        if tema:
            descricao_log += f" (Tema: {tema})"
        descricao_log += f" | Turma: {turma_nome} | Data: {data_hora}"
        descricao_log += f" | MOTIVO: {motivo}"
        
        dados_adicionais = f"Estado anterior: {estado_atual} | Motivo: {motivo}"
        
        # Commit das alterações
        conn.commit()
        
        # Criar log
        log_id = criar_log(
            tipo_acao='recusar',
            entidade='aula',
            entidade_id=aula_id,
            descricao=descricao_log,
            usuario=mentor_nome,
            dados_adicionais=dados_adicionais
        )
        
        # NOTIFICAR COORDENAÇÃO SOBRE A RECUSA
        try:
            from services import excecoes_service
            
            logger.info("A notificar coordenacao sobre recusa...")

            resultado_notificacao = excecoes_service.notificar_aula_recusada(
                aula_id=aula_id,
                mentor_nome=mentor_nome,
                turma_nome=turma_nome,
                data_hora=data_hora,
                motivo=motivo
            )

            if resultado_notificacao['sucesso']:
                logger.info(f"Coordenacao notificada (Log #{resultado_notificacao['log_id']})")
                if resultado_notificacao['slack_enviado']:
                    logger.info("Alerta Slack enviado")

        except ImportError:
            logger.warning("Modulo excecoes_service nao encontrado")
        except Exception as e:
            logger.warning(f"Erro ao notificar coordenacao: {e}")
            # Não interrompe o fluxo - recusa continua mesmo se notificação falhar
        
        logger.warning(f"Aula #{aula_id} RECUSADA! Mentor: {mentor_nome}, Turma: {turma_nome}, Data/Hora: {data_hora}, Motivo: {motivo}")
        logger.info("Proximos passos: Atribuir outro mentor ou remarcar a aula para outra data")
        
        # Enviar notificação Slack
        try:
            from notifications import slack_service
            
            slack_service.notificar_aula_recusada(
                aula_id=aula_id,
                mentor_nome=mentor_nome,
                turma_nome=turma_nome,
                data_hora=data_hora,
                motivo=motivo
            )
        except Exception as e:
            logger.warning(f"Erro ao enviar notificacao Slack: {e}")

        return {
            'sucesso': True,
            'aula_id': aula_id,
            'estado_anterior': estado_atual,
            'estado_novo': 'recusada',
            'mentor_nome': mentor_nome,
            'turma_nome': turma_nome,
            'motivo': motivo,
            'log_id': log_id
        }
        
    except Exception as e:
        logger.error(f"Erro ao recusar aula: {e}")
        if conn:
            conn.rollback()
        return None
        
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


# ==============================================================================
# FUNÇÃO 3: VER LOGS DE UMA AULA
# ==============================================================================

def ver_logs_aula(aula_id):
    """
    Mostra todo o histórico de logs de uma aula específica.
    
    Útil para ver o que aconteceu com a aula:
    - Quando foi criada
    - Quem confirmou/recusou
    - Mudanças de estado
    - Etc.
    
    Parâmetros:
        aula_id (int): ID da aula
    
    Retorna:
        list: Lista de logs ordenados por data (mais recente primeiro)
    """
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = """
            SELECT 
                id,
                tipo_acao,
                descricao,
                usuario,
                dados_adicionais,
                criado_em
            FROM logs
            WHERE entidade = 'aula' AND entidade_id = %s
            ORDER BY criado_em DESC;
        """
        
        cur.execute(query, (aula_id,))
        resultados = cur.fetchall()
        
        if not resultados:
            logger.info(f"Nenhum log encontrado para aula #{aula_id}")
            return []
        
        logs = []
        for row in resultados:
            log = {
                'id': row[0],
                'tipo_acao': row[1],
                'descricao': row[2],
                'usuario': row[3],
                'dados_adicionais': row[4],
                'criado_em': row[5]
            }
            logs.append(log)
        
        cur.close()
        conn.close()
        
        return logs
        
    except Exception as e:
        logger.error(f"Erro ao buscar logs: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def mostrar_logs_aula(aula_id):
    """
    Mostra os logs de forma formatada e legível.
    """
    
    logger.info(f"HISTORICO DE LOGS - Aula #{aula_id}")

    logs = ver_logs_aula(aula_id)

    if not logs:
        logger.info("Nenhuma acao registada ainda.")
        return

    for i, log in enumerate(logs, 1):
        logger.info(f"{i}. {log['tipo_acao'].upper()} | Data: {log['criado_em']} | Descricao: {log['descricao']}" +
                     (f" | Por: {log['usuario']}" if log['usuario'] else "") +
                     (f" | Detalhes: {log['dados_adicionais']}" if log['dados_adicionais'] else ""))


# ==============================================================================
# FUNÇÃO 4: LISTAR AULAS QUE PRECISAM DE CONFIRMAÇÃO
# ==============================================================================

def listar_aulas_pendentes_mentor(mentor_id):
    """
    Lista todas as aulas pendentes atribuídas a um mentor específico.
    
    Útil para o mentor ver quais aulas precisa confirmar ou recusar.
    
    Parâmetros:
        mentor_id (int): ID do mentor
    
    Retorna:
        list: Lista de aulas pendentes
    """
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = """
            SELECT 
                a.id,
                a.tipo,
                a.data_hora,
                a.duracao_minutos,
                a.local,
                a.tema,
                t.nome as turma_nome,
                e.nome as estabelecimento_nome,
                a.criado_em
            FROM aulas a
            JOIN turmas t ON a.turma_id = t.id
            JOIN estabelecimentos e ON t.estabelecimento_id = e.id
            WHERE a.mentor_id = %s 
            AND a.estado = 'pendente'
            ORDER BY a.data_hora ASC;
        """
        
        cur.execute(query, (mentor_id,))
        resultados = cur.fetchall()
        
        aulas = []
        for row in resultados:
            aula = {
                'id': row[0],
                'tipo': row[1],
                'data_hora': row[2],
                'duracao_minutos': row[3],
                'local': row[4],
                'tema': row[5],
                'turma_nome': row[6],
                'estabelecimento_nome': row[7],
                'criado_em': row[8]
            }
            aulas.append(aula)
        
        cur.close()
        conn.close()
        
        logger.info(f"{len(aulas)} aula(s) pendente(s) de confirmacao")
        
        return aulas
        
    except Exception as e:
        logger.error(f"Erro ao listar aulas pendentes: {e}")
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
    Exemplos de como usar as funções.
    Execute: python services/confirmacao_service.py
    """
    
    logger.info("TESTE DO SERVICO DE CONFIRMACAO")
    logger.info("Funcoes disponiveis: 1. confirmar_aula(aula_id, mentor_id, observacao) 2. recusar_aula(aula_id, mentor_id, motivo) 3. ver_logs_aula(aula_id) 4. listar_aulas_pendentes_mentor(mentor_id)")
    logger.info("Para usar, cria aulas primeiro e testa as funcoes!")
    
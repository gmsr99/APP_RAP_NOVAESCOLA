import sys
import os
from datetime import date, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.connection import get_db_connection
import logging

logger = logging.getLogger(__name__)

# Dias de deadline automática por fase (apenas estados com responsável atribuído)
FASE_DEADLINES_DIAS = {
    'gravação': 3,
    'edição': 2,
    'mistura_wip': 3,
    'feedback_wip': 2,
    'finalização_wip': 3,
}

def _calcular_fase_deadline(estado: str):
    """Retorna a data de deadline para o estado, ou None se for pool."""
    dias = FASE_DEADLINES_DIAS.get(estado)
    if dias is None:
        return None
    return date.today() + timedelta(days=dias)

def _buscar_users_por_roles(roles: list) -> list:
    """Retorna lista de user_id com os roles indicados."""
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        placeholders = ','.join(['%s'] * len(roles))
        cur.execute(f"SELECT id FROM profiles WHERE role IN ({placeholders})", roles)
        return [str(row[0]) for row in cur.fetchall()]
    except Exception as e:
        logger.error("Erro ao buscar users por role: %s", e)
        return []
    finally:
        if cur: cur.close()
        if conn: conn.close()

def _notificar_users(user_ids: list, tipo: str, titulo: str, mensagem: str, link: str = '/producao'):
    """Envia notificação in-app + push a uma lista de utilizadores."""
    try:
        from services.notification_service import criar_notificacao
        for uid in user_ids:
            criar_notificacao(uid, tipo, titulo, mensagem, link)
    except Exception as e:
        logger.warning("Erro ao notificar users: %s", e)

def listar_musicas(arquivadas=False, user_id=None, role=None, projeto_id=None):
    """
    Lista todas as músicas, com suporte a filtros.

    Args:
        arquivadas (bool): Se True, lista apenas as arquivadas.
        user_id (str): ID do utilizador atual (opcional).
        role (str): Role do utilizador atual (opcional).
        projeto_id (int): Filtrar por projeto (opcional).
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        conditions = ["m.arquivado = %s"]
        params = [arquivadas]
        if projeto_id:
            conditions.append("""(
                m.projeto_id = %s
                OR (m.projeto_id IS NULL AND t.estabelecimento_id IN (
                    SELECT estabelecimento_id FROM projeto_estabelecimentos WHERE projeto_id = %s
                ))
            )""")
            params.extend([projeto_id, projeto_id])

        query = f"""
            SELECT
                m.id, m.titulo, m.estado, COALESCE(NULLIF(m.disciplina, ''), disc.nome) as disciplina,
                m.arquivado, m.criado_em,
                t.id as turma_id, t.nome as turma_nome,
                e.nome as estabelecimento_nome,
                m.responsavel_id, p_resp.full_name as responsavel_nome,
                m.criador_id, p_criador.full_name as criador_nome,
                m.feedback,
                m.link_demo,
                m.misturado_por_id, p_mist.full_name as misturado_por_nome,
                m.revisto_por_id, p_rev.full_name as revisto_por_nome,
                m.finalizado_por_id, p_fin.full_name as finalizado_por_nome,
                m.deadline,
                m.notas,
                m.projeto_id,
                m.fase_deadline
            FROM musicas m
            LEFT JOIN turmas t ON m.turma_id = t.id
            LEFT JOIN estabelecimentos e ON t.estabelecimento_id = e.id
            LEFT JOIN turma_disciplinas disc ON disc.id = m.disciplina_id
            LEFT JOIN profiles p_resp ON m.responsavel_id = p_resp.id
            LEFT JOIN profiles p_criador ON m.criador_id = p_criador.id
            LEFT JOIN profiles p_mist ON m.misturado_por_id = p_mist.id
            LEFT JOIN profiles p_rev ON m.revisto_por_id = p_rev.id
            LEFT JOIN profiles p_fin ON m.finalizado_por_id = p_fin.id
            WHERE {" AND ".join(conditions)}
            ORDER BY m.criado_em DESC
        """

        cur.execute(query, params)
        musicas = cur.fetchall()
        
        resultado = []
        for row in musicas:
            resultado.append({
                'id': row[0],
                'titulo': row[1],
                'estado': row[2],
                'disciplina': row[3],
                'arquivado': row[4],
                'criado_em': row[5].isoformat() if row[5] else None,
                'turma': {
                    'id': row[6],
                    'nome': row[7],
                    'estabelecimento': row[8]
                } if row[6] else None,
                'responsavel': {
                    'id': row[9],
                    'nome': row[10]
                } if row[9] else None,
                'criador': {
                    'id': row[11],
                    'nome': row[12]
                } if row[11] else None,
                'feedback': row[13],
                'link_demo': row[14],
                'misturado_por': {
                    'id': row[15],
                    'nome': row[16]
                } if row[15] else None,
                'revisto_por': {
                    'id': row[17],
                    'nome': row[18]
                } if row[17] else None,
                'finalizado_por': {
                    'id': row[19],
                    'nome': row[20]
                } if row[19] else None,
                'deadline': row[21].isoformat() if row[21] else None,
                'notas': row[22],
                'projeto_id': row[23],
                'fase_deadline': row[24].isoformat() if row[24] else None,
            })
            
        return resultado
    except Exception as e:
        logger.error(f"Erro ao listar músicas: {e}")
        return []
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def criar_musica(dados, criador_id, criador_role=None):
    """
    Cria uma nova música.
    - Se criador é MENTOR: Estado inicial 'gravação', Responsável = Criador (Fase A)
    - Se criador é PRODUTOR: Estado inicial 'pool_mistura', Responsável = None (Salta para Fase B)
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Usar role do JWT; apenas consultar profiles como fallback
        if not criador_role:
            cur.execute("SELECT role FROM profiles WHERE id = %s", (criador_id,))
            role_row = cur.fetchone()
            criador_role = role_row[0] if role_row else 'mentor'

        # Lógica de estado inicial baseada no role
        if criador_role == 'produtor' or criador_role == 'mentor_produtor':
            # Produtores saltam a Fase A (Mentor) e vão direto para Fase B (Pool Mistura)
            estado_inicial = 'pool_mistura'
            responsavel_inicial = None
        else:
            # Mentores/Coordenadores começam na Fase A (Gravação)
            estado_inicial = 'gravação'
            responsavel_inicial = criador_id
        
        # Se disciplina_id fornecido, resolver o nome da disciplina para o campo texto
        disciplina_texto = dados.get('disciplina')
        disciplina_id = dados.get('disciplina_id')
        if disciplina_id and not disciplina_texto:
            cur.execute("SELECT nome FROM turma_disciplinas WHERE id = %s", (disciplina_id,))
            d_row = cur.fetchone()
            if d_row:
                disciplina_texto = d_row[0]

        fase_dl_inicial = _calcular_fase_deadline(estado_inicial)
        cur.execute("""
            INSERT INTO musicas (titulo, turma_id, disciplina, disciplina_id, estado, criador_id, responsavel_id, projeto_id, fase_deadline)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (dados['titulo'], dados['turma_id'], disciplina_texto, disciplina_id, estado_inicial, criador_id, responsavel_inicial, dados.get('projeto_id'), fase_dl_inicial))
        
        new_id = cur.fetchone()[0]
        conn.commit()
        
        return {'id': new_id, 'message': 'Música criada com sucesso'}
    except Exception as e:
        logger.error(f"Erro ao criar música: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def avancar_fase(musica_id, user_id, dados=None):
    """
    Avança a música para a próxima fase na máquina de estados.
    Lógica complexa de transição de estados.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Obter estado atual, responsável e título
        cur.execute("SELECT estado, responsavel_id, titulo FROM musicas WHERE id = %s", (musica_id,))
        row = cur.fetchone()

        if not row:
            return False, "Música não encontrada"

        estado_atual = row[0]
        responsavel_atual = row[1]
        titulo_musica = row[2]

        # Validar permissão (Apenas o responsável atual pode avançar, exceto se for Pool)
        if responsavel_atual and str(responsavel_atual) != str(user_id):
            return False, "Apenas o responsável atual pode avançar a fase."

        novo_estado = None
        novo_responsavel = None # Se None, vai para Pool

        # --- MÁQUINA DE ESTADOS ---

        # 1. Mentor: Gravação -> Edição (Responsável mantém-se Mentor)
        if estado_atual == 'gravação':
            novo_estado = 'edição'
            novo_responsavel = user_id
            fase_dl = _calcular_fase_deadline(novo_estado)
            cur.execute("UPDATE musicas SET estado = %s, responsavel_id = %s, fase_deadline = %s, updated_at = NOW() WHERE id = %s",
                       (novo_estado, novo_responsavel, fase_dl, musica_id))

        # 2. Mentor: Edição -> Pool Mistura (Liberta para Produtores)
        elif estado_atual == 'edição':
            novo_estado = 'pool_mistura'
            novo_responsavel = None
            cur.execute("UPDATE musicas SET estado = %s, responsavel_id = %s, fase_deadline = NULL, updated_at = NOW() WHERE id = %s",
                       (novo_estado, novo_responsavel, musica_id))

        # 3. Produtor: Mistura WIP -> Pool Feedback (Liberta para Coordenadores)
        elif estado_atual == 'mistura_wip':
            novo_estado = 'pool_feedback'
            novo_responsavel = None
            cur.execute("UPDATE musicas SET estado = %s, responsavel_id = %s, misturado_por_id = %s, fase_deadline = NULL, updated_at = NOW() WHERE id = %s",
                       (novo_estado, novo_responsavel, user_id, musica_id))

        # 4. Coordenador: Feedback WIP -> Pool Finalização (Envia feedback e liberta para Produtores)
        elif estado_atual == 'feedback_wip':
            novo_estado = 'pool_finalização'
            novo_responsavel = None
            feedback_texto = dados.get('feedback') if dados else None
            if feedback_texto:
                cur.execute("UPDATE musicas SET estado = %s, responsavel_id = %s, revisto_por_id = %s, feedback = %s, fase_deadline = NULL, updated_at = NOW() WHERE id = %s",
                           (novo_estado, novo_responsavel, user_id, feedback_texto, musica_id))
            else:
                cur.execute("UPDATE musicas SET estado = %s, responsavel_id = %s, revisto_por_id = %s, fase_deadline = NULL, updated_at = NOW() WHERE id = %s",
                           (novo_estado, novo_responsavel, user_id, musica_id))

        # 5. Produtor: Finalização WIP -> Concluído
        elif estado_atual == 'finalização_wip':
            novo_estado = 'concluído'
            novo_responsavel = None
            cur.execute("UPDATE musicas SET estado = %s, responsavel_id = %s, finalizado_por_id = %s, fase_deadline = NULL, updated_at = NOW() WHERE id = %s",
                       (novo_estado, novo_responsavel, user_id, musica_id))

        else:
            return False, f"Transição inválida a partir de '{estado_atual}' via 'avançar'."

        conn.commit()
        cur.close()
        conn.close()

        # --- NOTIFICAÇÕES PÓS-TRANSIÇÃO (fora da transação, em background) ---
        _notificar_transicao(musica_id, titulo_musica, estado_atual, novo_estado, user_id)

        return True, f"Fase avançada para {novo_estado}"

    except Exception as e:
        logger.error(f"Erro ao avançar fase: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False, str(e)
    finally:
        if 'cur' in locals() and cur:
            try: cur.close()
            except Exception: pass
        if 'conn' in locals() and conn:
            try: conn.close()
            except Exception: pass


def _notificar_transicao(musica_id, titulo_musica, _estado_anterior, novo_estado, user_id):
    """Envia notificações relevantes após cada transição de fase."""
    try:
        link = '/producao'

        if novo_estado == 'pool_mistura':
            # Notificar todos os produtores: nova música disponível
            uids = _buscar_users_por_roles(['produtor', 'mentor_produtor'])
            _notificar_users(
                uids, 'producao_pool',
                f'Nova música para mistura',
                f'"{titulo_musica}" está disponível para mistura no laboratório.',
                link
            )

        elif novo_estado == 'pool_feedback':
            # Notificar coordenadores e mentores: mistura pronta para feedback
            uids = _buscar_users_por_roles(['coordenador', 'mentor', 'mentor_produtor'])
            _notificar_users(
                uids, 'producao_pool',
                f'Música pronta para feedback',
                f'"{titulo_musica}" foi misturada e aguarda revisão/feedback.',
                link
            )

        elif novo_estado == 'pool_finalização':
            # Notificar todos os produtores: música com feedback, pronta para finalização
            uids = _buscar_users_por_roles(['produtor', 'mentor_produtor'])
            _notificar_users(
                uids, 'producao_pool',
                f'Nova música para finalização',
                f'"{titulo_musica}" tem feedback e está disponível para finalização.',
                link
            )

        elif novo_estado == 'concluído':
            # Notificar o criador da música
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                cur.execute("SELECT criador_id FROM musicas WHERE id = %s", (musica_id,))
                row = cur.fetchone()
                cur.close()
                conn.close()
                if row and row[0] and str(row[0]) != str(user_id):
                    _notificar_users(
                        [str(row[0])], 'producao_concluido',
                        f'Música concluída!',
                        f'"{titulo_musica}" foi finalizada com sucesso.',
                        link
                    )
            except Exception as e:
                logger.warning("Erro ao notificar criador na conclusão: %s", e)

    except Exception as e:
        logger.warning("Erro em _notificar_transicao: %s", e)

def aceitar_tarefa(musica_id, user_id):
    """
    Permite a um utilizador 'pegar' numa música que está numa Pool.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT estado, responsavel_id FROM musicas WHERE id = %s", (musica_id,))
        row = cur.fetchone()

        if not row: return False, "Música não encontrada"

        estado_atual = row[0]
        responsavel_atual = row[1]

        if responsavel_atual is not None:
            return False, "Esta música já tem um responsável atribuído."

        novo_estado = None

        if estado_atual == 'pool_mistura':
            novo_estado = 'mistura_wip'
        elif estado_atual == 'pool_feedback':
            novo_estado = 'feedback_wip'
        elif estado_atual == 'pool_finalização':
            novo_estado = 'finalização_wip'
        else:
            return False, "Esta música não está numa pool de tarefas disponível."

        fase_dl = _calcular_fase_deadline(novo_estado)
        cur.execute(
            "UPDATE musicas SET estado = %s, responsavel_id = %s, fase_deadline = %s, updated_at = NOW() WHERE id = %s",
            (novo_estado, user_id, fase_dl, musica_id)
        )
        conn.commit()
        return True, f"Tarefa aceite! Estado: {novo_estado}"

    except Exception as e:
        logger.error(f"Erro ao aceitar tarefa: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False, str(e)
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def atualizar_detalhes(musica_id, dados):
    """Atualiza campos editáveis da música (deadline, notas, link_demo, titulo, turma_id, disciplina_id)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        campos = []
        valores = []
        for campo in ('deadline', 'notas', 'link_demo', 'titulo', 'turma_id'):
            if campo in dados:
                campos.append(f"{campo} = %s")
                valores.append(dados[campo])
        # Se disciplina_id fornecido, atualiza também o campo texto disciplina
        if 'disciplina_id' in dados:
            campos.append("disciplina_id = %s")
            valores.append(dados['disciplina_id'])
            cur.execute("SELECT nome FROM disciplinas WHERE id = %s", (dados['disciplina_id'],))
            row = cur.fetchone()
            if row:
                campos.append("disciplina = %s")
                valores.append(row[0])
        if not campos:
            return False
        valores.append(musica_id)
        cur.execute(
            f"UPDATE musicas SET {', '.join(campos)}, updated_at = NOW() WHERE id = %s",
            valores
        )
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Erro ao atualizar detalhes: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def atualizar_estado(musica_id, novo_estado):
    """Atualiza o estado de uma música diretamente (uso admin)."""
    ESTADOS_VALIDOS = {
        'gravação', 'edição', 'pool_mistura', 'mistura_wip',
        'pool_feedback', 'feedback_wip', 'pool_finalização', 'finalização_wip', 'concluído'
    }
    if novo_estado not in ESTADOS_VALIDOS:
        return False, f"Estado inválido: '{novo_estado}'"
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE musicas SET estado = %s, updated_at = NOW() WHERE id = %s RETURNING id",
            (novo_estado, musica_id)
        )
        updated = cur.fetchone()
        conn.commit()
        if not updated:
            return False, "Música não encontrada."
        return True, f"Estado atualizado para '{novo_estado}'."
    except Exception as e:
        logger.error(f"Erro ao atualizar estado: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False, str(e)
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def arquivar_musica(musica_id):
    """Arquiva uma música."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE musicas SET arquivado = TRUE, updated_at = NOW() WHERE id = %s RETURNING id",
            (musica_id,)
        )
        updated = cur.fetchone()
        conn.commit()
        if not updated:
            return False, "Música não encontrada."
        return True, "Música arquivada."
    except Exception as e:
        logger.error(f"Erro ao arquivar música: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False, str(e)
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def desarquivar_musica(musica_id):
    """Desarquiva uma música."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "UPDATE musicas SET arquivado = FALSE, updated_at = NOW() WHERE id = %s RETURNING id",
            (musica_id,)
        )
        updated = cur.fetchone()
        conn.commit()
        if not updated:
            return False, "Música não encontrada."
        return True, "Música desarquivada."
    except Exception as e:
        logger.error(f"Erro ao desarquivar música: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False, str(e)
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def apagar_musica(musica_id):
    """Apaga permanentemente uma música e todas as suas aulas associadas."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM musicas WHERE id = %s RETURNING id", (musica_id,))
        deleted = cur.fetchone()
        conn.commit()
        return deleted is not None
    except Exception as e:
        logger.error(f"Erro ao apagar música: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def verificar_e_notificar_deadlines():
    """
    Verifica músicas em atraso (fase_deadline < hoje) e notifica o responsável.
    Deve ser chamada periodicamente (ex: cron diário).
    Retorna o número de notificações enviadas.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT m.id, m.titulo, m.estado, m.responsavel_id, p.full_name
            FROM musicas m
            LEFT JOIN profiles p ON p.id = m.responsavel_id
            WHERE m.fase_deadline < CURRENT_DATE
              AND m.arquivado = FALSE
              AND m.estado NOT IN ('concluído', 'pool_mistura', 'pool_feedback', 'pool_finalização')
              AND m.responsavel_id IS NOT NULL
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()

        from services.notification_service import criar_notificacao
        count = 0
        for row in rows:
            musica_id, titulo, estado, responsavel_id, _ = row
            criar_notificacao(
                str(responsavel_id),
                'producao_atraso',
                f'Tarefa em atraso: {titulo}',
                f'A fase "{estado}" de "{titulo}" ultrapassou a deadline. Por favor, conclui o trabalho.',
                '/producao'
            )
            count += 1
        logger.info("verificar_e_notificar_deadlines: %s notificações enviadas", count)
        return count
    except Exception as e:
        logger.error("Erro em verificar_e_notificar_deadlines: %s", e)
        return 0


def listar_stats_instituicao(projeto_id=None):
    """Stats de progresso agrupados por estabelecimento > turma."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        estab_filter = ""
        params = []
        if projeto_id:
            estab_filter = "JOIN projeto_estabelecimentos pe ON pe.estabelecimento_id = e.id AND pe.projeto_id = %s"
            params.append(projeto_id)

        cur.execute(f"""
            SELECT
                e.id as estab_id,
                e.nome as estab_nome,
                t.id as turma_id,
                t.nome as turma_nome,
                COALESCE(ta_agg.horas_previstas, 0) as horas_previstas,
                td.id as disciplina_id,
                td.nome as disciplina_nome,
                COALESCE(td.musicas_previstas, t.musicas_previstas, 7) as musicas_previstas,
                COALESCE(sess.horas_realizadas, 0) as horas_realizadas,
                COALESCE(sess.sessoes_realizadas, 0) as sessoes_realizadas,
                COALESCE(mus.em_curso, 0) as musicas_em_curso,
                COALESCE(mus.concluidas, 0) as musicas_concluidas,
                COALESCE(ta_agg.sessoes_previstas_total, 0) as sessoes_previstas_total
            FROM estabelecimentos e
            {estab_filter}
            JOIN turmas t ON t.estabelecimento_id = e.id
            LEFT JOIN turma_disciplinas td ON td.turma_id = t.id
            LEFT JOIN LATERAL (
                SELECT
                    COALESCE(SUM(ta.sessoes_previstas * ta.horas_por_sessao), 0) as horas_previstas,
                    COALESCE(SUM(ta.sessoes_previstas), 0) as sessoes_previstas_total
                FROM turma_atividades ta
                WHERE ta.turma_disciplina_id = td.id
                  AND ta.is_autonomous = FALSE
            ) ta_agg ON true
            LEFT JOIN LATERAL (
                SELECT ROUND(SUM(COALESCE(a.duracao_minutos, 0)) / 60.0) as horas_realizadas,
                       COUNT(*) as sessoes_realizadas
                FROM aulas a
                WHERE a.turma_id = t.id
                  AND a.estado = 'terminada'
                  AND a.is_autonomous = FALSE
                  AND (
                      td.id IS NULL
                      OR a.atividade_uuid IN (
                          SELECT uuid FROM turma_atividades WHERE turma_disciplina_id = td.id
                      )
                      OR (a.atividade_uuid IS NULL AND td.id = (
                          SELECT MIN(id) FROM turma_disciplinas WHERE turma_id = t.id
                      ))
                  )
                  {'AND (a.projeto_id = %s OR a.projeto_id IS NULL)' if projeto_id else ''}
            ) sess ON true
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*) FILTER (WHERE m.estado != 'concluído') as em_curso,
                    COUNT(*) FILTER (WHERE m.estado = 'concluído') as concluidas
                FROM musicas m
                WHERE m.turma_id = t.id AND m.arquivado = FALSE
                  {'AND (m.projeto_id = %s OR m.projeto_id IS NULL)' if projeto_id else ''}
            ) mus ON true
            ORDER BY e.nome, t.nome, td.nome NULLS FIRST
        """, params + ([projeto_id] if projeto_id else []) + ([projeto_id] if projeto_id else []))
        rows = cur.fetchall()

        estabs = {}
        for row in rows:
            eid = row[0]
            if eid not in estabs:
                estabs[eid] = {
                    'estabelecimento_id': eid,
                    'estabelecimento_nome': row[1],
                    'turmas': []
                }
            estabs[eid]['turmas'].append({
                'turma_id': row[2],
                'turma_nome': row[3],
                'horas_previstas': float(row[4]) if row[4] is not None else None,
                'disciplina_id': row[5],
                'disciplina_nome': row[6],
                'musicas_previstas': row[7],
                'horas_realizadas': float(row[8]) if row[8] is not None else 0,
                'sessoes_realizadas': row[9],
                'musicas_em_curso': row[10],
                'musicas_concluidas': row[11],
                'sessoes_previstas': int(row[12]) if row[12] is not None else 0,
            })

        return list(estabs.values())
    except Exception as e:
        logger.error(f"Erro ao listar stats instituição: {e}")
        return []
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def listar_stats_equipa(projeto_id=None):
    """Stats de músicas agrupados por membro da equipa (responsável ou criador)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        conditions = ["m.arquivado = FALSE", "m.estado != 'concluído'"]
        params = []
        if projeto_id:
            conditions.append("m.projeto_id = %s")
            params.append(projeto_id)

        cur.execute(f"""
            SELECT
                COALESCE(m.responsavel_id, m.criador_id) as user_id,
                COALESCE(p.full_name, split_part(p.email, '@', 1)) as nome,
                m.id, m.titulo, m.estado,
                t.nome as turma_nome,
                e.nome as estab_nome
            FROM musicas m
            LEFT JOIN profiles p ON p.id = COALESCE(m.responsavel_id, m.criador_id)
            LEFT JOIN turmas t ON m.turma_id = t.id
            LEFT JOIN estabelecimentos e ON t.estabelecimento_id = e.id
            WHERE {" AND ".join(conditions)}
            ORDER BY p.full_name, m.criado_em DESC
        """, params)
        rows = cur.fetchall()

        membros = {}
        for row in rows:
            uid = row[0]
            if not uid:
                continue
            if uid not in membros:
                membros[uid] = {
                    'user_id': uid,
                    'nome': row[1],
                    'musicas': []
                }
            membros[uid]['musicas'].append({
                'id': row[2],
                'titulo': row[3],
                'estado': row[4],
                'turma_nome': row[5],
                'estabelecimento_nome': row[6],
            })

        resultado = list(membros.values())
        for m in resultado:
            m['musicas_atribuidas'] = len(m['musicas'])
        return resultado
    except Exception as e:
        logger.error(f"Erro ao listar stats equipa: {e}")
        return []
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

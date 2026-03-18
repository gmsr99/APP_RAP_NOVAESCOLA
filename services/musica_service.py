import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.connection import get_db_connection
import logging

logger = logging.getLogger(__name__)

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
                m.projeto_id
            FROM musicas m
            LEFT JOIN turmas t ON m.turma_id = t.id
            LEFT JOIN estabelecimentos e ON t.estabelecimento_id = e.id
            LEFT JOIN disciplinas disc ON disc.id = m.disciplina_id
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
                'projeto_id': row[23]
            })
            
        return resultado
    except Exception as e:
        logger.error(f"Erro ao listar músicas: {e}")
        return []
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def criar_musica(dados, criador_id):
    """
    Cria uma nova música.
    - Se criador é MENTOR: Estado inicial 'gravação', Responsável = Criador (Fase A)
    - Se criador é PRODUTOR: Estado inicial 'pool_mistura', Responsável = None (Salta para Fase B)
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Verificar role do criador
        cur.execute("SELECT role FROM profiles WHERE id = %s", (criador_id,))
        role_row = cur.fetchone()
        
        if not role_row:
            return None
            
        criador_role = role_row[0]
        
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
            cur.execute("SELECT nome FROM disciplinas WHERE id = %s", (disciplina_id,))
            d_row = cur.fetchone()
            if d_row:
                disciplina_texto = d_row[0]

        cur.execute("""
            INSERT INTO musicas (titulo, turma_id, disciplina, disciplina_id, estado, criador_id, responsavel_id, projeto_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (dados['titulo'], dados['turma_id'], disciplina_texto, disciplina_id, estado_inicial, criador_id, responsavel_inicial, dados.get('projeto_id')))
        
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
        
        # Obter estado atual e responsável
        cur.execute("SELECT estado, responsavel_id FROM musicas WHERE id = %s", (musica_id,))
        row = cur.fetchone()
        
        if not row:
            return False, "Música não encontrada"
            
        estado_atual = row[0]
        responsavel_atual = row[1]
        
        # Validar permissão (Apenas o responsável atual pode avançar, exceto se for Pool)
        # Nota: UUIDs vêm como strings do Supabase/Auth geralmente, confirmar se o DB retorna string ou UUID obj
        if responsavel_atual and str(responsavel_atual) != str(user_id):
            return False, "Apenas o responsável atual pode avançar a fase."

        novo_estado = None
        novo_responsavel = None # Se None, vai para Pool
        
        # --- MÁQUINA DE ESTADOS ---
        
        # 1. Mentor: Gravação -> Edição (Responsável mantém-se Mentor)
        # FASE A -> FASE A
        if estado_atual == 'gravação':
            novo_estado = 'edição'
            novo_responsavel = user_id 
            cur.execute("UPDATE musicas SET estado = %s, responsavel_id = %s, updated_at = NOW() WHERE id = %s",
                       (novo_estado, novo_responsavel, musica_id))
            
        # 2. Mentor: Edição -> Pool Mistura (Liberta para Produtores)
        # FASE A -> FASE B
        elif estado_atual == 'edição':
            novo_estado = 'pool_mistura'
            novo_responsavel = None 
            cur.execute("UPDATE musicas SET estado = %s, responsavel_id = %s, updated_at = NOW() WHERE id = %s",
                       (novo_estado, novo_responsavel, musica_id))
            
        # 3. Produtor: Mistura WIP -> Pool Feedback (Liberta para Coordenadores)
        # FASE B -> FASE C
        elif estado_atual == 'mistura_wip':
            novo_estado = 'pool_feedback'
            novo_responsavel = None
            # TRACKING: Quem misturou? O user atual.
            cur.execute("UPDATE musicas SET estado = %s, responsavel_id = %s, misturado_por_id = %s, updated_at = NOW() WHERE id = %s",
                       (novo_estado, novo_responsavel, user_id, musica_id))
            
        # 4. Coordenador: Feedback WIP -> Pool Finalização (Envia feedback e liberta para Produtores)
        # FASE C -> FASE D
        elif estado_atual == 'feedback_wip':
            novo_estado = 'pool_finalização'
            novo_responsavel = None
            feedback_texto = dados.get('feedback') if dados else None
            
            # TRACKING: Quem reviu? O user atual.
            if feedback_texto:
                cur.execute("UPDATE musicas SET estado = %s, responsavel_id = %s, revisto_por_id = %s, feedback = %s, updated_at = NOW() WHERE id = %s",
                           (novo_estado, novo_responsavel, user_id, feedback_texto, musica_id))
            else:
                 cur.execute("UPDATE musicas SET estado = %s, responsavel_id = %s, revisto_por_id = %s, updated_at = NOW() WHERE id = %s",
                           (novo_estado, novo_responsavel, user_id, musica_id))

        # 5. Produtor: Finalização WIP -> Concluído
        # FASE D -> FIM
        elif estado_atual == 'finalização_wip':
            novo_estado = 'concluído'
            novo_responsavel = None # Sistema/Arquivo
            # TRACKING: Quem finalizou? O user atual.
            cur.execute("UPDATE musicas SET estado = %s, responsavel_id = %s, finalizado_por_id = %s, updated_at = NOW() WHERE id = %s",
                       (novo_estado, novo_responsavel, user_id, musica_id))
            
        else:
            return False, f"Transição inválida a partir de '{estado_atual}' via 'avançar'."
            
        conn.commit()
        
        return True, f"Fase avançada para {novo_estado}"
        
    except Exception as e:
        logger.error(f"Erro ao avançar fase: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False, str(e)
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

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
        
        # --- LÓGICA DE CLAIM ---
        if estado_atual == 'pool_mistura':
            novo_estado = 'mistura_wip'
        elif estado_atual == 'pool_feedback':
            novo_estado = 'feedback_wip'
        elif estado_atual == 'pool_finalização':
            novo_estado = 'finalização_wip' # Corrigido para match com frontend/db enum se houver
        else:
            return False, "Esta música não está numa pool de tarefas disponível."
            
        cur.execute(
            "UPDATE musicas SET estado = %s, responsavel_id = %s, updated_at = NOW() WHERE id = %s",
            (novo_estado, user_id, musica_id)
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
                  AND (td.id IS NULL OR a.atividade_uuid IN (
                      SELECT uuid FROM turma_atividades WHERE turma_disciplina_id = td.id
                  ))
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

import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.connection import get_db_connection

def listar_musicas(arquivadas=False, user_id=None, role=None):
    """
    Lista todas as músicas, com suporte a filtros.
    
    Args:
        arquivadas (bool): Se True, lista apenas as arquivadas.
        user_id (str): ID do utilizador atual (opcional, para filtros futuros).
        role (str): Role do utilizador atual (opcional).
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = """
            SELECT 
                m.id, m.titulo, m.estado, m.disciplina, m.arquivado, m.criado_em,
                t.id as turma_id, t.nome as turma_nome,
                e.nome as estabelecimento_nome,
                m.responsavel_id, p_resp.full_name as responsavel_nome,
                m.criador_id, p_criador.full_name as criador_nome,
                m.feedback,
                m.link_demo,
                m.misturado_por_id, p_mist.full_name as misturado_por_nome,
                m.revisto_por_id, p_rev.full_name as revisto_por_nome,
                m.finalizado_por_id, p_fin.full_name as finalizado_por_nome
            FROM musicas m
            LEFT JOIN turmas t ON m.turma_id = t.id
            LEFT JOIN estabelecimentos e ON t.estabelecimento_id = e.id
            LEFT JOIN profiles p_resp ON m.responsavel_id = p_resp.id
            LEFT JOIN profiles p_criador ON m.criador_id = p_criador.id
            LEFT JOIN profiles p_mist ON m.misturado_por_id = p_mist.id
            LEFT JOIN profiles p_rev ON m.revisto_por_id = p_rev.id
            LEFT JOIN profiles p_fin ON m.finalizado_por_id = p_fin.id
            WHERE m.arquivado = %s
            ORDER BY m.criado_em DESC
        """
        
        cur.execute(query, (arquivadas,))
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
                } if row[19] else None
            })
            
        return resultado
    except Exception as e:
        print(f"❌ Erro ao listar músicas: {e}")
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
        
        cur.execute("""
            INSERT INTO musicas (titulo, turma_id, disciplina, estado, criador_id, responsavel_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (dados['titulo'], dados['turma_id'], dados.get('disciplina'), estado_inicial, criador_id, responsavel_inicial))
        
        new_id = cur.fetchone()[0]
        conn.commit()
        
        return {'id': new_id, 'message': 'Música criada com sucesso'}
    except Exception as e:
        print(f"❌ Erro ao criar música: {e}")
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
        print(f"❌ Erro ao avançar fase: {e}")
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
        print(f"❌ Erro ao aceitar tarefa: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False, str(e)
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def atualizar_detalhes(musica_id, dados):
    """Atualiza detalhes genéricos da música."""
    # ... implementação genérica se necessário (titulo, link_demo, etC)
    pass

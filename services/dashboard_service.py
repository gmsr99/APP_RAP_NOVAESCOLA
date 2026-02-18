from database.connection import get_db_connection

def get_produtor_dashboard(user_id):
    """
    Retorna dados do dashboard para um produtor específico.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. Em Produção (músicas onde user é responsável atual)
        cur.execute("""
            SELECT COUNT(*) 
            FROM musicas 
            WHERE responsavel_id = %s 
              AND estado != 'concluído' 
              AND arquivado = FALSE
        """, (user_id,))
        em_producao = cur.fetchone()[0]
        
        # 2. Aguardam Feedback (pool de feedback)
        cur.execute("""
            SELECT COUNT(*) 
            FROM musicas 
            WHERE estado = 'pool_feedback' 
              AND arquivado = FALSE
        """)
        aguardam_feedback = cur.fetchone()[0]
        
        # 3. Finalizadas este mês (pelo user)
        cur.execute("""
            SELECT COUNT(*) 
            FROM musicas 
            WHERE finalizado_por_id = %s 
              AND estado = 'concluído'
              AND EXTRACT(MONTH FROM updated_at) = EXTRACT(MONTH FROM CURRENT_DATE)
              AND EXTRACT(YEAR FROM updated_at) = EXTRACT(YEAR FROM CURRENT_DATE)
        """, (user_id,))
        finalizadas_mes = cur.fetchone()[0]
        
        # 4. Total no Pipeline (todas as músicas ativas)
        cur.execute("""
            SELECT COUNT(*) 
            FROM musicas 
            WHERE estado != 'concluído' 
              AND arquivado = FALSE
        """)
        total_pipeline = cur.fetchone()[0]
        
        # 5. Ação Necessária (músicas do user com feedback pendente)
        cur.execute("""
            SELECT 
                m.id, 
                m.titulo, 
                t.nome as turma_nome,
                e.nome as estabelecimento_nome,
                m.feedback
            FROM musicas m
            LEFT JOIN turmas t ON m.turma_id = t.id
            LEFT JOIN estabelecimentos e ON t.estabelecimento_id = e.id
            WHERE m.responsavel_id = %s 
              AND m.feedback IS NOT NULL 
              AND m.estado = 'finalização_wip'
              AND m.arquivado = FALSE
        """, (user_id,))
        
        acao_necessaria = []
        for row in cur.fetchall():
            acao_necessaria.append({
                'id': row[0],
                'titulo': row[1],
                'turma': row[2],
                'estabelecimento': row[3],
                'feedback': row[4]
            })
        
        # 6. As Minhas Músicas (todas as músicas do user)
        cur.execute("""
            SELECT 
                m.id, 
                m.titulo, 
                m.estado,
                t.nome as turma_nome,
                e.nome as estabelecimento_nome
            FROM musicas m
            LEFT JOIN turmas t ON m.turma_id = t.id
            LEFT JOIN estabelecimentos e ON t.estabelecimento_id = e.id
            WHERE m.responsavel_id = %s 
              AND m.estado != 'concluído'
              AND m.arquivado = FALSE
            ORDER BY m.updated_at DESC
        """, (user_id,))
        
        minhas_musicas = []
        for row in cur.fetchall():
            minhas_musicas.append({
                'id': row[0],
                'titulo': row[1],
                'estado': row[2],
                'turma': row[3],
                'estabelecimento': row[4]
            })
        
        return {
            'stats': {
                'em_producao': em_producao,
                'aguardam_feedback': aguardam_feedback,
                'finalizadas_mes': finalizadas_mes,
                'total_pipeline': total_pipeline
            },
            'acao_necessaria': acao_necessaria,
            'minhas_musicas': minhas_musicas
        }
        
    except Exception as e:
        print(f"❌ Erro ao obter dashboard do produtor: {e}")
        return None
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

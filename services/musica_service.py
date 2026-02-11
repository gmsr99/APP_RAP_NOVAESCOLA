import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.connection import get_db_connection

def listar_musicas(arquivadas=False):
    """Lista todas as músicas, filtrando por estado de arquivo."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = """
            SELECT 
                m.id, m.titulo, m.estado, m.disciplina, m.arquivado, m.criado_em,
                t.id as turma_id, t.nome as turma_nome,
                i.nome as instituicao_nome
            FROM musicas m
            LEFT JOIN turmas t ON m.turma_id = t.id
            LEFT JOIN instituicoes i ON t.instituicao_id = i.id
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
                    'instituicao': row[8]
                } if row[6] else None
            })
            
        return resultado
    except Exception as e:
        print(f"❌ Erro ao listar músicas: {e}")
        return []
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def criar_musica(dados):
    """Cria uma nova música."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO musicas (titulo, turma_id, disciplina, estado)
            VALUES (%s, %s, %s, 'gravação')
            RETURNING id
        """, (dados['titulo'], dados['turma_id'], dados.get('disciplina')))
        
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

def atualizar_estado(musica_id, novo_estado):
    """Atualiza o estado de uma música."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Validar estado
        estados_validos = ['gravação', 'edição', 'mistura', 'feedback', 'finalização']
        if novo_estado.lower() not in estados_validos:
            return False, "Estado inválido"
            
        cur.execute(
            "UPDATE musicas SET estado = %s WHERE id = %s",
            (novo_estado.lower(), musica_id)
        )
        
        conn.commit()
        return True, "Estado atualizado"
    except Exception as e:
        print(f"❌ Erro ao atualizar estado: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False, str(e)
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def arquivar_musica(musica_id):
    """Arquiva uma música (apenas se estiver em finalização)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check current status first
        cur.execute("SELECT estado FROM musicas WHERE id = %s", (musica_id,))
        result = cur.fetchone()
        
        if not result:
            return False, "Música não encontrada"
            
        if result[0] != 'finalização':
            return False, "A música só pode ser arquivada quando estiver em 'Finalização'"
            
        cur.execute("UPDATE musicas SET arquivado = TRUE WHERE id = %s", (musica_id,))
        conn.commit()
        
        return True, "Música arquivada"
    except Exception as e:
        print(f"❌ Erro ao arquivar música: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False, str(e)
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def desarquivar_musica(musica_id):
    """Desarquiva uma música (traz de volta para a lista ativa)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check current status
        cur.execute("SELECT arquivado FROM musicas WHERE id = %s", (musica_id,))
        result = cur.fetchone()
        
        if not result:
            return False, "Música não encontrada"
            
        if not result[0]:
            return False, "A música não está arquivada"
            
        cur.execute("UPDATE musicas SET arquivado = FALSE WHERE id = %s", (musica_id,))
        conn.commit()
        
        return True, "Música desarquivada"
    except Exception as e:
        print(f"❌ Erro ao desarquivar música: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False, str(e)
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

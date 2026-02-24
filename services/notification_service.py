
"""
==============================================================================
RAP NOVA ESCOLA - Serviço de Notificações
==============================================================================
Ficheiro: services/notification_service.py

Este serviço gere as notificações do sistema.
"""

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.connection import get_db_connection
import json

def criar_notificacao(user_id, tipo, titulo, mensagem, link=None, metadados=None):
    """
    Cria uma nova notificação para um utilizador.
    """
    if not user_id or not titulo or not mensagem:
        return False

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        query = """
            INSERT INTO notificacoes (user_id, tipo, titulo, mensagem, link, metadados)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id;
        """
        
        metadados_json = json.dumps(metadados) if metadados else None
        
        cur.execute(query, (user_id, tipo, titulo, mensagem, link, metadados_json))
        notif_id = cur.fetchone()[0]
        conn.commit()
        
        print(f"🔔 Notificação #{notif_id} criada para User #{user_id}")
        return True

    except Exception as e:
        print(f"❌ Erro ao criar notificação: {e}")
        if conn: conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def listar_notificacoes(user_id, apenas_nao_lidas=False, limite=50):
    """
    Lista notificações de um utilizador.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        filtro_lida = "AND lida = FALSE" if apenas_nao_lidas else ""
        
        query = f"""
            SELECT id, tipo, titulo, mensagem, link, lida, criado_em, metadados
            FROM notificacoes
            WHERE user_id = %s {filtro_lida}
            ORDER BY criado_em DESC
            LIMIT %s;
        """
        
        cur.execute(query, (user_id, limite))
        rows = cur.fetchall()
        
        notificacoes = []
        for row in rows:
            notificacoes.append({
                'id': row[0],
                'tipo': row[1],
                'titulo': row[2],
                'mensagem': row[3],
                'link': row[4],
                'lida': row[5],
                'criado_em': row[6],
                'metadados': row[7]
            })
            
        return notificacoes

    except Exception as e:
        print(f"❌ Erro ao listar notificações: {e}")
        return []
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def marcar_como_lida(notificacao_id):
    """
    Marca uma notificação como lida.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("UPDATE notificacoes SET lida = TRUE WHERE id = %s", (notificacao_id,))
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Erro ao marcar notificação: {e}")
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def apagar_notificacao(notificacao_id):
    """
    Remove uma notificação.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("DELETE FROM notificacoes WHERE id = %s", (notificacao_id,))
        conn.commit()
        return True
    except Exception as e:
        print(f"❌ Erro ao apagar notificação: {e}")
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def apagar_todas_notificacoes(user_id):
    """
    Remove todas as notificações de um utilizador.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("DELETE FROM notificacoes WHERE user_id = %s", (user_id,))
        count = cur.rowcount
        conn.commit()
        print(f"🗑️ {count} notificações apagadas para User #{user_id}")
        return count
    except Exception as e:
        print(f"❌ Erro ao apagar todas as notificações: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return 0
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def contar_nao_lidas(user_id):
    """
    Conta o número de notificações não lidas.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT COUNT(*) FROM notificacoes WHERE user_id = %s AND lida = FALSE", (user_id,))
        count = cur.fetchone()[0]
        return count
    except Exception as e:
        print(f"❌ Erro ao contar notificações: {e}")
        return 0
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

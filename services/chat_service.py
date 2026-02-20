"""
==============================================================================
RAP NOVA ESCOLA - Servico de Chat
==============================================================================
Ficheiro: services/chat_service.py

Logica de notificacoes singleton para mensagens de chat e gestao de DMs.
"""

import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.connection import get_db_connection
from services.notification_service import criar_notificacao


def notificar_mensagem_chat(channel_id: str, sender_id: str):
    """
    Para cada membro do canal (exceto o sender), cria UMA notificacao
    singleton do tipo 'chat_unread' se ainda nao existir uma nao lida.
    """
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Buscar membros do canal exceto o sender
        cur.execute("""
            SELECT user_id FROM chat_members
            WHERE channel_id = %s AND user_id != %s
        """, (channel_id, sender_id))
        members = cur.fetchall()

        for (member_id,) in members:
            # Verificar se ja existe notificacao singleton (nao lida)
            cur.execute("""
                SELECT id FROM notificacoes
                WHERE user_id = %s AND tipo = 'chat_unread' AND lida = FALSE
            """, (str(member_id),))
            existing = cur.fetchone()

            if not existing:
                # Fechar conexao atual antes de chamar criar_notificacao
                # (que abre a sua propria conexao)
                cur.close()
                conn.close()
                criar_notificacao(
                    user_id=str(member_id),
                    tipo='chat_unread',
                    titulo='Mensagens no Chat',
                    mensagem='Tens mensagens no chat por ler.',
                    link='/chat',
                )
                # Reabrir para continuar o loop
                conn = get_db_connection()
                cur = conn.cursor()

    except Exception as e:
        print(f"Erro chat notify: {e}")
        if conn:
            conn.rollback()
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def marcar_chat_notificacao_lida(user_id: str):
    """
    Marca a notificacao singleton chat_unread como lida para o user.
    Chamado quando o user entra num canal e le as mensagens.
    """
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE notificacoes SET lida = TRUE
            WHERE user_id = %s AND tipo = 'chat_unread' AND lida = FALSE
        """, (user_id,))
        conn.commit()
    except Exception as e:
        print(f"Erro ao marcar chat notif lida: {e}")
        if conn:
            conn.rollback()
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def obter_ou_criar_dm(user_a: str, user_b: str) -> dict:
    """
    Retorna o canal DM entre dois users. Cria se nao existir.
    """
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Procurar DM existente entre os dois users
        cur.execute("""
            SELECT cm1.channel_id
            FROM chat_members cm1
            JOIN chat_members cm2 ON cm1.channel_id = cm2.channel_id
            JOIN chat_channels cc ON cc.id = cm1.channel_id
            WHERE cm1.user_id = %s AND cm2.user_id = %s AND cc.type = 'dm'
        """, (user_a, user_b))
        row = cur.fetchone()

        if row:
            return {"channel_id": str(row[0])}

        # Criar novo canal DM
        cur.execute("""
            INSERT INTO chat_channels (name, type) VALUES ('', 'dm')
            RETURNING id
        """)
        channel_id = cur.fetchone()[0]

        # Inserir os dois membros
        cur.execute("""
            INSERT INTO chat_members (channel_id, user_id) VALUES (%s, %s), (%s, %s)
        """, (str(channel_id), user_a, str(channel_id), user_b))

        conn.commit()
        return {"channel_id": str(channel_id)}

    except Exception as e:
        print(f"Erro DM: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

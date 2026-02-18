
import psycopg2
from database.connection import get_db_connection

def create_table():
    conn = get_db_connection()
    cur = conn.cursor()

    print("🔌 Conectado ao banco de dados.")

    try:
        # Tabela de Notificações
        print("🔨 Criando tabela 'notificacoes'...")
        cur.execute("DROP TABLE IF EXISTS notificacoes CASCADE;")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notificacoes (
                id SERIAL PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                tipo VARCHAR(50) NOT NULL, -- 'session_created', 'session_confirmed', 'session_rejected', 'info'
                titulo VARCHAR(255) NOT NULL,
                mensagem TEXT NOT NULL,
                link VARCHAR(255), -- Link opcional para ação (ex: '/horarios')
                lida BOOLEAN DEFAULT FALSE,
                criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadados JSONB -- Para guardar ID da aula, etc.
            );
        """)
        
        # Índices para performance
        cur.execute("CREATE INDEX IF NOT EXISTS idx_notificacoes_user_id ON notificacoes(user_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_notificacoes_lida ON notificacoes(lida);")

        conn.commit()
        print("✅ Tabela 'notificacoes' criada com sucesso!")

    except Exception as e:
        print(f"❌ Erro ao criar tabela: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()
        print("🔌 Conexão fechada.")

if __name__ == "__main__":
    create_table()

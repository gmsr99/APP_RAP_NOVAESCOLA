import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        port=os.getenv('DB_PORT')
    )

def create_musicas_table():
    conn = None
    try:
        conn = get_db_connection()
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        print("🔨 A criar tabela 'musicas'...")

        # Criar a tabela
        cur.execute("""
            CREATE TABLE IF NOT EXISTS musicas (
                id SERIAL PRIMARY KEY,
                titulo VARCHAR(255) NOT NULL,
                estado VARCHAR(50) NOT NULL DEFAULT 'gravação',
                turma_id INTEGER REFERENCES turmas(id) ON DELETE SET NULL,
                disciplina VARCHAR(100),
                arquivado BOOLEAN DEFAULT FALSE,
                criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
            );
        """)
        
        print("✅ Tabela 'musicas' criada com sucesso!")

        # Adicionar triggers para atualizar updated_at se necessário (opcional, por agora simples)
        
    except Exception as e:
        print(f"❌ Erro ao criar tabela: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    create_musicas_table()

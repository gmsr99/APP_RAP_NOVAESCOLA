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

def update_aulas_schema():
    conn = None
    try:
        conn = get_db_connection()
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        print("🔨 A iniciar atualização da tabela 'aulas'...")

        # 1. Adicionar atividade_id
        print("-> A adicionar coluna 'atividade_id'...")
        cur.execute("""
            ALTER TABLE aulas 
            ADD COLUMN IF NOT EXISTS atividade_id INTEGER REFERENCES atividades(id) ON DELETE SET NULL;
        """)

        # 2. Adicionar equipamento_id (UUID)
        print("-> A adicionar coluna 'equipamento_id'...")
        # Nota: equipments.id é UUID
        cur.execute("""
            ALTER TABLE aulas 
            ADD COLUMN IF NOT EXISTS equipamento_id UUID REFERENCES equipments(id) ON DELETE SET NULL;
        """)
        
        print("✅ Tabela 'aulas' atualizada com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro na migração: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    update_aulas_schema()

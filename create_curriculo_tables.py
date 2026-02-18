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

def create_curriculo_tables():
    conn = None
    try:
        conn = get_db_connection()
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        print("🔨 A iniciar migração do currículo...")

        # 1. Update `instituicoes` - Add `sigla` if not exists
        print("-> A verificar tabela 'instituicoes'...")
        cur.execute("""
            ALTER TABLE instituicoes 
            ADD COLUMN IF NOT EXISTS sigla VARCHAR(20);
        """)

        # 2. Create `disciplinas`
        print("-> A criar tabela 'disciplinas'...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS disciplinas (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(100) NOT NULL UNIQUE,
                descricao TEXT
            );
        """)

        # 3. Create `atividades`
        print("-> A criar tabela 'atividades'...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS atividades (
                id SERIAL PRIMARY KEY,
                disciplina_id INTEGER REFERENCES disciplinas(id) ON DELETE CASCADE,
                codigo VARCHAR(20) NOT NULL,
                nome VARCHAR(200) NOT NULL,
                sessoes_padrao INTEGER,
                horas_padrao INTEGER,
                producoes_esperadas INTEGER DEFAULT 0,
                perfil_mentor VARCHAR(100),
                UNIQUE(disciplina_id, codigo)
            );
        """)
        
        print("✅ Tabelas de currículo criadas/atualizadas com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro na migração: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    create_curriculo_tables()

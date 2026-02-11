import os
import psycopg2
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

def get_db_connection():
    """
    Estabelece e retorna uma conexão à base de dados PostgreSQL.
    """
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            database=os.getenv('DB_NAME', 'rap_nova_escola'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'postgres'),
            port=os.getenv('DB_PORT', '5432'),
            sslmode='require'
        )
        return conn
    except Exception as e:
        print(f"❌ Erro ao conectar à base de dados: {e}")
        raise e

def testar_ligacao_bd():
    """
    Testa se a conexão à base de dados está a funcionar.
    Retorna True se sucesso, False caso contrário.
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT 1')
        cur.close()
        conn.close()
        print("✅ Ligação à base de dados estabelecida com sucesso!")
        return True
    except Exception as e:
        print(f"❌ Falha na ligação à base de dados: {e}")
        return False
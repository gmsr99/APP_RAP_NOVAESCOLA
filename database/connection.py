import os
import logging
from psycopg2 import pool
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Pool de conexões — reutiliza conexões em vez de abrir/fechar a cada request
_connection_pool = None

def _get_pool():
    """Inicializa o pool de conexões (lazy singleton)."""
    global _connection_pool
    if _connection_pool is None or _connection_pool.closed:
        _connection_pool = pool.ThreadedConnectionPool(
            minconn=2,
            maxconn=20,
            host=os.getenv('DB_HOST', 'localhost'),
            database=os.getenv('DB_NAME', 'rap_nova_escola'),
            user=os.getenv('DB_USER', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'postgres'),
            port=os.getenv('DB_PORT', '5432'),
            sslmode='require'
        )
        logger.info("Pool de conexões inicializado (min=2, max=20)")
    return _connection_pool

def get_db_connection():
    """
    Obtém uma conexão do pool.
    IMPORTANTE: após usar, chamar release_db_connection(conn) ou conn.close().
    conn.close() foi monkey-patched para devolver ao pool.
    """
    try:
        p = _get_pool()
        conn = p.getconn()
        # Monkey-patch close() para devolver ao pool em vez de fechar
        conn._real_close = conn.close
        conn.close = lambda: p.putconn(conn)
        return conn
    except Exception as e:
        logger.error(f"Erro ao obter conexão do pool: {e}")
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
        logger.info("Ligação à base de dados estabelecida com sucesso!")
        return True
    except Exception as e:
        logger.error(f"Falha na ligação à base de dados: {e}")
        return False

def close_pool():
    """Fecha todas as conexões do pool (para shutdown gracioso)."""
    global _connection_pool
    if _connection_pool and not _connection_pool.closed:
        _connection_pool.closeall()
        logger.info("Pool de conexões fechado")

import os
import logging
import psycopg2
import psycopg2.extensions
from psycopg2 import pool
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

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


# Estados de transação que precisam de rollback antes de devolver ao pool
_TRANSACTION_NEEDS_ROLLBACK = {
    psycopg2.extensions.TRANSACTION_STATUS_ACTIVE,
    psycopg2.extensions.TRANSACTION_STATUS_INTRANS,
    psycopg2.extensions.TRANSACTION_STATUS_INERROR,
}


class PooledConnection:
    """
    Wrapper em torno de uma conexão psycopg2 que a devolve ao pool em close().
    Delega todos os atributos/métodos ao objeto de conexão real.
    """

    def __init__(self, conn, pool_ref):
        # Usar __dict__ directamente para evitar recursão no __setattr__
        self.__dict__['_conn'] = conn
        self.__dict__['_pool'] = pool_ref
        self.__dict__['_closed'] = False

    # ── Gestão do ciclo de vida ─────────────────────────────────────────────

    def close(self):
        """Devolve a conexão ao pool (em vez de a fechar permanentemente)."""
        if self.__dict__['_closed']:
            return
        self.__dict__['_closed'] = True
        conn = self.__dict__['_conn']
        pool_ref = self.__dict__['_pool']
        try:
            status = conn.get_transaction_status()
            if status in _TRANSACTION_NEEDS_ROLLBACK:
                try:
                    conn.rollback()
                except Exception:
                    # Conexão partida — fechar permanentemente
                    pool_ref.putconn(conn, close=True)
                    return
            pool_ref.putconn(conn)
        except Exception as e:
            logger.warning(f"Erro ao devolver conexão ao pool: {e}")
            try:
                pool_ref.putconn(conn, close=True)
            except Exception:
                pass

    # ── Delegação total para o objeto de conexão real ──────────────────────

    def cursor(self, *args, **kwargs):
        return self.__dict__['_conn'].cursor(*args, **kwargs)

    def commit(self):
        return self.__dict__['_conn'].commit()

    def rollback(self):
        return self.__dict__['_conn'].rollback()

    def __getattr__(self, name):
        return getattr(self.__dict__['_conn'], name)

    def __setattr__(self, name, value):
        if name.startswith('_'):
            self.__dict__[name] = value
        else:
            setattr(self.__dict__['_conn'], name, value)


def get_db_connection() -> PooledConnection:
    """Obtém uma conexão do pool. Chamar conn.close() para a devolver."""
    try:
        p = _get_pool()
        conn = p.getconn()
        return PooledConnection(conn, p)
    except Exception as e:
        logger.error(f"Erro ao obter conexão do pool: {e}")
        raise e


def testar_ligacao_bd():
    """Testa se a ligação à base de dados está a funcionar."""
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
    """Fecha todas as conexões do pool (shutdown gracioso)."""
    global _connection_pool
    if _connection_pool and not _connection_pool.closed:
        _connection_pool.closeall()
        logger.info("Pool de conexões fechado")

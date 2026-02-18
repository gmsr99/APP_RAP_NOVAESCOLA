
import psycopg2
from database.connection import get_db_connection

def list_tables():
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public';
        """)
        tables = cur.fetchall()
        print("📊 Tabelas existentes:")
        for table in tables:
            print(f" - {table[0]}")
    except Exception as e:
        print(f"❌ Erro: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    list_tables()


import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database connection parameters
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_PORT = os.getenv("DB_PORT")

def get_db_connection():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            port=DB_PORT
        )
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

def migrate_database():
    conn = get_db_connection()
    if not conn:
        return

    try:
        cur = conn.cursor()

        print("🚀 Starting migration: Instituições -> Estabelecimentos")

        # 1. Rename table 'instituicoes' to 'estabelecimentos'
        print("1. Renaming table 'instituicoes' to 'estabelecimentos'...")
        try:
            cur.execute("ALTER TABLE instituicoes RENAME TO estabelecimentos;")
            print("   ✅ Table renamed.")
        except psycopg2.errors.UndefinedTable:
            print("   ⚠️ Table 'instituicoes' not found (maybe already renamed?). Skipping.")
            conn.rollback() 
        except psycopg2.errors.DuplicateTable:
             print("   ⚠️ Table 'estabelecimentos' already exists. Skipping.")
             conn.rollback()
        else:
             conn.commit()


        # 2. Rename column 'instituicao_id' to 'estabelecimento_id' in 'turmas' table
        print("2. Renaming 'instituicao_id' to 'estabelecimento_id' in 'turmas' table...")
        try:
            cur.execute("ALTER TABLE turmas RENAME COLUMN instituicao_id TO estabelecimento_id;")
            print("   ✅ Column renamed.")
        except psycopg2.errors.UndefinedColumn:
             print("   ⚠️ Column 'instituicao_id' not found in 'turmas' (maybe already renamed?). Skipping.")
             conn.rollback()
        except psycopg2.errors.DuplicateColumn:
             print("   ⚠️ Column 'estabelecimento_id' already exists in 'turmas'. Skipping.")
             conn.rollback()
        else:
            conn.commit()
            
        print("✅ Migration completed successfully!")

    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        if cur: cur.close()
        if conn: conn.close()

if __name__ == "__main__":
    migrate_database()

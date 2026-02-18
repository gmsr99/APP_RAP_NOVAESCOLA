import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        port=os.getenv('DB_PORT')
    )

def update_musicas_schema():
    conn = None
    try:
        conn = get_db_connection()
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        print("🔨 Updating 'musicas' table schema...")

        # Add new columns if they don't exist
        columns = [
            ("responsavel_id", "UUID REFERENCES profiles(id) ON DELETE SET NULL"),
            ("criador_id", "UUID REFERENCES profiles(id) ON DELETE SET NULL"),
            ("feedback", "TEXT"),
            ("link_demo", "TEXT"),
            ("updated_at", "TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())")
        ]

        for col_name, col_type in columns:
            try:
                cur.execute(f"ALTER TABLE musicas ADD COLUMN IF NOT EXISTS {col_name} {col_type};")
                print(f"   - Added column: {col_name}")
            except Exception as e:
                print(f"   - Error adding {col_name}: {e}")

        print("✅ Schema update completed!")

    except Exception as e:
        print(f"❌ Error updating schema: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    update_musicas_schema()

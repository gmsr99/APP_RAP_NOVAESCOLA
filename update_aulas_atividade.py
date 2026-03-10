import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def update_aulas_atividade():
    conn = None
    try:
        conn = psycopg2.connect(
            host=os.getenv('DB_HOST'),
            database=os.getenv('DB_NAME'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            port=os.getenv('DB_PORT')
        )
        cur = conn.cursor()

        print("🔨 A atualizar atividade_id na tabela 'aulas' para 6 onde é NULL...")

        cur.execute("""
            UPDATE aulas 
            SET atividade_id = 6 
            WHERE atividade_id IS NULL;
        """)
        
        updated_rows = cur.rowcount
        conn.commit()
        
        print(f"✅ Tabela 'aulas' atualizada com sucesso! Linhas afetadas: {updated_rows}")
        
    except Exception as e:
        print(f"❌ Erro na atualização: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    update_aulas_atividade()

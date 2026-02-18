
import psycopg2
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

def test_insert():
    try:
        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            database=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            port=os.getenv("DB_PORT"),
            sslmode='require'
        )
        cur = conn.cursor()

        print("\n--- ATTEMPTING MANUAL INSERT INTO mentores ---")
        
        # Simulate data from trigger
        fake_uuid = str(uuid.uuid4())
        fake_email = f"test_debug_{fake_uuid[:8]}@example.com"
        fake_name = "Test Debug User"
        fake_role = "mentor"
        
        print(f"Values: email={fake_email}, name={fake_name}, role={fake_role}, uuid={fake_uuid}")
        
        query = """
            INSERT INTO mentores (nome, email, perfil, user_id, ativo, criado_em, atualizado_em)
            VALUES (%s, %s, %s, %s, true, NOW(), NOW())
            RETURNING id;
        """
        
        try:
            cur.execute(query, (fake_name, fake_email, fake_role, fake_uuid))
            new_id = cur.fetchone()[0]
            print(f"✅ Success! Inserted ID: {new_id}")
            conn.rollback() # Don't actually save it
            print("Rolled back successfully.")
        except Exception as e:
            print(f"❌ INSERT FAILED: {e}")
            conn.rollback()

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Connection Error: {e}")

if __name__ == "__main__":
    test_insert()


import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def fix_produtores_trigger():
    """
    Fix trigger to match actual schemas:
    - mentores: has user_id, criado_em, atualizado_em
    - produtores: only has created_at, missing user_id and atualizado_em
    """
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

        print("\n--- DROPPING OLD TRIGGER ---")
        cur.execute("DROP TRIGGER IF EXISTS trigger_sync_roles ON profiles;")
        cur.execute("DROP FUNCTION IF EXISTS sync_mentores_and_produtores CASCADE;")
        print("Dropped old trigger and function.")

        print("\n--- CREATING SCHEMA-AWARE SYNC FUNCTION ---")
        cur.execute("""
            CREATE OR REPLACE FUNCTION sync_mentores_and_produtores()
            RETURNS TRIGGER AS $$
            BEGIN
                -- MENTORES: mentor, mentor_produtor, coordenador
                -- Has: user_id, criado_em, atualizado_em
                IF NEW.role IN ('mentor', 'mentor_produtor', 'coordenador') THEN
                    UPDATE mentores 
                    SET nome = COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)), 
                        perfil = NEW.role,
                        user_id = NEW.id,
                        atualizado_em = NOW(),
                        ativo = true
                    WHERE email = NEW.email;

                    IF NOT FOUND THEN
                        INSERT INTO mentores (nome, email, perfil, user_id, ativo, criado_em, atualizado_em)
                        VALUES (
                            COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)), 
                            NEW.email, 
                            NEW.role, 
                            NEW.id, 
                            true, 
                            NOW(), 
                            NOW()
                        );
                    END IF;
                END IF;

                -- PRODUTORES: produtor, mentor_produtor, coordenador
                -- Has: created_at (NOT criado_em), NO user_id, NO atualizado_em
                IF NEW.role IN ('produtor', 'mentor_produtor', 'coordenador') THEN
                    UPDATE produtores 
                    SET nome = COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)), 
                        ativo = true
                    WHERE email = NEW.email;

                    IF NOT FOUND THEN
                        INSERT INTO produtores (nome, email, ativo)
                        VALUES (
                            COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)), 
                            NEW.email, 
                            true
                        );
                    END IF;
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
        """)
        
        cur.execute("""
            CREATE TRIGGER trigger_sync_roles
            AFTER INSERT OR UPDATE ON profiles
            FOR EACH ROW
            EXECUTE FUNCTION sync_mentores_and_produtores();
        """)
        print("Created schema-aware 'sync_mentores_and_produtores' function and trigger.")

        conn.commit()
        print("\n✅ Schema-aware trigger fix applied!")
        print("   Mentores: uses user_id, criado_em, atualizado_em, perfil")
        print("   Produtores: uses only nome, email, ativo (matching actual schema)")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"❌ Error: {e}")
        if 'conn' in locals() and conn: 
            conn.rollback()

if __name__ == "__main__":
    fix_produtores_trigger()

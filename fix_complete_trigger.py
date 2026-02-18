
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def fix_complete_trigger():
    """
    Update trigger to handle BOTH mentores AND produtores tables.
    - mentor, mentor_produtor, coordenador -> mentores
    - produtor, mentor_produtor, coordenador -> produtores
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

        print("\n--- CHECKING PRODUTORES TABLE ---")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'produtores';
        """)
        cols = cur.fetchall()
        if cols:
            print("Produtores columns:")
            for c in cols:
                print(f"  - {c[0]}: {c[1]}")
        else:
            print("⚠ WARNING: produtores table might not exist!")

        print("\n--- DROPPING OLD TRIGGER ---")
        cur.execute("DROP TRIGGER IF EXISTS trigger_sync_mentores ON profiles;")
        cur.execute("DROP FUNCTION IF EXISTS sync_mentores_from_profiles CASCADE;")
        print("Dropped old trigger and function.")

        print("\n--- CREATING COMPREHENSIVE SYNC FUNCTION ---")
        cur.execute("""
            CREATE OR REPLACE FUNCTION sync_mentores_and_produtores()
            RETURNS TRIGGER AS $$
            BEGIN
                -- MENTORES: mentor, mentor_produtor, coordenador
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
                IF NEW.role IN ('produtor', 'mentor_produtor', 'coordenador') THEN
                    UPDATE produtores 
                    SET nome = COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)), 
                        user_id = NEW.id,
                        atualizado_em = NOW(),
                        ativo = true
                    WHERE email = NEW.email;

                    IF NOT FOUND THEN
                        INSERT INTO produtores (nome, email, user_id, ativo, criado_em, atualizado_em)
                        VALUES (
                            COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)), 
                            NEW.email, 
                            NEW.id, 
                            true, 
                            NOW(), 
                            NOW()
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
        print("Created 'sync_mentores_and_produtores' function and trigger.")

        conn.commit()
        print("\n✅ Complete trigger fix applied successfully!")
        print("   - Mentores: mentor, mentor_produtor, coordenador")
        print("   - Produtores: produtor, mentor_produtor, coordenador")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"❌ Error: {e}")
        if 'conn' in locals() and conn: 
            conn.rollback()

if __name__ == "__main__":
    fix_complete_trigger()

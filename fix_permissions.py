
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def fix_triggers():
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

        print("\n--- CHECKING RLS ON mentores ---")
        cur.execute("SELECT relrowsecurity FROM pg_class WHERE oid = 'mentores'::regclass;")
        rls = cur.fetchone()[0]
        print(f"RLS Enabled on mentores: {rls}")

        print("\n--- DROPPING LEGACY OBJECTS ---")
        cur.execute("DROP TRIGGER IF EXISTS on_profile_change ON profiles;")
        cur.execute("DROP FUNCTION IF EXISTS handle_new_user_role CASCADE;")
        print("Dropped 'on_profile_change' and 'handle_new_user_role'.")

        print("\n--- RECREATING SYNC TRIGGER WITH SECURITY DEFINER ---")
        cur.execute("""
            CREATE OR REPLACE FUNCTION sync_mentores_from_profiles()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Debug: Raise notice if possible (won't stay in logs usually but good practice)
                -- RAISE NOTICE 'Syncing mentor for % (%)', NEW.email, NEW.role;

                IF NEW.role IN ('mentor', 'mentor_produtor', 'coordenador') THEN
                    -- Update existing
                    UPDATE mentores 
                    SET nome = COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)), 
                        perfil = NEW.role,
                        user_id = NEW.id,
                        atualizado_em = NOW(),
                        ativo = true
                    WHERE email = NEW.email;

                    -- Insert new
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
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql SECURITY DEFINER;
        """)
        
        cur.execute("DROP TRIGGER IF EXISTS trigger_sync_mentores ON profiles;")
        cur.execute("""
            CREATE TRIGGER trigger_sync_mentores
            AFTER INSERT OR UPDATE ON profiles
            FOR EACH ROW
            EXECUTE FUNCTION sync_mentores_from_profiles();
        """)
        print("Recreated 'sync_mentores_from_profiles' (SECURITY DEFINER) and trigger.")

        conn.commit()
        print("✅ Fix applied successfully.")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"❌ Error: {e}")
        if conn: conn.rollback()

if __name__ == "__main__":
    fix_triggers()

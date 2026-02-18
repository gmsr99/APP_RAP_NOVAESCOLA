
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def fix_trigger_search_path():
    """
    ROOT CAUSE FIX: The Supabase Auth trigger runs in a context where
    search_path does NOT include 'public'. The trigger function was
    referencing 'mentores' without schema qualification, causing:
    
    ERROR: relation "mentores" does not exist (SQLSTATE 42P01)
    
    FIX: Use fully qualified names (public.mentores, public.produtores)
    and SET search_path = public on the function.
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

        print("--- DROPPING OLD TRIGGER ---")
        cur.execute("DROP TRIGGER IF EXISTS trigger_sync_roles ON public.profiles;")
        cur.execute("DROP FUNCTION IF EXISTS public.sync_mentores_and_produtores CASCADE;")
        print("Done.")

        print("\n--- CREATING TRIGGER WITH SCHEMA-QUALIFIED NAMES ---")
        cur.execute("""
            CREATE OR REPLACE FUNCTION public.sync_mentores_and_produtores()
            RETURNS TRIGGER AS $$
            BEGIN
                -- MENTORES: mentor, mentor_produtor, coordenador
                IF NEW.role IN ('mentor', 'mentor_produtor', 'coordenador') THEN
                    UPDATE public.mentores 
                    SET nome = COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)), 
                        perfil = NEW.role,
                        user_id = NEW.id,
                        atualizado_em = NOW(),
                        ativo = true
                    WHERE email = NEW.email;

                    IF NOT FOUND THEN
                        INSERT INTO public.mentores (nome, email, perfil, user_id, ativo, criado_em, atualizado_em)
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
                    UPDATE public.produtores 
                    SET nome = COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)), 
                        perfil = NEW.role,
                        user_id = NEW.id,
                        atualizado_em = NOW(),
                        ativo = true
                    WHERE email = NEW.email;

                    IF NOT FOUND THEN
                        INSERT INTO public.produtores (nome, email, perfil, user_id, ativo, criado_em, atualizado_em)
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
            $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
        """)
        print("Function created with SET search_path = public.")

        cur.execute("""
            CREATE TRIGGER trigger_sync_roles
            AFTER INSERT OR UPDATE ON public.profiles
            FOR EACH ROW
            EXECUTE FUNCTION public.sync_mentores_and_produtores();
        """)
        print("Trigger created.")

        conn.commit()
        print("\n✅ ROOT CAUSE FIX APPLIED!")
        print("   All table references now use public.mentores / public.produtores")
        print("   Function has SET search_path = public")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"\n❌ Error: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()

if __name__ == "__main__":
    fix_trigger_search_path()

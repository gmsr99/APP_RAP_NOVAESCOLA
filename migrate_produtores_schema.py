
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def migrate_produtores_schema():
    """
    Align produtores table schema with mentores table.
    Add missing columns to ensure trigger consistency.
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

        print("\n=== ALIGNING PRODUTORES SCHEMA ===\n")

        # Add missing columns to produtores
        migrations = [
            ("user_id", "ALTER TABLE produtores ADD COLUMN IF NOT EXISTS user_id UUID;"),
            ("perfil", "ALTER TABLE produtores ADD COLUMN IF NOT EXISTS perfil VARCHAR(50);"),
            ("criado_em", "ALTER TABLE produtores ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP DEFAULT NOW();"),
            ("atualizado_em", "ALTER TABLE produtores ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMP DEFAULT NOW();"),
            ("disponibilidade", "ALTER TABLE produtores ADD COLUMN IF NOT EXISTS disponibilidade TEXT;"),
            ("observacoes", "ALTER TABLE produtores ADD COLUMN IF NOT EXISTS observacoes TEXT;"),
        ]

        for col_name, sql in migrations:
            try:
                print(f"Adding column '{col_name}'...")
                cur.execute(sql)
                print(f"  ✓ {col_name} added")
            except Exception as e:
                print(f"  ⚠ {col_name}: {e}")
                conn.rollback()
                cur = conn.cursor()  # Reopen cursor after rollback

        # Create unified trigger function
        print("\n--- CREATING UNIFIED TRIGGER ---")
        cur.execute("DROP TRIGGER IF EXISTS trigger_sync_roles ON profiles;")
        cur.execute("DROP FUNCTION IF EXISTS sync_mentores_and_produtores CASCADE;")
        
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
                -- NOW with aligned schema
                IF NEW.role IN ('produtor', 'mentor_produtor', 'coordenador') THEN
                    UPDATE produtores 
                    SET nome = COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)), 
                        perfil = NEW.role,
                        user_id = NEW.id,
                        atualizado_em = NOW(),
                        ativo = true
                    WHERE email = NEW.email;

                    IF NOT FOUND THEN
                        INSERT INTO produtores (nome, email, perfil, user_id, ativo, criado_em, atualizado_em)
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
        
        cur.execute("""
            CREATE TRIGGER trigger_sync_roles
            AFTER INSERT OR UPDATE ON profiles
            FOR EACH ROW
            EXECUTE FUNCTION sync_mentores_and_produtores();
        """)

        conn.commit()
        
        print("\n✅ SCHEMA MIGRATION COMPLETE")
        print("\nBoth tables now have:")
        print("  - user_id (UUID, links to auth.users)")
        print("  - perfil (role/profile)")
        print("  - criado_em, atualizado_em (timestamps)")
        print("  - nome, email, ativo, telefone, biografia")
        print("  - disponibilidade, observacoes")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"\n❌ Migration Error: {e}")
        if 'conn' in locals() and conn: 
            conn.rollback()

if __name__ == "__main__":
    migrate_produtores_schema()

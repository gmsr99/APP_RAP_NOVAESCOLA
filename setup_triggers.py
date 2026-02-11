import psycopg2
import os
import socket
from dotenv import load_dotenv

# Force reload to ignore cached env vars
load_dotenv(override=True)

def get_ipv4_address(hostname):
    try:
        return socket.gethostbyname(hostname)
    except Exception as e:
        print(f"❌ Failed to resolve {hostname}: {e}")
        return None

def setup_triggers():
    print("Setting up SQL Triggers for Role Automation...")
    
    # Get variables
    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT")
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")
    dbname = os.getenv("DB_NAME")
    
    ipv4 = get_ipv4_address(host)
    target = ipv4 if ipv4 else host

    try:
        connection = psycopg2.connect(
            host=target,
            database=dbname,
            user=user,
            password=password,
            port=port, 
            sslmode='require'
        )
        cur = connection.cursor()

        # 1. Define Function
        print("Creating Function 'handle_new_user_role'...")
        cur.execute("""
            CREATE OR REPLACE FUNCTION handle_new_user_role()
            RETURNS TRIGGER AS $$
            BEGIN
                -- 1. Handle MENTOR Role (Mentor, Coordenador, Mentor & Produtor)
                IF NEW.role IN ('mentor', 'coordenador', 'mentor_produtor') THEN
                    -- Insert if not exists, Update if exists
                    INSERT INTO mentores (nome, email, ativo)
                    VALUES (NEW.full_name, NEW.email, true)
                    ON CONFLICT (email) DO UPDATE 
                    SET nome = EXCLUDED.nome, ativo = true;
                ELSE
                    -- Optional: Remove from mentores if role lost? 
                    -- For now, let's just keep them but maybe set active=false?
                    -- Leaving as is for safety.
                END IF;

                -- 2. Handle PRODUCER Role (Produtor, Coordenador, Mentor & Produtor)
                IF NEW.role IN ('produtor', 'coordenador', 'mentor_produtor') THEN
                    INSERT INTO produtores (nome, email, ativo)
                    VALUES (NEW.full_name, NEW.email, true)
                    ON CONFLICT (email) DO UPDATE 
                    SET nome = EXCLUDED.nome, ativo = true;
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """)

        # 2. Define Trigger
        print("Creating Trigger 'on_profile_change'...")
        cur.execute("""
            DROP TRIGGER IF EXISTS on_profile_change ON profiles;
            
            CREATE TRIGGER on_profile_change
            AFTER INSERT OR UPDATE ON profiles
            FOR EACH ROW
            EXECUTE FUNCTION handle_new_user_role();
        """)
        
        # 3. Add Unique Constraint on Email for ON CONFLICT to work
        print("Ensuring Unique Constraints on Email...")
        try:
            cur.execute("ALTER TABLE mentores ADD CONSTRAINT mentores_email_key UNIQUE (email);")
        except Exception as e:
            print(f"  (Mentores constraint might already exist: {e})")
            connection.rollback()
            cur = connection.cursor() # Re-open cursor after rollback

        try:
            cur.execute("ALTER TABLE produtores ADD CONSTRAINT produtores_email_key UNIQUE (email);")
        except Exception as e:
            print(f"  (Produtores constraint might already exist: {e})")
            connection.rollback()
            cur = connection.cursor()

        connection.commit()
        print("✅ Triggers and Functions successfully applied!")

        cur.close()
        connection.close()

    except Exception as e:
        print(f"❌ Error setting up triggers: {e}")

if __name__ == "__main__":
    setup_triggers()

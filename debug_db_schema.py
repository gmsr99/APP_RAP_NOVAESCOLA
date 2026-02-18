
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def debug_schema():
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

        print("\n--- TRIGGERS ON profiles ---")
        cur.execute("""
            SELECT trigger_name, event_manipulation, action_statement, action_orientation
            FROM information_schema.triggers
            WHERE event_object_table = 'profiles';
        """)
        triggers = cur.fetchall()
        for t in triggers:
            print(f"- {t[0]}: {t[1]} ({t[3]})")
        
        if not triggers:
            print("No triggers found on 'profiles'.")

        print("\n--- COLUMNS IN mentores ---")
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'mentores';
        """)
        cols = cur.fetchall()
        for c in cols:
            print(f"- {c[0]}: {c[1]} (Nullable: {c[2]})")

        print("\n--- CHECKING TABLES EXISTENCE ---")
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('mentores', 'produtores', 'profiles');
        """)
        tables = cur.fetchall()
        found_tables = [t[0] for t in tables]
        print(f"Found tables: {found_tables}")

        print("\n--- COLUMNS IN profiles ---")
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'profiles';
        """)
        cols = cur.fetchall()
        for c in cols:
            print(f"- {c[0]}: {c[1]} (Nullable: {c[2]})")

        print("\n--- TRIGGERS ON mentores ---")
        cur.execute("""
            SELECT trigger_name, event_manipulation, action_statement, action_orientation
            FROM information_schema.triggers
            WHERE event_object_table = 'mentores';
        """)
        triggers = cur.fetchall()
        for t in triggers:
            print(f"- {t[0]}: {t[1]} ({t[3]})")
        
        if not triggers:
            print("No triggers found on 'mentores'.")

        print("\n--- CHECKING FOR AUTH TRIGGERS (Blind Check) ---")
        # We can't easily see auth schema triggers, but we can look for functions that might be used by them
        cur.execute("""
            SELECT routine_name 
            FROM information_schema.routines 
            WHERE routine_schema = 'public' AND routine_definition LIKE '%profiles%';
        """)
        funcs = cur.fetchall()
        print("Functions referencing 'profiles':")
        for f in funcs:
            print(f"- {f[0]}")

        
        print("\n--- FUNCTION DEFINITION: handle_new_user ---")
        try:
            cur.execute("SELECT pg_get_functiondef('public.handle_new_user'::regproc);")
            func_def = cur.fetchone()
            if func_def:
                print(func_def[0])
            else:
                print("Function not found.")
        except Exception as e:
            print(f"Could not fetch function def: {e}")
            cur.execute("ROLLBACK") # Reset transaction

        print("\n--- CONSTRAINTS ON mentores ---")
        cur.execute("""
            SELECT conname, contype, pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'mentores'::regclass;
        """)
        cons = cur.fetchall()
        for c in cons:
            print(f"- {c[0]} ({c[1]}): {c[2]}")
            
        print("\n--- CONSTRAINTS ON profiles ---")
        cur.execute("""
            SELECT conname, contype, pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'profiles'::regclass;
        """)
        cons = cur.fetchall()
        for c in cons:
            print(f"- {c[0]} ({c[1]}): {c[2]}")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    debug_schema()

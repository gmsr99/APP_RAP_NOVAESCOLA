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

def check_constraints():
    print("Checking constraints on 'profiles' table...")
    
    # Get variables from loaded .env
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

        cur.execute("""
            SELECT conname, pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = 'profiles'::regclass;
        """)
        constraints = cur.fetchall()
        
        print("\n--- Constraints ---")
        for c in constraints:
            print(f"{c[0]}: {c[1]}")
            
        cur.close()
        connection.close()

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    check_constraints()

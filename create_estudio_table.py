import psycopg2
import os
import socket
from dotenv import load_dotenv

load_dotenv(override=True)

def get_ipv4_address(hostname):
    try:
        return socket.gethostbyname(hostname)
    except Exception as e:
        print(f"❌ Failed to resolve {hostname}: {e}")
        return None

def create_estudio_table():
    print("Creating 'estudio_reservas' table...")
    
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
            CREATE TABLE IF NOT EXISTS estudio_reservas (
                id SERIAL PRIMARY KEY,
                data DATE NOT NULL,
                hora_inicio TIME NOT NULL,
                hora_fim TIME NOT NULL,
                tipo VARCHAR(50) NOT NULL,
                artista_turma VARCHAR(255) NOT NULL,
                projeto_musica VARCHAR(255) NOT NULL,
                responsavel_id UUID REFERENCES profiles(id),
                criado_por_id UUID REFERENCES profiles(id),
                notas TEXT,
                criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
            );
        """)
        
        connection.commit()
        print("✅ Table 'estudio_reservas' created successfully!")
        
        cur.close()
        connection.close()

    except Exception as e:
        print(f"❌ Error creating table: {e}")

if __name__ == "__main__":
    create_estudio_table()

import os
import json
from datetime import datetime
from dotenv import load_dotenv

# Let's try to import supabase, if failing we can fallback to psycopg2 or sqlmodel
try:
    from supabase import create_client, Client
    load_dotenv()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    supabase = create_client(url, key)
    
    response = supabase.table("aulas").select("*").gte("data_hora", "2026-03-09T00:00:00").lte("data_hora", "2026-03-13T23:59:59").execute()
    data = response.data
    
    with open("aulas_semana_9_a_13_marco.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
        
    print(f"Success! Exported {len(data)} records to aulas_semana_9_a_13_marco.json.")

except ImportError:
    print("Supabase client not found, falling back to psycopg2/SQLAlchemy...")
    import psycopg2
    from psycopg2.extras import RealDictCursor
    load_dotenv()
    db_url = os.environ.get("DATABASE_URL")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT * FROM aulas 
        WHERE data_hora >= '2026-03-09 00:00:00' AND data_hora <= '2026-03-13 23:59:59'
    """)
    rows = cur.fetchall()
    
    # helper for datetime json serialization
    def default_serializer(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return str(obj)

    with open("aulas_semana_9_a_13_marco.json", "w", encoding="utf-8") as f:
        json.dump([dict(r) for r in rows], f, indent=4, ensure_ascii=False, default=default_serializer)
        
    print(f"Success! Exported {len(rows)} records to aulas_semana_9_a_13_marco.json via psycopg2.")

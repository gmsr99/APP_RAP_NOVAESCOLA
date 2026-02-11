"""
Teste rápido: verificar tabelas do Supabase
"""
import sys

try:
    from database.connection import get_db_connection
except ImportError as e:
    if "psycopg2" in str(e):
        print("❌ Erro: A biblioteca 'psycopg2' não está instalada.")
        print("💡 Execute: pip3 install psycopg2-binary")
        sys.exit(1)
    raise

print("🧪 Testando leitura das tabelas...\n")

try:
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Lista de tabelas esperadas
    tabelas = ['projetos', 'instituicoes', 'turmas', 'mentores', 'aulas', 'equipamentos', 'logs']
    
    print("📊 Contando registos em cada tabela:")
    print("-" * 50)
    
    for tabela in tabelas:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {tabela}")
            total = cur.fetchone()[0]
            print(f"✅ {tabela:20} → {total} registos")
        except Exception:
            print(f"❌ {tabela:20} → Tabela não encontrada")
            conn.rollback()
    
    print("-" * 50)
    print("\n✨ Teste de tabelas concluído!")
    
    cur.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Erro: {e}")
    
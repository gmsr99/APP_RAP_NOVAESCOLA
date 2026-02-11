"""
Script para buscar schema via API REST do Supabase
"""
import requests
import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    print("❌ Variáveis SUPABASE_URL e SUPABASE_ANON_KEY não encontradas no .env")
    exit(1)

# Tentar buscar schema via API REST do Supabase
# Nota: A API REST do Supabase não expõe diretamente o schema,
# mas podemos tentar usar o endpoint de PostgREST para inferir estrutura

print("🔍 Tentando buscar informações do schema via Supabase API...")
print(f"URL: {SUPABASE_URL}")

# Lista de tabelas conhecidas do projeto
tabelas_conhecidas = ['projetos', 'instituicoes', 'turmas', 'mentores', 'aulas', 'equipamentos', 'logs']

headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': f'Bearer {SUPABASE_ANON_KEY}'
}

print("\n📊 Tentando acessar tabelas conhecidas:")
for tabela in tabelas_conhecidas:
    try:
        # Tentar fazer uma query simples para verificar se a tabela existe
        url = f"{SUPABASE_URL}/rest/v1/{tabela}?limit=0"
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            print(f"✅ {tabela} - existe")
        elif response.status_code == 404:
            print(f"❌ {tabela} - não encontrada")
        else:
            print(f"⚠️  {tabela} - status {response.status_code}")
    except Exception as e:
        print(f"❌ {tabela} - erro: {e}")

print("\n💡 Nota: Para obter o schema completo SQL, é necessário:")
print("   1. Acessar o Supabase Dashboard")
print("   2. Ir em Database → Schema")
print("   3. Ou usar pg_dump diretamente do PostgreSQL")

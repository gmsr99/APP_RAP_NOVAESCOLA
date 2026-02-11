"""
==============================================================================
RAP NOVA ESCOLA - Configurações da Aplicação
==============================================================================
Ficheiro: config/settings.py

Responsabilidades:
- Ler as variáveis do ficheiro .env
- Organizar todas as configurações num só lugar
- Validar se as configurações necessárias existem
- Fornecer acesso fácil às configurações em toda a app

Como usar noutros ficheiros:
    from config.settings import DB_HOST, DB_PORT, APP_NAME
==============================================================================
"""

import os
from dotenv import load_dotenv

# ==============================================================================
# CARREGAR VARIÁVEIS DO FICHEIRO .env
# ==============================================================================
# A função load_dotenv() lê o ficheiro .env e carrega as variáveis
# Isso permite aceder a elas através de os.getenv()

load_dotenv()


# ==============================================================================
# CONFIGURAÇÕES DA BASE DE DADOS (SUPABASE)
# ==============================================================================

# Host da base de dados (endereço do servidor Supabase)
# Exemplo: aws-1-eu-west-1.pooler.supabase.com
DB_HOST = os.getenv("DB_HOST")

# Porta de conexão (normalmente 5432 para PostgreSQL)
DB_PORT = os.getenv("DB_PORT", "5432")  # 5432 é o valor padrão se não existir

# Nome da base de dados
DB_NAME = os.getenv("DB_NAME")

# Utilizador da base de dados
DB_USER = os.getenv("DB_USER")

# Password da base de dados (sensível - nunca mostrar em logs!)
DB_PASSWORD = os.getenv("DB_PASSWORD")


# ==============================================================================
# CONFIGURAÇÕES DA APLICAÇÃO
# ==============================================================================

# Nome da aplicação
APP_NAME = os.getenv("APP_NAME", "RAP Nova Escola")

# Versão da aplicação
APP_VERSION = os.getenv("APP_VERSION", "1.0.0")

# Ambiente (development, production, etc)
APP_ENV = os.getenv("APP_ENV", "development")

# Fuso horário
TIMEZONE = os.getenv("TIMEZONE", "Europe/Lisbon")

# Nível de detalhe dos logs
# Valores possíveis: DEBUG, INFO, WARNING, ERROR, CRITICAL
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


# ==============================================================================
# VALIDAÇÃO DAS CONFIGURAÇÕES CRÍTICAS
# ==============================================================================

def validar_configuracoes():
    """
    Verifica se todas as configurações críticas estão definidas.
    
    Configurações críticas são aquelas sem as quais a app não funciona:
    - Dados de conexão à base de dados
    
    Retorna:
        tuple: (sucesso: bool, erros: list)
            - sucesso: True se tudo OK, False se houver erros
            - erros: Lista de mensagens de erro (vazia se tudo OK)
    """
    erros = []
    
    # Verificar configurações obrigatórias da base de dados
    if not DB_HOST:
        erros.append("❌ DB_HOST não está definido no ficheiro .env")
    
    if not DB_NAME:
        erros.append("❌ DB_NAME não está definido no ficheiro .env")
    
    if not DB_USER:
        erros.append("❌ DB_USER não está definido no ficheiro .env")
    
    if not DB_PASSWORD:
        erros.append("❌ DB_PASSWORD não está definido no ficheiro .env")
    
    # Se houver erros, retorna False e a lista de erros
    if erros:
        return False, erros
    
    # Se tudo OK, retorna True e lista vazia
    return True, []


def mostrar_configuracoes(mostrar_sensiveis=False):
    """
    Mostra as configurações atuais no ecrã.
    Útil para debugging e verificação.
    
    Parâmetros:
        mostrar_sensiveis (bool): Se True, mostra passwords (CUIDADO!)
                                  Se False, oculta dados sensíveis
    """
    print("\n" + "="*60)
    print(" CONFIGURAÇÕES DA APLICAÇÃO ".center(60))
    print("="*60)
    
    print("\n📱 Aplicação:")
    print(f"   Nome: {APP_NAME}")
    print(f"   Versão: {APP_VERSION}")
    print(f"   Ambiente: {APP_ENV}")
    print(f"   Timezone: {TIMEZONE}")
    print(f"   Log Level: {LOG_LEVEL}")
    
    print("\n🗄️  Base de Dados:")
    print(f"   Host: {DB_HOST}")
    print(f"   Port: {DB_PORT}")
    print(f"   Database: {DB_NAME}")
    print(f"   User: {DB_USER}")
    
    # Só mostra a password se for explicitamente pedido
    if mostrar_sensiveis:
        print(f"   Password: {DB_PASSWORD}")
    else:
        # Oculta a password mostrando apenas os primeiros caracteres
        if DB_PASSWORD:
            password_oculta = DB_PASSWORD[:3] + "*" * (len(DB_PASSWORD) - 3)
            print(f"   Password: {password_oculta}")
        else:
            print(f"   Password: (não definida)")
    
    print("="*60 + "\n")


# ==============================================================================
# STRING DE CONEXÃO COMPLETA
# ==============================================================================

def obter_connection_string():
    """
    Gera a string de conexão completa para PostgreSQL.
    Formato: postgresql://user:password@host:port/database
    
    Esta string pode ser usada diretamente por bibliotecas como psycopg2.
    
    Retorna:
        str: String de conexão no formato PostgreSQL URI
    """
    return f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"


# ==============================================================================
# TESTE RÁPIDO (apenas quando executado diretamente)
# ==============================================================================

if __name__ == "__main__":
    """
    Este bloco só executa se corrermos:
        python config/settings.py
    
    Útil para testar se as configurações estão a ser lidas corretamente.
    """
    print("🔍 A testar configurações...")
    
    # Validar configurações
    sucesso, erros = validar_configuracoes()
    
    if sucesso:
        print("✅ Todas as configurações críticas estão definidas!")
        mostrar_configuracoes(mostrar_sensiveis=False)
    else:
        print("❌ Erros encontrados nas configurações:")
        for erro in erros:
            print(f"   {erro}")
        print("\n💡 Dica: Verifica o ficheiro .env na raiz do projeto")
    
    print("\n📋 Connection String:")
    print(f"   {obter_connection_string()}")
    print("\n✨ Teste concluído!")
    
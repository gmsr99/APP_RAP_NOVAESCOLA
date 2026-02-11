"""
==============================================================================
Services - Lógica de Negócio da Aplicação RAP Nova Escola
==============================================================================

Este módulo contém todos os services (serviços) da aplicação.
Cada service é responsável por uma área específica da lógica de negócio.

Services disponíveis:
- aula_service: Gestão de aulas (criar, listar, atualizar)
- confirmacao_service: Confirmação e recusa de aulas com logs

Como usar:
    from services import aula_service
    from services import confirmacao_service
    
    # Criar aula
    aula = aula_service.criar_aula(...)
    
    # Confirmar aula
    resultado = confirmacao_service.confirmar_aula(...)
    
==============================================================================
"""

if __name__ == "__main__":
    import sys
    print("❌ Erro: Este ficheiro é um pacote e não deve ser executado diretamente.")
    print("👉 Por favor, execute 'python3 main.py' na pasta raiz do projeto.")
    sys.exit(1)

# Importar services para facilitar uso
from . import aula_service
from . import confirmacao_service

# Permitir importação direta
__all__ = [
    'aula_service',
    'confirmacao_service'
]

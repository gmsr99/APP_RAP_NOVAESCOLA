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

import logging

logger = logging.getLogger(__name__)

if __name__ == "__main__":
    import sys
    logger.error("Este ficheiro é um pacote e não deve ser executado diretamente.")
    logger.info("Por favor, execute 'python3 main.py' na pasta raiz do projeto.")
    sys.exit(1)

# Importar services para facilitar uso
from . import aula_service
from . import confirmacao_service
from . import registo_service
from . import aluno_service
from . import chat_service

# Permitir importação direta
__all__ = [
    'aula_service',
    'confirmacao_service',
    'registo_service',
    'aluno_service',
    'chat_service',
]

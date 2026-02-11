"""
==============================================================================
RAP NOVA ESCOLA - Serviço de Gestão de Aulas
==============================================================================
Ficheiro: services/aula_service.py

Este serviço gere todas as operações relacionadas com aulas/sessões:
- Criar novas aulas
- Listar aulas por estado
- Atribuir mentores
- Atualizar estados
- Cancelar aulas

Estados das aulas:
- 'rascunho' - Aula em planeamento (ainda não foi submetida)
- 'pendente' - Pendente de confirmação
- 'confirmada' - Aula confirmada
- 'recusada' - Aula recusada/rejeitada
- 'em_curso' - Aula a decorrer
- 'concluida' - Aula terminada
- 'cancelada' - Aula cancelada

==============================================================================
"""

import sys
import os

# Adiciona o diretório pai ao sys.path para permitir importações quando executado diretamente
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.connection import get_db_connection
from datetime import datetime


# ==============================================================================
# CONSTANTES - ESTADOS DAS AULAS
# ==============================================================================

ESTADO_RASCUNHO = "rascunho"
ESTADO_PENDENTE = "pendente"
ESTADO_CONFIRMADA = "confirmada"
ESTADO_RECUSADA = "recusada"
ESTADO_EM_CURSO = "em_curso"
ESTADO_CONCLUIDA = "concluida"
ESTADO_CANCELADA = "cancelada"

# Lista de todos os estados válidos
ESTADOS_VALIDOS = [
    ESTADO_RASCUNHO,
    ESTADO_PENDENTE,
    ESTADO_CONFIRMADA,
    ESTADO_RECUSADA,
    ESTADO_EM_CURSO,
    ESTADO_CONCLUIDA,
    ESTADO_CANCELADA
]

# Tipos de aula válidos
TIPOS_AULA = [
    "teorica",
    "pratica_escrita",
    "pratica_gravacao",
    "producao_musical",
    "ensaio",
    "showcase"
]


# ==============================================================================
# FUNÇÃO 1: CRIAR NOVA AULA
# ==============================================================================

def criar_aula(turma_id, data_hora, tipo="pratica_escrita", duracao_minutos=90,
               mentor_id=None, local=None, tema=None, objetivos=None, 
               projeto_id=None, observacoes=None):
    """
    Cria uma nova aula no sistema.
    
    REGRA IMPORTANTE: Ao criar, a aula começa sempre como "pendente" 
    (pendente de confirmação), exceto se não tiver mentor atribuído,
    caso em que começa como "rascunho".
    
    Parâmetros:
        turma_id (int): ID da turma que vai ter a aula (OBRIGATÓRIO)
        data_hora (str/datetime): Data e hora da aula (OBRIGATÓRIO)
                                  Formato: "YYYY-MM-DD HH:MM" ou objeto datetime
        tipo (str): Tipo de aula (padrão: "pratica_escrita")
        duracao_minutos (int): Duração em minutos (padrão: 90)
        mentor_id (int): ID do mentor (OPCIONAL - pode ser atribuído depois)
        local (str): Local específico (sala, estúdio, etc.)
        tema (str): Tema/assunto da aula
        objetivos (str): Objetivos pedagógicos
        projeto_id (int): ID do projeto (opcional)
        observacoes (str): Observações iniciais
    
    Retorna:
        dict: Dados da aula criada (incluindo o ID) ou None se houve erro
        
    Exemplo:
        aula = criar_aula(
            turma_id=1,
            data_hora="2024-12-15 14:00",
            tipo="pratica_gravacao",
            mentor_id=2,
            tema="Técnicas de gravação"
        )
    """
    
    # Validar parâmetros obrigatórios
    if not turma_id:
        print("❌ Erro: turma_id é obrigatório!")
        return None
    
    if not data_hora:
        print("❌ Erro: data_hora é obrigatória!")
        return None
    
    # Validar tipo de aula
    if tipo not in TIPOS_AULA:
        print(f"⚠️  Aviso: Tipo '{tipo}' não é padrão. Tipos válidos: {TIPOS_AULA}")
    
    # Determinar estado inicial
    # Se tem mentor atribuído -> pendente
    # Se não tem mentor -> rascunho (precisa completar antes de submeter)
    estado_inicial = ESTADO_PENDENTE if mentor_id else ESTADO_RASCUNHO
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # SQL para inserir nova aula
        query = """
            INSERT INTO aulas (
                turma_id, mentor_id, projeto_id,
                tipo, data_hora, duracao_minutos, estado,
                local, tema, objetivos, observacoes
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, estado, criado_em;
        """
        
        # Executar insert
        cur.execute(query, (
            turma_id, mentor_id, projeto_id,
            tipo, data_hora, duracao_minutos, estado_inicial,
            local, tema, objetivos, observacoes
        ))
        
        # Obter o ID da aula criada
        resultado = cur.fetchone()
        aula_id = resultado[0]
        estado = resultado[1]
        criado_em = resultado[2]
        
        # Confirmar transação
        conn.commit()
        
        print(f"✅ Aula #{aula_id} criada com sucesso!")
        print(f"   Estado inicial: {estado}")
        print(f"   Criada em: {criado_em}")
        
        cur.close()
        conn.close()
        
        # Retornar dados da aula criada
        return {
            'id': aula_id,
            'turma_id': turma_id,
            'mentor_id': mentor_id,
            'tipo': tipo,
            'data_hora': data_hora,
            'estado': estado,
            'criado_em': criado_em
        }
        
    except Exception as e:
        print(f"❌ Erro ao criar aula: {e}")
        if conn:
            conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ==============================================================================
# FUNÇÃO 2: LISTAR AULAS POR ESTADO
# ==============================================================================

def listar_aulas_por_estado(estado, limite=50):
    """
    Lista todas as aulas com um determinado estado.
    
    Parâmetros:
        estado (str): Estado das aulas a listar
                      ('rascunho', 'pendente', 'confirmada', 'recusada', etc.)
        limite (int): Número máximo de resultados (padrão: 50)
    
    Retorna:
        list: Lista de dicionários com dados das aulas, ou lista vazia se não houver
        
    Exemplo:
        aulas_pendentes = listar_aulas_por_estado('pendente')
        for aula in aulas_pendentes:
            print(f"Aula #{aula['id']} - {aula['tema']}")
    """
    
    # Validar estado
    if estado not in ESTADOS_VALIDOS:
        print(f"⚠️  Aviso: Estado '{estado}' pode não ser válido.")
        print(f"   Estados válidos: {ESTADOS_VALIDOS}")
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Query com JOIN para trazer informações relacionadas
        query = """
            SELECT 
                a.id,
                a.tipo,
                a.data_hora,
                a.duracao_minutos,
                a.estado,
                a.local,
                a.tema,
                a.objetivos,
                a.observacoes,
                a.criado_em,
                t.nome as turma_nome,
                t.id as turma_id,
                m.nome as mentor_nome,
                m.id as mentor_id,
                i.nome as instituicao_nome
            FROM aulas a
            JOIN turmas t ON a.turma_id = t.id
            LEFT JOIN mentores m ON a.mentor_id = m.id
            JOIN instituicoes i ON t.instituicao_id = i.id
            WHERE a.estado = %s
            ORDER BY a.data_hora DESC
            LIMIT %s;
        """
        
        cur.execute(query, (estado, limite))
        resultados = cur.fetchall()
        
        # Converter resultados em lista de dicionários
        aulas = []
        for row in resultados:
            aula = {
                'id': row[0],
                'tipo': row[1],
                'data_hora': row[2],
                'duracao_minutos': row[3],
                'estado': row[4],
                'local': row[5],
                'tema': row[6],
                'objetivos': row[7],
                'observacoes': row[8],
                'criado_em': row[9],
                'turma_nome': row[10],
                'turma_id': row[11],
                'mentor_nome': row[12] if row[12] else "Sem mentor atribuído",
                'mentor_id': row[13],
                'instituicao_nome': row[14]
            }
            aulas.append(aula)
        
        cur.close()
        conn.close()
        
        print(f"📋 {len(aulas)} aula(s) encontrada(s) com estado '{estado}'")
        
        return aulas
        
    except Exception as e:
        print(f"❌ Erro ao listar aulas: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ==============================================================================
# FUNÇÃO 3: ATRIBUIR MENTOR A UMA AULA
# ==============================================================================

def atribuir_mentor(aula_id, mentor_id):
    """
    Atribui um mentor a uma aula.
    
    REGRA IMPORTANTE: Se a aula estava em "rascunho" e não tinha mentor,
    ao atribuir mentor, o estado muda automaticamente para "pendente".
    
    Parâmetros:
        aula_id (int): ID da aula
        mentor_id (int): ID do mentor a atribuir
    
    Retorna:
        bool: True se sucesso, False se erro
        
    Exemplo:
        sucesso = atribuir_mentor(aula_id=5, mentor_id=2)
    """
    
    if not aula_id or not mentor_id:
        print("❌ Erro: aula_id e mentor_id são obrigatórios!")
        return False
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Primeiro, verificar o estado atual da aula
        cur.execute("SELECT estado, mentor_id FROM aulas WHERE id = %s", (aula_id,))
        resultado = cur.fetchone()
        
        if not resultado:
            print(f"❌ Erro: Aula #{aula_id} não encontrada!")
            return False
        
        estado_atual = resultado[0]
        mentor_atual = resultado[1]
        
        # Determinar novo estado
        # Se estava em rascunho e não tinha mentor -> passa a pendente
        if estado_atual == ESTADO_RASCUNHO and not mentor_atual:
            novo_estado = ESTADO_PENDENTE
            mudou_estado = True
        else:
            novo_estado = estado_atual
            mudou_estado = False
        
        # Atualizar mentor (e possivelmente o estado)
        query = """
            UPDATE aulas 
            SET mentor_id = %s, 
                estado = %s,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = %s;
        """
        
        cur.execute(query, (mentor_id, novo_estado, aula_id))
        conn.commit()
        
        # Obter nome do mentor para mensagem
        cur.execute("SELECT nome FROM mentores WHERE id = %s", (mentor_id,))
        mentor_nome = cur.fetchone()[0]
        
        print(f"✅ Mentor '{mentor_nome}' atribuído à aula #{aula_id}")
        
        if mudou_estado:
            print(f"   Estado mudou: '{estado_atual}' → '{novo_estado}'")
        
        cur.close()
        conn.close()
        
        # Enviar notificação Slack
        try:
            from notifications import slack_service
            
            # Buscar informações completas da aula
            aula = obter_aula_por_id(aula_id)
            
            if aula:
                slack_service.notificar_aula_atribuida(
                    aula_id=aula_id,
                    mentor_nome=aula['mentor_nome'],
                    turma_nome=aula['turma_nome'],
                    data_hora=aula['data_hora'],
                    tipo_aula=aula['tipo'],
                    instituicao_nome=aula['instituicao_nome'],
                    tema=aula['tema']
                )
        except Exception as e:
            print(f"⚠️  Aviso: Erro ao enviar notificação Slack: {e}")
            # Não interrompe o fluxo principal
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao atribuir mentor: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ==============================================================================
# FUNÇÕES AUXILIARES
# ==============================================================================

def mudar_estado_aula(aula_id, novo_estado, observacao=None):
    """
    Muda o estado de uma aula.
    
    Parâmetros:
        aula_id (int): ID da aula
        novo_estado (str): Novo estado ('confirmada', 'recusada', etc.)
        observacao (str): Motivo/observação sobre a mudança (opcional)
    
    Retorna:
        bool: True se sucesso, False se erro
    """
    
    if novo_estado not in ESTADOS_VALIDOS:
        print(f"❌ Erro: Estado '{novo_estado}' não é válido!")
        print(f"   Estados válidos: {ESTADOS_VALIDOS}")
        return False
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Obter estado atual
        cur.execute("SELECT estado FROM aulas WHERE id = %s", (aula_id,))
        resultado = cur.fetchone()
        
        if not resultado:
            print(f"❌ Erro: Aula #{aula_id} não encontrada!")
            return False
        
        estado_anterior = resultado[0]
        
        # Atualizar estado
        query = """
            UPDATE aulas 
            SET estado = %s,
                observacoes = COALESCE(observacoes || E'\n', '') || %s,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = %s;
        """
        
        # Criar nota sobre mudança de estado
        nota_mudanca = f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Estado: '{estado_anterior}' → '{novo_estado}'"
        if observacao:
            nota_mudanca += f" | {observacao}"
        
        cur.execute(query, (novo_estado, nota_mudanca, aula_id))
        conn.commit()
        
        print(f"✅ Estado da aula #{aula_id} atualizado: '{estado_anterior}' → '{novo_estado}'")
        
        cur.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao mudar estado: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def obter_aula_por_id(aula_id):
    """
    Obtém os detalhes completos de uma aula específica.
    
    Parâmetros:
        aula_id (int): ID da aula
    
    Retorna:
        dict: Dados da aula ou None se não encontrada
    """
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = """
            SELECT 
                a.id, a.tipo, a.data_hora, a.duracao_minutos, a.estado,
                a.local, a.tema, a.objetivos, a.observacoes,
                a.criado_em, a.atualizado_em,
                t.nome as turma_nome, t.id as turma_id,
                m.nome as mentor_nome, m.id as mentor_id,
                i.nome as instituicao_nome,
                p.nome as projeto_nome
            FROM aulas a
            JOIN turmas t ON a.turma_id = t.id
            LEFT JOIN mentores m ON a.mentor_id = m.id
            JOIN instituicoes i ON t.instituicao_id = i.id
            LEFT JOIN projetos p ON a.projeto_id = p.id
            WHERE a.id = %s;
        """
        
        cur.execute(query, (aula_id,))
        row = cur.fetchone()
        
        if not row:
            print(f"❌ Aula #{aula_id} não encontrada!")
            return None
        
        aula = {
            'id': row[0],
            'tipo': row[1],
            'data_hora': row[2],
            'duracao_minutos': row[3],
            'estado': row[4],
            'local': row[5],
            'tema': row[6],
            'objetivos': row[7],
            'observacoes': row[8],
            'criado_em': row[9],
            'atualizado_em': row[10],
            'turma_nome': row[11],
            'turma_id': row[12],
            'mentor_nome': row[13],
            'mentor_id': row[14],
            'instituicao_nome': row[15],
            'projeto_nome': row[16]
        }
        
        cur.close()
        conn.close()
        
        return aula
        
    except Exception as e:
        print(f"❌ Erro ao obter aula: {e}")
        return None
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def listar_todas_aulas(limite=100):
    """
    Lista todas as aulas (independente do estado).
    
    Parâmetros:
        limite (int): Número máximo de resultados
    
    Retorna:
        list: Lista de dicionários com dados das aulas
    """
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = """
            SELECT 
                a.id, a.tipo, a.data_hora, a.estado, a.tema,
                t.nome as turma_nome,
                m.nome as mentor_nome,
                i.nome as instituicao_nome
            FROM aulas a
            JOIN turmas t ON a.turma_id = t.id
            LEFT JOIN mentores m ON a.mentor_id = m.id
            JOIN instituicoes i ON t.instituicao_id = i.id
            ORDER BY a.data_hora DESC
            LIMIT %s;
        """
        
        cur.execute(query, (limite,))
        resultados = cur.fetchall()
        
        aulas = []
        for row in resultados:
            aulas.append({
                'id': row[0],
                'tipo': row[1],
                'data_hora': row[2],
                'estado': row[3],
                'tema': row[4],
                'turma_nome': row[5],
                'mentor_nome': row[6] if row[6] else "Sem mentor",
                'instituicao_nome': row[7]
            })
        
        cur.close()
        conn.close()
        
        return aulas
        
    except Exception as e:
        print(f"❌ Erro ao listar aulas: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ==============================================================================
# EXEMPLO DE USO (apenas para testes)
# ==============================================================================

if __name__ == "__main__":
    """
    Exemplos de como usar as funções.
    Execute: python services/aula_service.py
    """
    
    print("="*70)
    print(" TESTE DO SERVIÇO DE AULAS ".center(70))
    print("="*70)
    print()
    
    # Este é apenas um exemplo - em produção, os IDs virão do sistema
    print("💡 Para testar, certifica-te que tens pelo menos:")
    print("   - 1 instituição criada")
    print("   - 1 turma criada")
    print("   - 1 mentor criado")
    print()

"""
==============================================================================
RAP NOVA ESCOLA - Serviço de Gestão de Equipamentos
==============================================================================
Ficheiro: services/equipamento_service.py

Este serviço gere todo o inventário de equipamentos:
- Microfones, headphones, interfaces, computadores, etc.
- Registo, atualização de estado, localização
- Controlo de disponibilidade
- Atribuição de responsáveis
- Logs automáticos de todas as movimentações

Estados possíveis:
- 'perfeito' - Equipamento em perfeito estado
- 'observacoes' - Funcionando mas com observações
- 'manutencao' - Em manutenção
- 'indisponivel' - Avariado ou perdido

==============================================================================
"""

from database.connection import get_db_connection
from datetime import datetime


# ==============================================================================
# CONSTANTES - ESTADOS E TIPOS
# ==============================================================================

# Estados do equipamento
ESTADO_PERFEITO = "perfeito"
ESTADO_OBSERVACOES = "observacoes"
ESTADO_MANUTENCAO = "manutencao"
ESTADO_INDISPONIVEL = "indisponivel"

ESTADOS_VALIDOS = [
    ESTADO_PERFEITO,
    ESTADO_OBSERVACOES,
    ESTADO_MANUTENCAO,
    ESTADO_INDISPONIVEL
]

# Tipos de equipamento comuns
TIPOS_EQUIPAMENTO = [
    "microfone",
    "headphone",
    "interface_audio",
    "computador",
    "controlador_midi",
    "cabo",
    "mesa_mistura",
    "monitor",
    "outro"
]


# ==============================================================================
# FUNÇÃO 1: REGISTAR NOVO EQUIPAMENTO
# ==============================================================================

def registar_equipamento(tipo, nome, codigo=None, quantidade_total=1, 
                        localizacao=None, responsavel=None, observacoes=None):
    """
    Regista um novo equipamento no inventário.
    
    Parâmetros:
        tipo (str): Tipo de equipamento (microfone, headphone, etc.)
        nome (str): Nome/modelo do equipamento (ex: "Shure SM58")
        codigo (str): Código de inventário/série (opcional, gerado automaticamente se None)
        quantidade_total (int): Quantidade (padrão: 1)
        localizacao (str): Onde está guardado (opcional)
        responsavel (str): Quem é responsável (opcional)
        observacoes (str): Observações iniciais (opcional)
    
    Retorna:
        dict: Dados do equipamento registado ou None se erro
        
    Exemplo:
        equipamento = registar_equipamento(
            tipo="microfone",
            nome="Shure SM58",
            codigo="MIC-001",
            quantidade_total=3,
            localizacao="Estúdio A",
            responsavel="João Silva"
        )
    """
    
    if not tipo or not nome:
        print("❌ Erro: Tipo e nome são obrigatórios!")
        return None
    
    # Gerar código automático se não fornecido
    if not codigo:
        codigo = gerar_codigo_automatico(tipo)
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Verificar se código já existe
        cur.execute("SELECT id FROM equipamentos WHERE codigo = %s", (codigo,))
        if cur.fetchone():
            print(f"❌ Erro: Código '{codigo}' já existe!")
            cur.close()
            conn.close()
            return None
        
        # Estado inicial sempre "perfeito" para equipamento novo
        estado_inicial = ESTADO_PERFEITO
        quantidade_disponivel = quantidade_total  # Todo disponível inicialmente
        
        # Inserir equipamento
        query = """
            INSERT INTO equipamentos (
                tipo,
                nome,
                codigo,
                quantidade_total,
                quantidade_disponivel,
                estado,
                localizacao,
                observacoes
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, codigo, criado_em;
        """
        
        cur.execute(query, (
            tipo,
            nome,
            codigo,
            quantidade_total,
            quantidade_disponivel,
            estado_inicial,
            localizacao,
            observacoes
        ))
        
        resultado = cur.fetchone()
        equipamento_id = resultado[0]
        codigo_final = resultado[1]
        criado_em = resultado[2]
        
        conn.commit()
        
        # Criar log de registo
        criar_log_equipamento(
            tipo_acao='registar',
            equipamento_id=equipamento_id,
            descricao=f"Equipamento registado: {nome} (Código: {codigo_final})",
            usuario=responsavel,
            dados_adicionais=f"Tipo: {tipo} | Quantidade: {quantidade_total} | Localização: {localizacao or 'Não definida'}"
        )
        
        print(f"\n✅ Equipamento registado com sucesso!")
        print(f"   ID: {equipamento_id}")
        print(f"   Código: {codigo_final}")
        print(f"   Tipo: {tipo}")
        print(f"   Nome: {nome}")
        print(f"   Quantidade: {quantidade_total}")
        print(f"   Estado: {estado_inicial}")
        
        cur.close()
        conn.close()
        
        return {
            'id': equipamento_id,
            'tipo': tipo,
            'nome': nome,
            'codigo': codigo_final,
            'quantidade_total': quantidade_total,
            'quantidade_disponivel': quantidade_disponivel,
            'estado': estado_inicial,
            'localizacao': localizacao,
            'criado_em': criado_em
        }
        
    except Exception as e:
        print(f"❌ Erro ao registar equipamento: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ==============================================================================
# FUNÇÃO 2: ATUALIZAR ESTADO DO EQUIPAMENTO
# ==============================================================================

def atualizar_estado(equipamento_id, novo_estado, observacoes=None, responsavel=None):
    """
    Atualiza o estado de um equipamento.
    
    Estados possíveis:
    - 'perfeito' - Funcionando perfeitamente
    - 'observacoes' - Funciona mas tem observações
    - 'manutencao' - Está em manutenção
    - 'indisponivel' - Avariado ou perdido
    
    Parâmetros:
        equipamento_id (int): ID do equipamento
        novo_estado (str): Novo estado
        observacoes (str): Observações sobre a mudança (opcional mas recomendado)
        responsavel (str): Quem fez a mudança (opcional)
    
    Retorna:
        bool: True se sucesso, False se erro
        
    Exemplo:
        atualizar_estado(
            equipamento_id=5,
            novo_estado='manutencao',
            observacoes='Cabo do microfone com ruído',
            responsavel='João Silva'
        )
    """
    
    if novo_estado not in ESTADOS_VALIDOS:
        print(f"❌ Erro: Estado '{novo_estado}' não é válido!")
        print(f"   Estados válidos: {ESTADOS_VALIDOS}")
        return False
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Buscar estado atual
        cur.execute("""
            SELECT nome, codigo, estado, quantidade_total, quantidade_disponivel 
            FROM equipamentos 
            WHERE id = %s
        """, (equipamento_id,))
        
        resultado = cur.fetchone()
        if not resultado:
            print(f"❌ Erro: Equipamento #{equipamento_id} não encontrado!")
            return False
        
        nome = resultado[0]
        codigo = resultado[1]
        estado_anterior = resultado[2]
        qtd_total = resultado[3]
        qtd_disponivel = resultado[4]
        
        # Atualizar quantidade disponível baseado no estado
        if novo_estado == ESTADO_INDISPONIVEL or novo_estado == ESTADO_MANUTENCAO:
            # Se fica indisponível ou em manutenção, reduz disponibilidade
            nova_qtd_disponivel = 0
        else:
            # Se volta a ficar disponível, restaura quantidade
            nova_qtd_disponivel = qtd_total
        
        # Preparar nota sobre mudança
        nota_mudanca = f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Estado: '{estado_anterior}' → '{novo_estado}'"
        if observacoes:
            nota_mudanca += f" | {observacoes}"
        
        # Atualizar equipamento
        query = """
            UPDATE equipamentos
            SET estado = %s,
                quantidade_disponivel = %s,
                observacoes = COALESCE(observacoes || E'\n', '') || %s,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = %s;
        """
        
        cur.execute(query, (
            novo_estado,
            nova_qtd_disponivel,
            nota_mudanca,
            equipamento_id
        ))
        
        conn.commit()
        
        # Criar log
        descricao_log = f"Estado alterado: {nome} (Código: {codigo})"
        dados_adicionais = f"Estado anterior: {estado_anterior} | Estado novo: {novo_estado}"
        if observacoes:
            dados_adicionais += f" | Obs: {observacoes}"
        
        criar_log_equipamento(
            tipo_acao='atualizar_estado',
            equipamento_id=equipamento_id,
            descricao=descricao_log,
            usuario=responsavel,
            dados_adicionais=dados_adicionais
        )
        
        print(f"\n✅ Estado atualizado com sucesso!")
        print(f"   Equipamento: {nome}")
        print(f"   Estado anterior: {estado_anterior}")
        print(f"   Estado novo: {novo_estado}")
        print(f"   Disponível: {nova_qtd_disponivel}/{qtd_total}")
        
        cur.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao atualizar estado: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ==============================================================================
# FUNÇÃO 3: ATUALIZAR LOCALIZAÇÃO
# ==============================================================================

def atualizar_localizacao(equipamento_id, nova_localizacao, responsavel=None, motivo=None):
    """
    Atualiza a localização de um equipamento.
    
    Útil para rastrear onde está cada equipamento.
    
    Parâmetros:
        equipamento_id (int): ID do equipamento
        nova_localizacao (str): Nova localização (ex: "Estúdio B", "Armazém")
        responsavel (str): Quem movimentou (opcional)
        motivo (str): Motivo da movimentação (opcional)
    
    Retorna:
        bool: True se sucesso, False se erro
        
    Exemplo:
        atualizar_localizacao(
            equipamento_id=3,
            nova_localizacao='Estúdio B',
            responsavel='Maria Santos',
            motivo='Sessão de gravação'
        )
    """
    
    if not nova_localizacao or nova_localizacao.strip() == "":
        print("❌ Erro: Nova localização não pode estar vazia!")
        return False
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Buscar localização atual
        cur.execute("""
            SELECT nome, codigo, localizacao 
            FROM equipamentos 
            WHERE id = %s
        """, (equipamento_id,))
        
        resultado = cur.fetchone()
        if not resultado:
            print(f"❌ Erro: Equipamento #{equipamento_id} não encontrado!")
            return False
        
        nome = resultado[0]
        codigo = resultado[1]
        localizacao_anterior = resultado[2] or "Não definida"
        
        # Preparar nota de movimentação
        nota_movimentacao = f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Localização: '{localizacao_anterior}' → '{nova_localizacao}'"
        if responsavel:
            nota_movimentacao += f" | Responsável: {responsavel}"
        if motivo:
            nota_movimentacao += f" | Motivo: {motivo}"
        
        # Atualizar localização
        query = """
            UPDATE equipamentos
            SET localizacao = %s,
                observacoes = COALESCE(observacoes || E'\n', '') || %s,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = %s;
        """
        
        cur.execute(query, (
            nova_localizacao,
            nota_movimentacao,
            equipamento_id
        ))
        
        conn.commit()
        
        # Criar log
        descricao_log = f"Localização alterada: {nome} (Código: {codigo})"
        dados_adicionais = f"De: {localizacao_anterior} | Para: {nova_localizacao}"
        if motivo:
            dados_adicionais += f" | Motivo: {motivo}"
        
        criar_log_equipamento(
            tipo_acao='movimentar',
            equipamento_id=equipamento_id,
            descricao=descricao_log,
            usuario=responsavel,
            dados_adicionais=dados_adicionais
        )
        
        print(f"\n✅ Localização atualizada com sucesso!")
        print(f"   Equipamento: {nome}")
        print(f"   De: {localizacao_anterior}")
        print(f"   Para: {nova_localizacao}")
        
        cur.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao atualizar localização: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ==============================================================================
# FUNÇÃO 4: ATRIBUIR RESPONSÁVEL
# ==============================================================================

def atribuir_responsavel(equipamento_id, responsavel, data_devolucao=None, observacoes=None):
    """
    Atribui um responsável ao equipamento.
    
    Útil para rastrear quem está com o equipamento.
    Importante: Esta função NÃO cria campo novo na BD, apenas regista nos logs
    e observações quem foi a última pessoa a usar.
    
    Parâmetros:
        equipamento_id (int): ID do equipamento
        responsavel (str): Nome da pessoa responsável
        data_devolucao (str): Data prevista de devolução (opcional)
        observacoes (str): Observações sobre a atribuição (opcional)
    
    Retorna:
        bool: True se sucesso, False se erro
        
    Exemplo:
        atribuir_responsavel(
            equipamento_id=7,
            responsavel='João Silva',
            data_devolucao='2024-12-25',
            observacoes='Para sessão de gravação'
        )
    """
    
    if not responsavel or responsavel.strip() == "":
        print("❌ Erro: Nome do responsável não pode estar vazio!")
        return False
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Buscar equipamento
        cur.execute("""
            SELECT nome, codigo, estado, quantidade_disponivel 
            FROM equipamentos 
            WHERE id = %s
        """, (equipamento_id,))
        
        resultado = cur.fetchone()
        if not resultado:
            print(f"❌ Erro: Equipamento #{equipamento_id} não encontrado!")
            return False
        
        nome = resultado[0]
        codigo = resultado[1]
        estado = resultado[2]
        qtd_disponivel = resultado[3]
        
        # Avisar se equipamento não está disponível
        if qtd_disponivel <= 0:
            print(f"⚠️  Aviso: Este equipamento está indisponível (quantidade: {qtd_disponivel})")
            confirmar = input("   Continuar mesmo assim? (s/n): ").lower()
            if confirmar != 's':
                return False
        
        # Preparar nota de atribuição
        nota_atribuicao = f"[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Atribuído a: {responsavel}"
        if data_devolucao:
            nota_atribuicao += f" | Devolução prevista: {data_devolucao}"
        if observacoes:
            nota_atribuicao += f" | {observacoes}"
        
        # Adicionar às observações
        query = """
            UPDATE equipamentos
            SET observacoes = COALESCE(observacoes || E'\n', '') || %s,
                atualizado_em = CURRENT_TIMESTAMP
            WHERE id = %s;
        """
        
        cur.execute(query, (nota_atribuicao, equipamento_id))
        conn.commit()
        
        # Criar log
        descricao_log = f"Equipamento atribuído: {nome} (Código: {codigo}) → {responsavel}"
        dados_adicionais = f"Responsável: {responsavel} | Estado: {estado}"
        if data_devolucao:
            dados_adicionais += f" | Devolução: {data_devolucao}"
        if observacoes:
            dados_adicionais += f" | Obs: {observacoes}"
        
        criar_log_equipamento(
            tipo_acao='atribuir',
            equipamento_id=equipamento_id,
            descricao=descricao_log,
            usuario=responsavel,
            dados_adicionais=dados_adicionais
        )
        
        print(f"\n✅ Responsável atribuído com sucesso!")
        print(f"   Equipamento: {nome}")
        print(f"   Responsável: {responsavel}")
        if data_devolucao:
            print(f"   Devolução prevista: {data_devolucao}")
        
        cur.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Erro ao atribuir responsável: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ==============================================================================
# FUNÇÃO AUXILIAR: CRIAR LOG DE EQUIPAMENTO
# ==============================================================================

def criar_log_equipamento(tipo_acao, equipamento_id, descricao, usuario=None, dados_adicionais=None):
    """
    Cria log específico para operações de equipamento.
    
    Parâmetros:
        tipo_acao (str): 'registar', 'atualizar_estado', 'movimentar', 'atribuir'
        equipamento_id (int): ID do equipamento
        descricao (str): Descrição da ação
        usuario (str): Quem fez a ação
        dados_adicionais (str): Informação extra
    
    Retorna:
        int: ID do log criado ou None se erro
    """
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = """
            INSERT INTO logs (
                tipo_acao,
                entidade,
                entidade_id,
                descricao,
                usuario,
                dados_adicionais
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id;
        """
        
        cur.execute(query, (
            tipo_acao,
            'equipamento',
            equipamento_id,
            descricao,
            usuario or 'Sistema',
            dados_adicionais
        ))
        
        log_id = cur.fetchone()[0]
        conn.commit()
        
        cur.close()
        conn.close()
        
        return log_id
        
    except Exception as e:
        print(f"⚠️  Aviso: Erro ao criar log: {e}")
        if 'conn' in locals() and conn:
            conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ==============================================================================
# FUNÇÃO AUXILIAR: GERAR CÓDIGO AUTOMÁTICO
# ==============================================================================

def gerar_codigo_automatico(tipo):
    """
    Gera código automático para equipamento baseado no tipo.
    
    Formato: TIPO-XXX (ex: MIC-001, HEAD-002)
    
    Parâmetros:
        tipo (str): Tipo do equipamento
    
    Retorna:
        str: Código gerado
    """
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Prefixo baseado no tipo
        prefixos = {
            'microfone': 'MIC',
            'headphone': 'HEAD',
            'interface_audio': 'INT',
            'computador': 'PC',
            'controlador_midi': 'MIDI',
            'cabo': 'CABO',
            'mesa_mistura': 'MESA',
            'monitor': 'MON',
            'outro': 'OUT'
        }
        
        prefixo = prefixos.get(tipo, 'EQ')
        
        # Contar quantos já existem deste tipo
        cur.execute("""
            SELECT COUNT(*) FROM equipamentos 
            WHERE tipo = %s
        """, (tipo,))
        
        count = cur.fetchone()[0]
        numero = count + 1
        
        codigo = f"{prefixo}-{numero:03d}"
        
        cur.close()
        conn.close()
        
        return codigo
        
    except Exception as e:
        print(f"⚠️  Erro ao gerar código: {e}")
        return f"EQ-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ==============================================================================
# FUNÇÕES DE CONSULTA
# ==============================================================================

def listar_equipamentos(filtro_tipo=None, filtro_estado=None, filtro_localizacao=None):
    """
    Lista equipamentos com filtros opcionais.
    
    Parâmetros:
        filtro_tipo (str): Filtrar por tipo (opcional)
        filtro_estado (str): Filtrar por estado (opcional)
        filtro_localizacao (str): Filtrar por localização (opcional)
    
    Retorna:
        list: Lista de equipamentos
    """
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Construir query com filtros
        query = "SELECT * FROM equipamentos WHERE 1=1"
        params = []
        
        if filtro_tipo:
            query += " AND tipo = %s"
            params.append(filtro_tipo)
        
        if filtro_estado:
            query += " AND estado = %s"
            params.append(filtro_estado)
        
        if filtro_localizacao:
            query += " AND localizacao ILIKE %s"
            params.append(f"%{filtro_localizacao}%")
        
        query += " ORDER BY tipo, nome"
        
        cur.execute(query, tuple(params))
        resultados = cur.fetchall()
        
        equipamentos = []
        for row in resultados:
            equipamentos.append({
                'id': row[0],
                'tipo': row[1],
                'nome': row[2],
                'codigo': row[3],
                'quantidade_total': row[4],
                'quantidade_disponivel': row[5],
                'estado': row[6],
                'localizacao': row[7],
                'observacoes': row[8],
                'criado_em': row[9],
                'atualizado_em': row[10]
            })
        
        cur.close()
        conn.close()
        
        return equipamentos
        
    except Exception as e:
        print(f"❌ Erro ao listar equipamentos: {e}")
        return []
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


def obter_equipamento_por_id(equipamento_id):
    """
    Obtém detalhes completos de um equipamento específico.
    
    Parâmetros:
        equipamento_id (int): ID do equipamento
    
    Retorna:
        dict: Dados do equipamento ou None se não encontrado
    """
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT * FROM equipamentos WHERE id = %s", (equipamento_id,))
        row = cur.fetchone()
        
        if not row:
            print(f"❌ Equipamento #{equipamento_id} não encontrado!")
            return None
        
        equipamento = {
            'id': row[0],
            'tipo': row[1],
            'nome': row[2],
            'codigo': row[3],
            'quantidade_total': row[4],
            'quantidade_disponivel': row[5],
            'estado': row[6],
            'localizacao': row[7],
            'observacoes': row[8],
            'criado_em': row[9],
            'atualizado_em': row[10]
        }
        
        cur.close()
        conn.close()
        
        return equipamento
        
    except Exception as e:
        print(f"❌ Erro ao obter equipamento: {e}")
        return None
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()


# ==============================================================================
# EXEMPLO DE USO
# ==============================================================================

if __name__ == "__main__":
    """
    Exemplos de como usar o serviço.
    Execute: python services/equipamento_service.py
    """
    
    print("="*70)
    print(" TESTE DO SERVIÇO DE GESTÃO DE EQUIPAMENTOS ".center(70))
    print("="*70)
    print()
    
    print("💡 Funções disponíveis:")
    print("   1. registar_equipamento()")
    print("   2. atualizar_estado()")
    print("   3. atualizar_localizacao()")
    print("   4. atribuir_responsavel()")
    print("   5. listar_equipamentos()")
    print("   6. obter_equipamento_por_id()")
    print()
    print("💡 Execute as funções para testar!")

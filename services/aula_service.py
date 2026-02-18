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
               projeto_id=None, observacoes=None, atividade_id=None, equipamento_id=None):
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
                local, tema, objetivos, observacoes,
                atividade_id, equipamento_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, estado, criado_em;
        """
        
        # Executar insert
        cur.execute(query, (
            turma_id, mentor_id, projeto_id,
            tipo, data_hora, duracao_minutos, estado_inicial,
            local, tema, objetivos, observacoes,
            atividade_id, equipamento_id
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

        # Notificar Mentor se atribuído
        if mentor_id:
            try:
                from services import notification_service, turma_service, profile_service
                
                # 1. Obter email do mentor
                email_mentor = turma_service.obter_email_mentor(mentor_id)
                
                if email_mentor:
                    # 2. Obter UUID do profile
                    profile_id = profile_service.obter_profile_id_por_email(email_mentor)
                    
                    if profile_id:
                        # 3. Criar notificação
                        notification_service.criar_notificacao(
                            user_id=profile_id,
                            tipo="session_created",
                            titulo="Nova Sessão Atribuída",
                            mensagem=f"Foi-lhe atribuída uma nova sessão a {data_hora}.",
                            link="/dashboard", 
                            metadados={"aula_id": aula_id}
                        )
            except Exception as e:
                print(f"⚠️ Erro ao criar notificação: {e}")
        
        # Retornar dados da aula criada
        return {
            'id': aula_id,
            'turma_id': turma_id,
            'mentor_id': mentor_id,
            'atividade_id': atividade_id,
            'equipamento_id': equipamento_id,
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
        list: Lista de dicionáterios com dados das aulas, ou lista vazia se não houver
        
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
                e.nome as estabelecimento_nome,
                m.user_id as mentor_user_id
            FROM aulas a
            JOIN turmas t ON a.turma_id = t.id
            LEFT JOIN mentores m ON a.mentor_id = m.id
            JOIN estabelecimentos e ON t.estabelecimento_id = e.id
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
                'mentor_user_id': row[15], # UUID do mentor
                'estabelecimento_nome': row[14]
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
        
        # Enviar notificação Slack e Sistema
        try:
            from notifications import slack_service
            from services import notification_service
            
            # Buscar informações completas da aula
            aula = obter_aula_por_id(aula_id)
            
            if aula:
                # Slack
                slack_service.notificar_aula_atribuida(
                    aula_id=aula_id,
                    mentor_nome=aula['mentor_nome'],
                    turma_nome=aula['turma_nome'],
                    data_hora=aula['data_hora'],
                    tipo_aula=aula['tipo'],
                    estabelecimento_nome=aula['estabelecimento_nome'],
                    tema=aula['tema']
                )

                # Notificação Sistema
                # Resolvendo ID do Mentor -> UUID
                email_mentor = aula['mentor_email'] if 'mentor_email' in aula else None
                # Se não vier no obter_aula_por_id, buscar via serviço
                if not email_mentor:
                    # Precisamos importar turma_service aqui se não estiver no topo
                    from services import turma_service
                    email_mentor = turma_service.obter_email_mentor(mentor_id)

                if email_mentor:
                    from services import profile_service
                    profile_id = profile_service.obter_profile_id_por_email(email_mentor)
                    
                    if profile_id:
                        notification_service.criar_notificacao(
                            user_id=profile_id,
                            tipo="session_created",
                            titulo="Nova Sessão Atribuída",
                            mensagem=f"Foi-lhe atribuída a sessão de '{aula['turma_nome']}' a {aula['data_hora']}.",
                            link="/dashboard",
                            metadados={"aula_id": aula_id}
                        )

        except Exception as e:
            print(f"⚠️  Aviso: Erro ao enviar notificação: {e}")
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
        
        # Identificar quem deve ser notificado
        # Se confirmar/recusar -> Notificar Coordenadores
        # Buscar UUIDs dos coordenadores na tabela profiles
        conn = get_db_connection() # Reabrir conexão pois foi fechada
        cur = conn.cursor()
        
        # Simplificação: Buscar perfis com role 'coordenador'
        # Nota: A tabela profiles no Supabase mapeia users auth.
        # Precisamos garantir que temos acesso a essa info. 
        # Se a tabela profiles estiver syncada, podemos usar:
        try:
            # Opção A: Usar profile_service (Supabase client)
            from services import profile_service
            perfis = profile_service.listar_perfis()
            coordenadores_ids = [p['id'] for p in perfis if p.get('role') == 'coordenador']
            
            # Opção B: SQL direto se profiles estiver no public (o que parece estar pelo list_tables)
            # cur.execute("SELECT id FROM profiles WHERE role = 'coordenador'")
            # coordenadores_ids = [r[0] for r in cur.fetchall()]
        except:
            coordenadores_ids = []

        cur.close()
        conn.close()

        if novo_estado in [ESTADO_CONFIRMADA, ESTADO_RECUSADA]:
            try:
                from services import notification_service
                aulaInfo = obter_aula_por_id(aula_id)
                mentor_nome = aulaInfo['mentor_nome'] if aulaInfo else "Um mentor"
                
                titulo = "Sessão Confirmada" if novo_estado == ESTADO_CONFIRMADA else "Sessão Recusada"
                msg = f"{mentor_nome} {novo_estado} a sessão de {aulaInfo['data_hora']}."

                for coord_id in coordenadores_ids:
                    notification_service.criar_notificacao(
                        user_id=coord_id,
                        tipo=f"session_{novo_estado}", 
                        titulo=titulo,
                        mensagem=msg,
                        link="/horarios",
                        metadados={"aula_id": aula_id}
                    )
            except Exception as e:
                print(f"⚠️ Erro ao enviar notificação ao coordenador: {e}")
        
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
                e.nome as estabelecimento_nome,
                p.nome as projeto_nome,
                at.nome as atividade_nome, at.id as atividade_id,
                d.nome as disciplina_nome,
                eq.name as equipamento_nome, eq.id as equipamento_id
            FROM aulas a
            JOIN turmas t ON a.turma_id = t.id
            LEFT JOIN mentores m ON a.mentor_id = m.id
            JOIN estabelecimentos e ON t.estabelecimento_id = e.id
            LEFT JOIN projetos p ON a.projeto_id = p.id
            LEFT JOIN atividades at ON a.atividade_id = at.id
            LEFT JOIN disciplinas d ON at.disciplina_id = d.id
            LEFT JOIN equipments eq ON a.equipamento_id = eq.id
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
            'estabelecimento_nome': row[15],
            'mentor_id': row[14],
            'estabelecimento_nome': row[15],
            'projeto_nome': row[16],
            'atividade_nome': row[17],
            'atividade_id': row[18],
            'disciplina_nome': row[19],
            'equipamento_nome': row[20],
            'equipamento_id': row[21]
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
                a.id, a.tipo, a.data_hora, a.duracao_minutos, a.estado, a.tema,
                a.local, a.observacoes,
                t.nome as turma_nome, t.id as turma_id,
                m.nome as mentor_nome, m.id as mentor_id,
                e.nome as estabelecimento_nome,
                m.user_id as mentor_user_id,
                at.nome as atividade_nome,
                eq.name as equipamento_nome,
                d.nome as disciplina_nome
            FROM aulas a
            JOIN turmas t ON a.turma_id = t.id
            LEFT JOIN mentores m ON a.mentor_id = m.id
            JOIN estabelecimentos e ON t.estabelecimento_id = e.id
            LEFT JOIN atividades at ON a.atividade_id = at.id
            LEFT JOIN disciplinas d ON at.disciplina_id = d.id
            LEFT JOIN equipments eq ON a.equipamento_id = eq.id
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
                'duracao_minutos': row[3],
                'estado': row[4],
                'tema': row[5],
                'local': row[6],
                'observacoes': row[7],
                'turma_nome': row[8],
                'turma_id': row[9],
                'mentor_nome': row[10] if row[10] else "Sem mentor",
                'mentor_id': row[11],
                'estabelecimento_nome': row[12],
                'estabelecimento_nome': row[12],
                'mentor_user_id': row[13], # UUID
                'atividade_nome': row[14],
                'equipamento_nome': row[15],
                'disciplina_nome': row[16]
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


def atualizar_aula(aula_id, dados):
    """
    Atualiza os dados de uma aula.
    
    Parâmetros:
        aula_id (int): ID da aula
        dados (dict): Dicionário com os campos a atualizar
    
    Retorna:
        bool: True se sucesso, False se erro
    """
    if not aula_id or not dados:
        return False

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Construir query dinamicamente
        campos = []
        valores = []
        
        for campo, valor in dados.items():
            if campo in ['turma_id', 'mentor_id', 'projeto_id', 'tipo', 'data_hora', 'duracao_minutos', 'local', 'tema', 'objetivos', 'observacoes', 'atividade_id', 'equipamento_id']:
                campos.append(f"{campo} = %s")
                valores.append(valor)

        # Verificar se houve mudança de horário para reiniciar estado
        should_notify_mentor_change = False
        
        if 'data_hora' in dados:
            cur.execute("SELECT data_hora, estado, mentor_id FROM aulas WHERE id = %s", (aula_id,))
            row = cur.fetchone()
            
            if row:
                current_data_hora = row[0]
                current_estado = row[1]
                mentor_id = row[2]
                
                # Converter para string para comparação simples (ou datetime se ambos forem)
                # O driver do psycopg2 retorna datetime objects para timestamp
                new_data_hora = dados['data_hora']
                
                # Normalizar para comparação
                if str(new_data_hora) != str(current_data_hora):
                    # Se estava confirmada ou recusada, volta a pendente
                    if current_estado in [ESTADO_CONFIRMADA, ESTADO_RECUSADA]:
                        print(f"ℹ️  Horário alterado ({current_data_hora} -> {new_data_hora}). Reiniciando estado para 'pendente'.")
                        
                        # Remover 'estado' se já tiver sido adicionado pelo loop anterior (para não duplicar)
                        # Nota: o loop acima adiciona cega e loucamente. Se 'estado' não está no loop, ok. 
                        # Mas 'estado' NÃO está na lista permitida do loop acima: ['turma_id', ... 'observacoes']. 
                        # 'estado' não está lá. Então podemos adicionar seguros.
                        
                        campos.append("estado = %s")
                        valores.append(ESTADO_PENDENTE)
                        
                        # Adicionar nota nas observações
                        nota = f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M')}] Sistema: Horário alterado. Estado reiniciado para 'pendente'."
                        
                        # Se observacoes já foi adicionado aos campos/valores, temos de atualizar o valor.
                        # Mas é complexo encontrar e substituir na lista 'valores'.
                        # Vamos assumir que se 'observacoes' veio nos dados, já está em 'campos'.
                        
                        if 'observacoes' in dados:
                            # O valor já está na lista 'valores'. Qual índice?
                            # Difícil saber.
                            # Simplificação: Não adicionar nota se já estamos a editar observações.
                            # Ou melhor: vamos concatenar na DB.
                            # Mas se já temos "observacoes = %s", adicionar outro "observacoes = ..." vai dar erro SQL ou comportamento estranho.
                            pass 
                        else:
                             # Se não está a ser atualizado explicitamente, adicionamos append
                             campos.append("observacoes = COALESCE(observacoes, '') || %s")
                             valores.append(nota)
                             
                        should_notify_mentor_change = True
        
        if not campos:
            return False

        valores.append(aula_id)
        query = f"UPDATE aulas SET {', '.join(campos)}, atualizado_em = CURRENT_TIMESTAMP WHERE id = %s"

        cur.execute(query, tuple(valores))
        conn.commit()
        
        print(f"✅ Aula #{aula_id} atualizada com sucesso!")
        
        cur.close()
        conn.close()

        # Enviar notificação se necessário
        if should_notify_mentor_change and mentor_id:
            try:
                from services import notification_service, turma_service, profile_service
                
                email_mentor = turma_service.obter_email_mentor(mentor_id)
                if email_mentor:
                    profile_id = profile_service.obter_profile_id_por_email(email_mentor)
                    if profile_id:
                        notification_service.criar_notificacao(
                            user_id=profile_id,
                            tipo="session_updated",
                            titulo="Horário de Sessão Alterado",
                            mensagem=f"O horário da sessão foi alterado. Por favor confirme a nova hora.",
                            link="/dashboard",
                            metadados={"aula_id": aula_id}
                        )
            except Exception as e:
                print(f"⚠️ Erro ao notificar mentor: {e}")

        return True

    except Exception as e:
        print(f"❌ Erro ao atualizar aula: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

def apagar_aula(aula_id):
    """
    Apaga uma aula do sistema.
    
    Parâmetros:
        aula_id (int): ID da aula
    
    Retorna:
        bool: True se sucesso, False se erro
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("DELETE FROM aulas WHERE id = %s", (aula_id,))
        conn.commit()
        
        print(f"✅ Aula #{aula_id} apagada com sucesso!")
        
        cur.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Erro ao apagar aula: {e}")
        if conn:
            conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur:
            cur.close()
        if 'conn' in locals() and conn:
            conn.close()

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
    print("   - 1 estabelecimento criada")
    print("   - 1 turma criada")
    print("   - 1 mentor criado")
    print()

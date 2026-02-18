import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
import os
from dotenv import load_dotenv

load_dotenv()

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST'),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        port=os.getenv('DB_PORT')
    )

def populate_wiki():
    conn = get_db_connection()
    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    print("📚 A popular base de dados da Wiki...")

    # A. Instituições
    instituicoes = [
      { "sigla": "EPL", "nome": "Estabelecimento Prisional de Leiria" },
      { "sigla": "SCMCR", "nome": "Santa Casa da Misericórdia das Caldas da Rainha" },
      { "sigla": "GMG", "nome": "Centro de Acolhimento Girassol" },
      { "sigla": "CDDL", "nome": "Colégio Dom Dinís" },
      { "sigla": "ESACDMG", "nome": "Escola Secundária Engº Acácio Calazans Duarte" },
      { "sigla": "CEML", "nome": "Centro Escolar de Marrazes" },
      { "sigla": "ESC1", "nome": "Escola a contratar" },
      { "sigla": "ESC2", "nome": "Escola a contratar" },
      { "sigla": "ESC3", "nome": "Escola a contratar" },
      { "sigla": "LBL", "nome": "Label" }
    ]

    print("-> A inserir Instituições...")
    for inst in instituicoes:
        # Check if exists by name
        cur.execute("SELECT id FROM instituicoes WHERE nome = %s", (inst['nome'],))
        if cur.fetchone():
            # Update sigla if needed
            cur.execute("UPDATE instituicoes SET sigla = %s WHERE nome = %s", (inst['sigla'], inst['nome']))
        else:
            # Insert
            cur.execute("INSERT INTO instituicoes (nome, sigla) VALUES (%s, %s)", (inst['nome'], inst['sigla']))

    # B. Disciplinas e Atividades
    curriculo = [
      {
        "disciplina": "Oficina de Português",
        "atividades": [
          { "codigo": "CDOP", "nome": "Coordenação da Oficina de Português", "sessoes_padrao": None, "horas_padrao": None, "producoes": 0, "mentor": None },
          { "codigo": "OP", "nome": "Oficina de Português", "sessoes_padrao": 3, "horas_padrao": 2, "producoes": 0, "mentor": "Rapper" },
          { "codigo": "TAOP", "nome": "Trabalho Autónomo", "sessoes_padrao": None, "horas_padrao": 4, "producoes": 0, "mentor": "Rapper" },
          { "codigo": "TAOPP", "nome": "Trabalho Autónomo", "sessoes_padrao": None, "horas_padrao": 4, "producoes": 0, "mentor": "Produtor" }
        ]
      },
      {
        "disciplina": "Clube de RAP",
        "atividades": [
          { "codigo": "CDCR", "nome": "Coordenação do Clube de RAP", "sessoes_padrao": 32, "horas_padrao": 1, "producoes": 0, "mentor": "Coordenador" },
          { "codigo": "CR", "nome": "Clube de RAP", "sessoes_padrao": 32, "horas_padrao": 2, "producoes": 0, "mentor": "Rapper" },
          { "codigo": "TAR", "nome": "Trabalho Autónomo", "sessoes_padrao": 32, "horas_padrao": 1, "producoes": 0, "mentor": "Rapper" },
          { "codigo": "TACR", "nome": "Trabalho Autónomo", "sessoes_padrao": 7, "horas_padrao": 4, "producoes": 7, "mentor": "Produtor" }
        ]
      },
      {
        "disciplina": "Clube de Produção",
        "atividades": [
          { "codigo": "CDCP", "nome": "Coordenação do Clube Produção Instrumental", "sessoes_padrao": 32, "horas_padrao": 1, "producoes": 0, "mentor": "Coordenador" },
          { "codigo": "CP", "nome": "Clube de Produção Instrumental", "sessoes_padrao": 32, "horas_padrao": 2, "producoes": 0, "mentor": "Produtor" },
          { "codigo": "TACP", "nome": "Trabalho Autónomo", "sessoes_padrao": 32, "horas_padrao": 1, "producoes": 7, "mentor": "Produtor" }
        ]
      },
      {
        "disciplina": "Label",
        "atividades": [
          { "codigo": "GER", "nome": "Trabalho Autónomo", "sessoes_padrao": None, "horas_padrao": 192, "producoes": 0, "mentor": "Rapper" },
          { "codigo": "GEP", "nome": "Trabalho Autónomo", "sessoes_padrao": None, "horas_padrao": 192, "producoes": 0, "mentor": "Produtor" }
        ]
      }
    ]

    print("-> A inserir Currículo...")
    for disc in curriculo:
        # Insert or Get Disciplina
        cur.execute("SELECT id FROM disciplinas WHERE nome = %s", (disc['disciplina'],))
        res = cur.fetchone()
        if res:
            disc_id = res[0]
        else:
            cur.execute("INSERT INTO disciplinas (nome) VALUES (%s) RETURNING id", (disc['disciplina'],))
            disc_id = cur.fetchone()[0]
        
        # Insert Activities
        for act in disc['atividades']:
            cur.execute("SELECT id FROM atividades WHERE disciplina_id = %s AND codigo = %s", (disc_id, act['codigo']))
            if not cur.fetchone():
                cur.execute("""
                    INSERT INTO atividades 
                    (disciplina_id, codigo, nome, sessoes_padrao, horas_padrao, producoes_esperadas, perfil_mentor)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (
                    disc_id, act['codigo'], act['nome'], 
                    act['sessoes_padrao'], act['horas_padrao'], 
                    act['producoes'], act['mentor']
                ))

    conn.commit()
    conn.close()
    print("✅ Base de dados populada com sucesso!")

if __name__ == "__main__":
    populate_wiki()

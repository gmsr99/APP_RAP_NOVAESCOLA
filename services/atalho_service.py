import sys
import os
import logging

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

logger = logging.getLogger(__name__)

from database.connection import get_db_connection

INITIAL_ATALHOS = [
    {
        'titulo': '01. Músicas em Produção',
        'descricao': 'Repositório central onde se encontram todos os projetos e faixas que estão em desenvolvimento e ainda não foram finalizados. O objetivo principal desta organização é garantir a continuidade entre sessões (mesmo com a troca de mentores), facilitar a colaboração e prevenir a perda de informação ou do fluxo criativo',
        'url': 'https://drive.google.com/drive/folders/1mE1YwT2Lgd1xxmjhxC7PavlZuI_O_42T?usp=drive_link',
        'imagem_url': None,
        'ordem': 1,
    },
    {
        'titulo': '02. Registos de Atividade',
        'descricao': 'Uma das secções principais da estrutura destinada a organizar e tornar acessíveis todos os registos de atividade do projeto, com o objetivo de manter a documentação rigorosa, consistente e devidamente preenchida e assinada.',
        'url': 'https://drive.google.com/drive/folders/1dJ43Pq_whKHg8Di0B334z3RGTY0a8Y7E?usp=drive_link',
        'imagem_url': None,
        'ordem': 2,
    },
    {
        'titulo': '03. Programa e Processos',
        'descricao': 'Repositório central que contém todos os documentos fundamentais sobre a metodologia, o workflow e o enquadramento estratégico do projeto, garantindo o alinhamento e a consistência da equipa.',
        'url': 'https://drive.google.com/drive/folders/1Hyb3XTN5MzofRtcOX-7zA_SApkfDe926?usp=drive_link',
        'imagem_url': None,
        'ordem': 3,
    },
    {
        'titulo': '04. Formações e Alinhamento de Equipa',
        'descricao': 'Um arquivo que contém os documentos essenciais de instrução e princípios para a comunicação da equipa e o acesso a ferramentas de trabalho.',
        'url': 'https://drive.google.com/drive/folders/1j8TVmZyk_oMP-F0kQdaaiY9-O-4VMnl9?usp=drive_link',
        'imagem_url': None,
        'ordem': 4,
    },
    {
        'titulo': 'Material de Aulas de Clubes',
        'descricao': 'Pasta onde carregamos conteúdos para termos sempre à mão.',
        'url': 'https://drive.google.com/drive/u/3/folders/1p62q0ss3DtLF0rI8Oc90ZBKO1b96Zer9',
        'imagem_url': None,
        'ordem': 5,
    },
]


def _ensure_table(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS atalhos (
            id SERIAL PRIMARY KEY,
            titulo TEXT NOT NULL,
            descricao TEXT,
            url TEXT NOT NULL,
            imagem_url TEXT,
            ordem INTEGER DEFAULT 0,
            criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """)


def _row_to_dict(row):
    return {
        'id': row[0],
        'titulo': row[1],
        'descricao': row[2],
        'url': row[3],
        'imagem_url': row[4],
        'ordem': row[5],
    }


def listar_atalhos():
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        _ensure_table(cur)
        conn.commit()

        cur.execute("SELECT COUNT(*) FROM atalhos")
        count = cur.fetchone()[0]

        if count == 0:
            for a in INITIAL_ATALHOS:
                cur.execute(
                    "INSERT INTO atalhos (titulo, descricao, url, imagem_url, ordem) VALUES (%s, %s, %s, %s, %s)",
                    (a['titulo'], a['descricao'], a['url'], a['imagem_url'], a['ordem'])
                )
            conn.commit()

        cur.execute(
            "SELECT id, titulo, descricao, url, imagem_url, ordem FROM atalhos ORDER BY ordem, id"
        )
        return [_row_to_dict(r) for r in cur.fetchall()]
    except Exception as e:
        logger.error(f"Erro ao listar atalhos: {e}")
        raise
    finally:
        if conn:
            conn.close()


def criar_atalho(data: dict):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        _ensure_table(cur)
        cur.execute(
            """INSERT INTO atalhos (titulo, descricao, url, imagem_url, ordem)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, titulo, descricao, url, imagem_url, ordem""",
            (data['titulo'], data.get('descricao'), data['url'], data.get('imagem_url'), data.get('ordem', 0))
        )
        row = cur.fetchone()
        conn.commit()
        return _row_to_dict(row)
    except Exception as e:
        logger.error(f"Erro ao criar atalho: {e}")
        raise
    finally:
        if conn:
            conn.close()


def atualizar_atalho(atalho_id: int, data: dict):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            """UPDATE atalhos
               SET titulo=%s, descricao=%s, url=%s, imagem_url=%s, ordem=%s
               WHERE id=%s
               RETURNING id, titulo, descricao, url, imagem_url, ordem""",
            (data['titulo'], data.get('descricao'), data['url'], data.get('imagem_url'), data.get('ordem', 0), atalho_id)
        )
        row = cur.fetchone()
        conn.commit()
        return _row_to_dict(row) if row else None
    except Exception as e:
        logger.error(f"Erro ao atualizar atalho: {e}")
        raise
    finally:
        if conn:
            conn.close()


def apagar_atalho(atalho_id: int):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM atalhos WHERE id=%s RETURNING id", (atalho_id,))
        row = cur.fetchone()
        conn.commit()
        return row is not None
    except Exception as e:
        logger.error(f"Erro ao apagar atalho: {e}")
        raise
    finally:
        if conn:
            conn.close()


def get_user_role(user_id: str):
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT role FROM profiles WHERE id=%s", (user_id,))
        row = cur.fetchone()
        return row[0] if row else None
    except Exception as e:
        logger.error(f"Erro ao obter role do user: {e}")
        return None
    finally:
        if conn:
            conn.close()

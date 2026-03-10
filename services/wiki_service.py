"""
==============================================================================
RAP NOVA ESCOLA - Serviço Wiki (Disciplinas e Atividades locais por turma)
==============================================================================
Ficheiro: services/wiki_service.py

Gere as disciplinas e atividades locais (turma_disciplinas + turma_atividades).
Cada turma tem as suas próprias disciplinas e atividades com UUID.
"""

from database.connection import get_db_connection


def _has_is_autonomous(cur) -> bool:
    """Check if turma_atividades has the is_autonomous column (migration 020)."""
    cur.execute("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'turma_atividades' AND column_name = 'is_autonomous'
    """)
    return cur.fetchone() is not None


def listar_hierarquia_projeto(projeto_id: int):
    """
    Retorna a hierarquia completa para o accordion da Wiki:
    Projeto > Estabelecimentos > Turmas > Disciplinas > Atividades
    Inclui contadores calculados a partir das aulas.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # 1. Estabelecimentos do projeto
        cur.execute("""
            SELECT e.id, e.nome, e.sigla
            FROM estabelecimentos e
            JOIN projeto_estabelecimentos pe ON pe.estabelecimento_id = e.id
            WHERE pe.projeto_id = %s
            ORDER BY e.nome
        """, (projeto_id,))
        estabelecimentos = cur.fetchall()

        has_auto = _has_is_autonomous(cur)

        resultado = []
        for est in estabelecimentos:
            est_id, est_nome, est_sigla = est

            # 2. Turmas do estabelecimento
            cur.execute("""
                SELECT t.id, t.nome,
                    COALESCE(t.sessoes_previstas, 0),
                    COALESCE(t.musicas_previstas, 0)
                FROM turmas t
                WHERE t.estabelecimento_id = %s
                ORDER BY t.nome
            """, (est_id,))
            turmas_rows = cur.fetchall()

            turmas = []
            for turma in turmas_rows:
                t_id, t_nome, t_sessoes_prev, t_musicas_prev = turma

                # 3. Disciplinas locais da turma
                cur.execute("""
                    SELECT td.id, td.nome, td.descricao, td.musicas_previstas
                    FROM turma_disciplinas td
                    WHERE td.turma_id = %s
                    ORDER BY td.nome
                """, (t_id,))
                disc_rows = cur.fetchall()

                disciplinas = []
                for disc in disc_rows:
                    td_id, td_nome, td_desc, td_musicas = disc

                    # 4. Atividades locais da disciplina
                    if has_auto:
                        cur.execute("""
                            SELECT
                                ta.uuid, ta.nome, ta.codigo, ta.sessoes_previstas,
                                ta.horas_por_sessao, ta.musicas_previstas, ta.perfil_mentor,
                                COUNT(a.id) AS sessoes_realizadas,
                                COALESCE(SUM(a.duracao_minutos), 0) AS horas_realizadas,
                                ta.is_autonomous
                            FROM turma_atividades ta
                            LEFT JOIN aulas a ON a.atividade_uuid = ta.uuid AND a.estado = 'terminada'
                            WHERE ta.turma_disciplina_id = %s
                            GROUP BY ta.uuid, ta.nome, ta.codigo, ta.sessoes_previstas,
                                     ta.horas_por_sessao, ta.musicas_previstas, ta.perfil_mentor,
                                     ta.is_autonomous
                            ORDER BY ta.is_autonomous, ta.codigo, ta.nome
                        """, (td_id,))
                    else:
                        cur.execute("""
                            SELECT
                                ta.uuid, ta.nome, ta.codigo, ta.sessoes_previstas,
                                ta.horas_por_sessao, ta.musicas_previstas, ta.perfil_mentor,
                                COUNT(a.id) AS sessoes_realizadas,
                                COALESCE(SUM(a.duracao_minutos), 0) AS horas_realizadas,
                                FALSE AS is_autonomous
                            FROM turma_atividades ta
                            LEFT JOIN aulas a ON a.atividade_uuid = ta.uuid AND a.estado = 'terminada'
                            WHERE ta.turma_disciplina_id = %s
                            GROUP BY ta.uuid, ta.nome, ta.codigo, ta.sessoes_previstas,
                                     ta.horas_por_sessao, ta.musicas_previstas, ta.perfil_mentor
                            ORDER BY ta.codigo, ta.nome
                        """, (td_id,))
                    ativ_rows = cur.fetchall()

                    atividades = []
                    for a in ativ_rows:
                        atividades.append({
                            'uuid': str(a[0]),
                            'nome': a[1],
                            'codigo': a[2],
                            'sessoes_previstas': a[3] or 0,
                            'horas_por_sessao': float(a[4]) if a[4] else 0,
                            'musicas_previstas': a[5] or 0,
                            'perfil_mentor': a[6],
                            'sessoes_realizadas': a[7],
                            'horas_realizadas': round(float(a[8]) / 60.0, 1),
                            'is_autonomous': bool(a[9]),
                        })

                    disciplinas.append({
                        'id': td_id,
                        'nome': td_nome,
                        'descricao': td_desc,
                        'musicas_previstas': td_musicas or 0,
                        'atividades': atividades,
                    })

                turmas.append({
                    'id': t_id,
                    'nome': t_nome,
                    'sessoes_previstas': t_sessoes_prev,
                    'musicas_previstas': t_musicas_prev,
                    'disciplinas': disciplinas,
                })

            resultado.append({
                'id': est_id,
                'nome': est_nome,
                'sigla': est_sigla,
                'turmas': turmas,
            })

        return resultado
    except Exception as e:
        print(f"Erro ao listar hierarquia wiki: {e}")
        raise
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def listar_disciplinas_turma(turma_id: int):
    """Lista disciplinas locais de uma turma com atividades."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        has_auto = _has_is_autonomous(cur)

        cur.execute("""
            SELECT td.id, td.nome, td.descricao, td.musicas_previstas
            FROM turma_disciplinas td
            WHERE td.turma_id = %s
            ORDER BY td.nome
        """, (turma_id,))
        disc_rows = cur.fetchall()

        resultado = []
        for disc in disc_rows:
            td_id, td_nome, td_desc, td_musicas = disc

            if has_auto:
                cur.execute("""
                    SELECT uuid, nome, codigo, sessoes_previstas,
                           horas_por_sessao, musicas_previstas, perfil_mentor, is_autonomous
                    FROM turma_atividades
                    WHERE turma_disciplina_id = %s
                    ORDER BY is_autonomous, codigo, nome
                """, (td_id,))
            else:
                cur.execute("""
                    SELECT uuid, nome, codigo, sessoes_previstas,
                           horas_por_sessao, musicas_previstas, perfil_mentor, FALSE AS is_autonomous
                    FROM turma_atividades
                    WHERE turma_disciplina_id = %s
                    ORDER BY codigo, nome
                """, (td_id,))
            atividades = [{
                'uuid': str(a[0]),
                'nome': a[1],
                'codigo': a[2],
                'sessoes_previstas': a[3] or 0,
                'horas_por_sessao': float(a[4]) if a[4] else 0,
                'musicas_previstas': a[5] or 0,
                'perfil_mentor': a[6],
                'is_autonomous': bool(a[7]),
            } for a in cur.fetchall()]

            resultado.append({
                'id': td_id,
                'nome': td_nome,
                'descricao': td_desc,
                'musicas_previstas': td_musicas or 0,
                'atividades': atividades,
            })

        return resultado
    except Exception as e:
        print(f"Erro ao listar disciplinas da turma: {e}")
        return []
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def criar_disciplina_turma(turma_id: int, nome: str, descricao: str = None, musicas_previstas: int = 0, atividades: list = None):
    """
    Cria uma disciplina local numa turma, opcionalmente com atividades em batch.
    atividades = [{ nome, codigo, sessoes_previstas, horas_por_sessao, musicas_previstas, perfil_mentor, is_autonomous }]
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO turma_disciplinas (turma_id, nome, descricao, musicas_previstas)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (turma_id, nome, descricao, musicas_previstas or 0))
        td_id = cur.fetchone()[0]

        has_auto = _has_is_autonomous(cur)
        created_atividades = []
        if atividades:
            for a in atividades:
                if has_auto:
                    cur.execute("""
                        INSERT INTO turma_atividades
                            (turma_disciplina_id, nome, codigo, sessoes_previstas, horas_por_sessao, musicas_previstas, perfil_mentor, is_autonomous)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING uuid
                    """, (
                        td_id, a['nome'], a.get('codigo'),
                        a.get('sessoes_previstas', 0), a.get('horas_por_sessao', 0),
                        a.get('musicas_previstas', 0), a.get('perfil_mentor'),
                        bool(a.get('is_autonomous', False))
                    ))
                else:
                    cur.execute("""
                        INSERT INTO turma_atividades
                            (turma_disciplina_id, nome, codigo, sessoes_previstas, horas_por_sessao, musicas_previstas, perfil_mentor)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING uuid
                    """, (
                        td_id, a['nome'], a.get('codigo'),
                        a.get('sessoes_previstas', 0), a.get('horas_por_sessao', 0),
                        a.get('musicas_previstas', 0), a.get('perfil_mentor'),
                    ))
                uuid = cur.fetchone()[0]
                created_atividades.append({**a, 'uuid': str(uuid)})

        conn.commit()
        return {
            'id': td_id,
            'nome': nome,
            'descricao': descricao,
            'musicas_previstas': musicas_previstas or 0,
            'atividades': created_atividades,
        }
    except Exception as e:
        print(f"Erro ao criar disciplina da turma: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def atualizar_disciplina_turma(td_id: int, nome: str, descricao: str = None, musicas_previstas: int = 0):
    """Atualiza uma disciplina local."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE turma_disciplinas
            SET nome = %s, descricao = %s, musicas_previstas = %s
            WHERE id = %s
        """, (nome, descricao, musicas_previstas or 0, td_id))
        conn.commit()
        return True
    except Exception as e:
        print(f"Erro ao atualizar disciplina da turma: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def apagar_disciplina_turma(td_id: int):
    """Remove uma disciplina local (cascade apaga atividades)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM turma_disciplinas WHERE id = %s", (td_id,))
        conn.commit()
        return True
    except Exception as e:
        print(f"Erro ao apagar disciplina da turma: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def criar_atividade(turma_disciplina_id: int, nome: str, codigo: str = None, sessoes_previstas: int = 0, horas_por_sessao: float = 0, musicas_previstas: int = 0, perfil_mentor: str = None, is_autonomous: bool = False):
    """Cria uma atividade individual numa disciplina local."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        has_auto = _has_is_autonomous(cur)
        if has_auto:
            cur.execute("""
                INSERT INTO turma_atividades
                    (turma_disciplina_id, nome, codigo, sessoes_previstas, horas_por_sessao, musicas_previstas, perfil_mentor, is_autonomous)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING uuid
            """, (turma_disciplina_id, nome, codigo, sessoes_previstas, horas_por_sessao, musicas_previstas, perfil_mentor, is_autonomous))
        else:
            cur.execute("""
                INSERT INTO turma_atividades
                    (turma_disciplina_id, nome, codigo, sessoes_previstas, horas_por_sessao, musicas_previstas, perfil_mentor)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING uuid
            """, (turma_disciplina_id, nome, codigo, sessoes_previstas, horas_por_sessao, musicas_previstas, perfil_mentor))
        uuid = cur.fetchone()[0]
        conn.commit()
        return {'uuid': str(uuid), 'nome': nome, 'codigo': codigo, 'is_autonomous': is_autonomous}
    except Exception as e:
        print(f"Erro ao criar atividade: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def atualizar_atividade(uuid: str, dados: dict):
    """Atualiza uma atividade local por UUID."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        has_auto = _has_is_autonomous(cur)
        if has_auto:
            cur.execute("""
                UPDATE turma_atividades
                SET nome = %s, codigo = %s, sessoes_previstas = %s,
                    horas_por_sessao = %s, musicas_previstas = %s, perfil_mentor = %s,
                    is_autonomous = %s
                WHERE uuid = %s
            """, (
                dados['nome'], dados.get('codigo'),
                dados.get('sessoes_previstas', 0), dados.get('horas_por_sessao', 0),
                dados.get('musicas_previstas', 0), dados.get('perfil_mentor'),
                bool(dados.get('is_autonomous', False)),
                uuid
            ))
        else:
            cur.execute("""
                UPDATE turma_atividades
                SET nome = %s, codigo = %s, sessoes_previstas = %s,
                    horas_por_sessao = %s, musicas_previstas = %s, perfil_mentor = %s
                WHERE uuid = %s
            """, (
                dados['nome'], dados.get('codigo'),
                dados.get('sessoes_previstas', 0), dados.get('horas_por_sessao', 0),
                dados.get('musicas_previstas', 0), dados.get('perfil_mentor'),
                uuid
            ))
        conn.commit()
        return True
    except Exception as e:
        print(f"Erro ao atualizar atividade: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()


def apagar_atividade(uuid: str):
    """Remove uma atividade local por UUID."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM turma_atividades WHERE uuid = %s", (uuid,))
        conn.commit()
        return True
    except Exception as e:
        print(f"Erro ao apagar atividade: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

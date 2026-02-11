import sys
import os
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.connection import get_db_connection

def listar_reservas(data_inicio=None, data_fim=None):
    """Lista todas as reservas, opcionalmente filtrando por intervalo de datas."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        query = """
            SELECT 
                r.id, r.data, r.hora_inicio, r.hora_fim, r.tipo, 
                r.artista_turma, r.projeto_musica, r.notas,
                p.id as responsavel_id, p.full_name as responsavel_nome, p.role as responsavel_role,
                c.id as criador_id, c.full_name as criador_nome
            FROM estudio_reservas r
            LEFT JOIN profiles p ON r.responsavel_id = p.id
            LEFT JOIN profiles c ON r.criado_por_id = c.id
        """
        
        params = []
        if data_inicio and data_fim:
            query += " WHERE r.data BETWEEN %s AND %s"
            params.extend([data_inicio, data_fim])
            
        query += " ORDER BY r.data, r.hora_inicio"
        
        cur.execute(query, tuple(params))
        reservas = cur.fetchall()
        
        resultado = []
        for row in reservas:
            resultado.append({
                'id': row[0],
                'data': row[1].isoformat(),
                'hora_inicio': row[2].strftime('%H:%M'),
                'hora_fim': row[3].strftime('%H:%M'),
                'tipo': row[4],
                'artista_turma': row[5],
                'projeto_musica': row[6],
                'notas': row[7],
                'responsavel': {
                    'id': str(row[8]) if row[8] else None,
                    'nome': row[9],
                    'role': row[10]
                } if row[8] else None,
                'criado_por': {
                    'id': str(row[11]) if row[11] else None,
                    'nome': row[12]
                } if row[11] else None
            })
            
        return resultado
    except Exception as e:
        print(f"❌ Erro ao listar reservas: {e}")
        return []
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def criar_reserva(dados):
    """Cria uma nova reserva."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            INSERT INTO estudio_reservas 
            (data, hora_inicio, hora_fim, tipo, artista_turma, projeto_musica, responsavel_id, criado_por_id, notas)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            dados['data'], dados['hora_inicio'], dados['hora_fim'], dados['tipo'],
            dados['artista_turma'], dados['projeto_musica'], 
            dados.get('responsavel_id'), dados.get('criado_por_id'), dados.get('notas')
        ))
        
        nova_id = cur.fetchone()[0]
        conn.commit()
        return {'id': nova_id, 'message': 'Reserva criada com sucesso'}
    except Exception as e:
        print(f"❌ Erro ao criar reserva: {e}")
        if 'conn' in locals() and conn: conn.rollback()
        return None
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

def listar_equipa():
    """Lista todos os membros da equipa (Mentores, Produtores, Coordenadores)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Fetch directly from profiles where role is relevant
        # Assuming role column is text and contains 'mentor', 'produtor', 'coordenador', 'mentor_produtor'
        cur.execute("""
            SELECT id, full_name, role, email 
            FROM profiles 
            WHERE role IN ('mentor', 'produtor', 'coordenador', 'mentor_produtor')
            ORDER BY full_name
        """)
        
        equipa = cur.fetchall()
        return [{
            'id': str(m[0]), 
            'nome': m[1], 
            'role': m[2], 
            'email': m[3]
        } for m in equipa]
        
    except Exception as e:
        print(f"❌ Erro ao listar equipa: {e}")
        return []
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()
def apagar_reserva(reserva_id):
    """Apaga uma reserva pelo ID."""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("DELETE FROM estudio_reservas WHERE id = %s", (reserva_id,))
        
        deleted = cur.rowcount > 0
        conn.commit()
        return deleted
    except Exception as e:
        print(f"❌ Erro ao apagar reserva: {e}")
        return False
    finally:
        if 'cur' in locals() and cur: cur.close()
        if 'conn' in locals() and conn: conn.close()

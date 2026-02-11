"""
Script para exportar o schema SQL do Supabase
"""
import sys
from database.connection import get_db_connection

def export_schema():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Buscar todas as tabelas
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    """)
    tabelas = [row[0] for row in cur.fetchall()]
    
    output = []
    output.append('-- Schema SQL do Supabase - RAP Nova Escola')
    output.append('-- Gerado automaticamente')
    output.append('')
    output.append('-- ============================================')
    output.append(f'-- TABELAS ENCONTRADAS: {len(tabelas)}')
    output.append('-- ============================================')
    output.append('')
    
    for tabela in tabelas:
        output.append(f'-- Tabela: {tabela}')
        output.append(f'CREATE TABLE IF NOT EXISTS {tabela} (')
        
        # Buscar colunas
        cur.execute("""
            SELECT 
                column_name,
                data_type,
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position;
        """, (tabela,))
        
        colunas = cur.fetchall()
        colunas_sql = []
        
        for col in colunas:
            nome, tipo, max_len, nullable, default = col
            tipo_sql = tipo
            
            if max_len:
                tipo_sql += f'({max_len})'
            
            nullable_str = 'NULL' if nullable == 'YES' else 'NOT NULL'
            
            default_str = ''
            if default:
                default_str = f' DEFAULT {default}'
            
            colunas_sql.append(f'    {nome} {tipo_sql} {nullable_str}{default_str}')
        
        output.append(',\n'.join(colunas_sql))
        output.append(');')
        output.append('')
        
        # Buscar constraints (chaves primárias, estrangeiras, etc)
        cur.execute("""
            SELECT 
                tc.constraint_name,
                tc.constraint_type,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            LEFT JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.table_schema = 'public' AND tc.table_name = %s
            ORDER BY tc.constraint_type, tc.constraint_name;
        """, (tabela,))
        
        constraints = cur.fetchall()
        if constraints:
            for constraint in constraints:
                constraint_name, constraint_type, column_name, foreign_table, foreign_column = constraint
                if constraint_type == 'PRIMARY KEY':
                    output.append(f'ALTER TABLE {tabela} ADD CONSTRAINT {constraint_name} PRIMARY KEY ({column_name});')
                elif constraint_type == 'FOREIGN KEY':
                    output.append(f'ALTER TABLE {tabela} ADD CONSTRAINT {constraint_name} FOREIGN KEY ({column_name}) REFERENCES {foreign_table}({foreign_column});')
            output.append('')
    
    cur.close()
    conn.close()
    
    return '\n'.join(output)

if __name__ == '__main__':
    try:
        schema = export_schema()
        print(schema)
    except Exception as e:
        print(f"❌ Erro: {e}", file=sys.stderr)
        sys.exit(1)

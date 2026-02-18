
import psycopg2
from database.connection import get_db_connection

def update_mentores():
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        print("🔨 Atualizando tabela 'mentores'...")
        
        # 1. Reassignar aulas dos mentores de teste para o Gil (ID 3)
        # IDs conhecidos: Mentor Exemplo (1), Mentor Teste (2), Gil (3)
        print("🔄 Reassignando sessões dos mentores de teste para o Gil...")
        cur.execute("UPDATE aulas SET mentor_id = 3 WHERE mentor_id IN (1, 2);")
        
        # 1.1 Remover mentores de teste
        print("🗑️  Removendo 'Mentor Exemplo' e 'Mentor Teste'...")
        cur.execute("DELETE FROM mentores WHERE nome IN ('Mentor Exemplo', 'Mentor Teste');")
        
        # 2. Verificar se Tomás já existe
        cur.execute("SELECT id FROM mentores WHERE email = 'gilitoribeirito@gmail.com'")
        if cur.fetchone():
            print("ℹ️  Tomás_Mentor_Produtor já existe na tabela.")
        else:
            print("✨ Inserindo 'Tomás_Mentor_Produtor'...")
            cur.execute("""
                INSERT INTO mentores (nome, email, perfil, ativo, criado_em, atualizado_em)
                VALUES ('Tomás_Mentor_Produtor', 'gilitoribeirito@gmail.com', 'mentor_produtor', true, NOW(), NOW())
            """)

        conn.commit()
        print("✅ Tabela 'mentores' atualizada com sucesso!")
        
        # 3. Listar mentores atuais
        cur.execute("SELECT id, nome, email FROM mentores WHERE ativo = true")
        mentores = cur.fetchall()
        print("\n📋 Lista Atual de Mentores:")
        for m in mentores:
            print(f" - ID: {m[0]} | Nome: {m[1]} | Email: {m[2]}")

    except Exception as e:
        print(f"❌ Erro ao atualizar mentores: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    update_mentores()

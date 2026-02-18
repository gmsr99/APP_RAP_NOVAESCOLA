
import psycopg2
from database.connection import get_db_connection

def create_sync_trigger():
    conn = get_db_connection()
    cur = conn.cursor()

    try:
        print("🔌 Conectado ao banco de dados.")
        
        # 1. Criar a função do trigger
        print("🔨 Criando função 'sync_mentores_from_profiles'...")
        cur.execute("""
            CREATE OR REPLACE FUNCTION sync_mentores_from_profiles()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Verificar se o utilizador tem role de mentor, mentor_produtor ou coordenador
                IF NEW.role IN ('mentor', 'mentor_produtor', 'coordenador') THEN
                    -- Tentar atualizar se já existe (pelo email)
                    UPDATE mentores 
                    SET nome = COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)), 
                        perfil = NEW.role,
                        user_id = NEW.id,
                        atualizado_em = NOW(),
                        ativo = true
                    WHERE email = NEW.email;

                    -- Se não atualizou nada (não existe), inserir novo
                    IF NOT FOUND THEN
                        INSERT INTO mentores (nome, email, perfil, user_id, ativo, criado_em, atualizado_em)
                        VALUES (COALESCE(NEW.full_name, split_part(NEW.email, '@', 1)), NEW.email, NEW.role, NEW.id, true, NOW(), NOW());
                    END IF;
                END IF;
                
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """)

        # 2. Criar o trigger na tabela profiles
        print("🔗 Criando trigger 'trigger_sync_mentores' na tabela 'profiles'...")
        cur.execute("DROP TRIGGER IF EXISTS trigger_sync_mentores ON profiles;")
        cur.execute("""
            CREATE TRIGGER trigger_sync_mentores
            AFTER INSERT OR UPDATE ON profiles
            FOR EACH ROW
            EXECUTE FUNCTION sync_mentores_from_profiles();
        """)

        # 3. Backfill: Sincronizar coordenadores existentes
        print("🔄 Sincronizando coordenadores existentes...")
        cur.execute("""
            INSERT INTO mentores (nome, email, perfil, ativo, criado_em, atualizado_em)
            SELECT full_name, email, role, true, NOW(), NOW()
            FROM profiles
            WHERE role = 'coordenador'
            AND NOT EXISTS (
                SELECT 1 FROM mentores WHERE mentores.email = profiles.email
            );
        """)
        
        conn.commit()
        print("✅ Trigger atualizado e coordenadores sincronizados!")
        
    except Exception as e:
        print(f"❌ Erro ao criar trigger: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()
        print("🔌 Conexão fechada.")

if __name__ == "__main__":
    create_sync_trigger()

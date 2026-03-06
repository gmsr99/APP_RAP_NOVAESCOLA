from db import get_db_connection

def sync_avatars():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Update profiles with avatar_url from auth.users metadata
        cur.execute("""
            UPDATE public.profiles p
            SET avatar_url = u.raw_user_meta_data->>'avatar_url'
            FROM auth.users u
            WHERE p.id = u.id 
            AND u.raw_user_meta_data->>'avatar_url' IS NOT NULL
            AND (p.avatar_url IS NULL OR p.avatar_url != u.raw_user_meta_data->>'avatar_url');
        """)

        conn.commit()
        print(f"Updated {cur.rowcount} profiles with avatar_url from auth.users.")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error syncing avatars: {e}")

if __name__ == "__main__":
    print("Starting avatar sync...")
    sync_avatars()
    print("Avatar sync complete.")

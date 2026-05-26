import os
import time
import logging
from typing import Optional
from supabase import create_client

logger = logging.getLogger(__name__)

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY")
supabase = create_client(supabase_url, supabase_key)

# All page slugs known to the app
ALL_PAGE_SLUGS = {
    "dashboard", "horarios", "producao", "tarefas", "estudio", "chat",
    "equipa", "wiki", "contactos", "atalhos", "registos", "equipamento",
    "estatisticas", "formacao", "admin", "financeiro",
}

# --- Simple TTL cache ---
_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 30  # seconds


def _cache_get(key: str) -> Optional[dict]:
    entry = _CACHE.get(key)
    if entry and (time.time() - entry[0]) < _CACHE_TTL:
        return entry[1]
    return None


def _cache_set(key: str, value: dict):
    _CACHE[key] = (time.time(), value)


def _cache_invalidate(user_id: str):
    _CACHE.pop(user_id, None)


# --- Permission resolution ---

def get_user_permissions(user_id: str) -> dict:
    """
    Resolves full permissions for a user.
    Order: is_root → user override → role default.

    Returns:
        {
            "is_root": bool,
            "is_direcao": bool,
            "is_coordenacao": bool,
            "role": str,
            "allowed_pages": set[str],
            "project_scoped": bool,
            "allowed_project_ids": list[int],
        }
    """
    cached = _cache_get(user_id)
    if cached:
        return cached

    from database.connection import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()

        # 1. Fetch profile base data
        cur.execute(
            "SELECT role, is_root, is_direcao, is_coordenacao, project_scoped FROM profiles WHERE id = %s",
            (user_id,)
        )
        row = cur.fetchone()
        if not row:
            result = {
                "is_root": False,
                "is_direcao": False,
                "is_coordenacao": False,
                "role": "mentor",
                "allowed_pages": set(),
                "project_scoped": False,
                "allowed_project_ids": [],
            }
            _cache_set(user_id, result)
            return result

        role, is_root, is_direcao, is_coordenacao, project_scoped = row

        if is_root:
            allowed_pages = set(ALL_PAGE_SLUGS)
        else:
            # 2. Role defaults
            cur.execute("""
                SELECT rpp.page_slug
                FROM role_page_permissions rpp
                JOIN roles r ON r.id = rpp.role_id
                WHERE r.name = %s
            """, (role,))
            allowed_pages = {r[0] for r in cur.fetchall()}

            # 3. Direction access: all pages except admin
            if is_direcao:
                allowed_pages = set(ALL_PAGE_SLUGS) - {"admin"}

            # 4. Coordination access: adds equipamento only (estatisticas is direction-level)
            elif is_coordenacao:
                allowed_pages.add("equipamento")

            # 5. Per-user overrides
            cur.execute(
                "SELECT page_slug, granted FROM user_page_permissions WHERE user_id = %s",
                (user_id,)
            )
            for page_slug, granted in cur.fetchall():
                if granted:
                    allowed_pages.add(page_slug)
                else:
                    allowed_pages.discard(page_slug)

        # 6. Project access
        allowed_project_ids = []
        if project_scoped and not is_root:
            cur.execute(
                "SELECT projeto_id FROM user_project_access WHERE user_id = %s",
                (user_id,)
            )
            allowed_project_ids = [r[0] for r in cur.fetchall()]

        cur.close()
        result = {
            "is_root": bool(is_root),
            "is_direcao": bool(is_direcao),
            "is_coordenacao": bool(is_coordenacao),
            "role": role or "mentor",
            "allowed_pages": allowed_pages,
            "project_scoped": bool(project_scoped),
            "allowed_project_ids": allowed_project_ids,
        }
        _cache_set(user_id, result)
        return result
    except Exception as e:
        logger.error(f"Erro ao obter permissões do utilizador {user_id}: {e}")
        return {
            "is_root": False,
            "is_direcao": False,
            "is_coordenacao": False,
            "role": "mentor",
            "allowed_pages": set(),
            "project_scoped": False,
            "allowed_project_ids": [],
        }
    finally:
        conn.close()


def get_project_filter(user_id: str) -> Optional[list]:
    """
    Returns None if user sees all projects, or a list of allowed projeto_ids.
    """
    perms = get_user_permissions(user_id)
    if perms["is_root"] or not perms["project_scoped"]:
        return None
    return perms["allowed_project_ids"]


def can_access_page(user_id: str, page_slug: str) -> bool:
    perms = get_user_permissions(user_id)
    return page_slug in perms["allowed_pages"]


# --- Role management ---

def listar_roles() -> list:
    from database.connection import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT r.id, r.name, r.label, r.is_system,
                   COALESCE(
                       array_agg(rpp.page_slug ORDER BY rpp.page_slug)
                       FILTER (WHERE rpp.page_slug IS NOT NULL),
                       '{}'
                   ) AS pages
            FROM roles r
            LEFT JOIN role_page_permissions rpp ON rpp.role_id = r.id
            GROUP BY r.id, r.name, r.label, r.is_system
            ORDER BY r.is_system DESC, r.name
        """)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        cur.close()
        return rows
    except Exception as e:
        logger.error(f"Erro ao listar roles: {e}")
        return []
    finally:
        conn.close()


def criar_role(name: str, label: str, pages: list[str]) -> dict:
    from database.connection import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO roles (name, label, is_system) VALUES (%s, %s, FALSE) RETURNING id",
            (name, label)
        )
        role_id = cur.fetchone()[0]
        for slug in pages:
            if slug in ALL_PAGE_SLUGS:
                cur.execute(
                    "INSERT INTO role_page_permissions (role_id, page_slug) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (role_id, slug)
                )
        conn.commit()
        cur.close()
        return {"id": role_id, "name": name, "label": label, "is_system": False, "pages": pages}
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao criar role: {e}")
        raise
    finally:
        conn.close()


def atualizar_role_pages(role_id: int, pages: list[str]) -> bool:
    from database.connection import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        # Check not system role
        cur.execute("SELECT is_system FROM roles WHERE id = %s", (role_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError("Role não encontrado")
        # Allow updating system roles' page permissions too (admin can adjust them)
        cur.execute("DELETE FROM role_page_permissions WHERE role_id = %s", (role_id,))
        for slug in pages:
            if slug in ALL_PAGE_SLUGS:
                cur.execute(
                    "INSERT INTO role_page_permissions (role_id, page_slug) VALUES (%s, %s)",
                    (role_id, slug)
                )
        conn.commit()
        cur.close()
        # Invalidate all cached permissions (role change affects all users with this role)
        _CACHE.clear()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao atualizar páginas do role {role_id}: {e}")
        raise
    finally:
        conn.close()


# --- User management ---

def criar_utilizador(
    email: str,
    password: str,
    full_name: str,
    role_name: str,
    page_overrides: dict,  # {page_slug: bool}
    project_ids: list[int],
    is_root: bool,
    is_direcao: bool = False,
    is_coordenacao: bool = False,
) -> dict:
    """
    Creates a new user via Supabase Admin API (email pre-confirmed).
    Then sets permissions in our tables.
    """
    # Create user in Supabase Auth
    response = supabase.auth.admin.create_user({
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": {
            "full_name": full_name,
            "role": role_name,
        }
    })
    if hasattr(response, 'user') and response.user:
        user_id = str(response.user.id)
    else:
        raise ValueError(f"Falha ao criar utilizador no Supabase: {response}")

    from database.connection import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()

        project_scoped = len(project_ids) > 0 and not is_root

        # Upsert profiles row (trigger may have already created it)
        cur.execute("""
            INSERT INTO profiles (id, email, full_name, role, is_root, is_direcao, is_coordenacao, project_scoped)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                role = EXCLUDED.role,
                is_root = EXCLUDED.is_root,
                is_direcao = EXCLUDED.is_direcao,
                is_coordenacao = EXCLUDED.is_coordenacao,
                project_scoped = EXCLUDED.project_scoped,
                updated_at = NOW()
        """, (user_id, email, full_name, role_name, is_root, is_direcao, is_coordenacao, project_scoped))

        # Per-user page overrides
        for slug, granted in page_overrides.items():
            if slug in ALL_PAGE_SLUGS:
                cur.execute("""
                    INSERT INTO user_page_permissions (user_id, page_slug, granted)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id, page_slug) DO UPDATE SET granted = EXCLUDED.granted
                """, (user_id, slug, granted))

        # Project access
        for pid in project_ids:
            cur.execute("""
                INSERT INTO user_project_access (user_id, projeto_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
            """, (user_id, pid))

        conn.commit()
        cur.close()
        return {"id": user_id, "email": email, "full_name": full_name, "role": role_name}
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao configurar permissões do novo utilizador: {e}")
        raise
    finally:
        conn.close()


def obter_permissoes_utilizador_detalhe(user_id: str) -> dict:
    """Returns full permission detail for admin UI."""
    from database.connection import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()

        cur.execute(
            "SELECT role, is_root, is_direcao, is_coordenacao, project_scoped FROM profiles WHERE id = %s",
            (user_id,)
        )
        row = cur.fetchone()
        if not row:
            return {}
        role, is_root, is_direcao, is_coordenacao, project_scoped = row

        cur.execute(
            "SELECT page_slug, granted FROM user_page_permissions WHERE user_id = %s",
            (user_id,)
        )
        page_overrides = {r[0]: r[1] for r in cur.fetchall()}

        cur.execute(
            "SELECT projeto_id FROM user_project_access WHERE user_id = %s",
            (user_id,)
        )
        project_ids = [r[0] for r in cur.fetchall()]

        cur.close()
        return {
            "role": role,
            "is_root": bool(is_root),
            "is_direcao": bool(is_direcao),
            "is_coordenacao": bool(is_coordenacao),
            "project_scoped": bool(project_scoped),
            "page_overrides": page_overrides,
            "project_ids": project_ids,
        }
    except Exception as e:
        logger.error(f"Erro ao obter detalhe de permissões: {e}")
        return {}
    finally:
        conn.close()


def atualizar_permissoes_utilizador(
    user_id: str,
    role_name: str,
    page_overrides: dict,
    project_ids: list[int],
    is_root: bool,
    is_direcao: bool = False,
    is_coordenacao: bool = False,
) -> bool:
    from database.connection import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        project_scoped = len(project_ids) > 0 and not is_root

        cur.execute("""
            UPDATE profiles
            SET role = %s, is_root = %s, is_direcao = %s, is_coordenacao = %s, project_scoped = %s, updated_at = NOW()
            WHERE id = %s
        """, (role_name, is_root, is_direcao, is_coordenacao, project_scoped, user_id))

        # Replace page overrides
        cur.execute("DELETE FROM user_page_permissions WHERE user_id = %s", (user_id,))
        for slug, granted in page_overrides.items():
            if slug in ALL_PAGE_SLUGS:
                cur.execute(
                    "INSERT INTO user_page_permissions (user_id, page_slug, granted) VALUES (%s, %s, %s)",
                    (user_id, slug, granted)
                )

        # Replace project access
        cur.execute("DELETE FROM user_project_access WHERE user_id = %s", (user_id,))
        for pid in project_ids:
            cur.execute(
                "INSERT INTO user_project_access (user_id, projeto_id) VALUES (%s, %s)",
                (user_id, pid)
            )

        conn.commit()
        cur.close()

        # Sync role in Supabase Auth metadata
        supabase.auth.admin.update_user_by_id(user_id, {"user_metadata": {"role": role_name}})

        _cache_invalidate(user_id)
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao atualizar permissões do utilizador {user_id}: {e}")
        raise
    finally:
        conn.close()

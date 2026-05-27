import os
import time
import json
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

# Catalogue of all known action keys — exposed via GET /api/admin/action-keys
ACTION_KEYS_CATALOGUE = [
    {"key": "sessions.create",         "label": "Criar sessões",                      "category": "Horários"},
    {"key": "sessions.state_override", "label": "Forçar estado de sessão",            "category": "Horários"},
    {"key": "sessions.export",         "label": "Exportar sessões",                   "category": "Horários"},
    {"key": "production.lab",          "label": "Mover cards lab (mistura/finalização)", "category": "Produção"},
    {"key": "production.feedback",     "label": "Mover cards feedback",               "category": "Produção"},
    {"key": "production.prioritize",   "label": "Prioritizar músicas",                "category": "Produção"},
    {"key": "production.delete",       "label": "Apagar músicas",                     "category": "Produção"},
    {"key": "wiki.edit",               "label": "Criar/editar/apagar Wiki",           "category": "Wiki & Projetos"},
    {"key": "projects.manage",         "label": "Gerir projetos",                     "category": "Wiki & Projetos"},
    {"key": "tasks.manage",            "label": "Gerir tarefas",                      "category": "Wiki & Projetos"},
    {"key": "registos.export",         "label": "Exportar registos",                  "category": "Equipa & Financeiro"},
    {"key": "financial.view_rates",    "label": "Ver taxas horárias",                 "category": "Equipa & Financeiro"},
    {"key": "financial.manage_rates",  "label": "Editar taxas horárias",              "category": "Equipa & Financeiro"},
    {"key": "team.manage",             "label": "Editar/apagar membros da equipa",    "category": "Equipa & Financeiro"},
    {"key": "shortcuts.manage",        "label": "Gerir atalhos",                      "category": "Equipa & Financeiro"},
    {"key": "admin.settings",          "label": "Alterar settings do sistema",        "category": "Admin"},
    {"key": "admin.users",             "label": "Criar/gerir utilizadores",           "category": "Admin"},
    {"key": "admin.audit",             "label": "Ver registo de auditoria",           "category": "Admin"},
    {"key": "admin.roles",             "label": "Gerir roles",                        "category": "Admin"},
    {"key": "admin.patentes",          "label": "Gerir patentes",                     "category": "Admin"},
]

# --- Simple TTL cache ---
_CACHE: dict[str, tuple[float, dict]] = {}
_CACHE_TTL = 30  # seconds

_NOT_SET = object()  # sentinel for optional update params


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
    Uses permission_level (patente) when set; falls back to legacy boolean flags.

    Returns:
        {
            "is_root": bool,
            "is_direcao": bool,
            "is_coordenacao": bool,
            "role": str,
            "allowed_pages": set[str],
            "allowed_actions": dict[str, bool],
            "permission_level": dict | None,
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

        # Fetch profile joined with patente in one query
        cur.execute("""
            SELECT p.role, p.is_root, p.is_direcao, p.is_coordenacao, p.project_scoped,
                   p.permission_level_id,
                   pl.level_order, pl.allowed_pages, pl.allowed_actions,
                   pl.name AS pl_name, pl.label AS pl_label, pl.color AS pl_color
            FROM profiles p
            LEFT JOIN permission_levels pl ON pl.id = p.permission_level_id
            WHERE p.id = %s
        """, (user_id,))
        row = cur.fetchone()
        if not row:
            result = {
                "is_root": False, "is_direcao": False, "is_coordenacao": False,
                "role": "mentor", "allowed_pages": set(), "allowed_actions": {},
                "permission_level": None, "project_scoped": False, "allowed_project_ids": [],
            }
            _cache_set(user_id, result)
            return result

        (role, db_is_root, db_is_direcao, db_is_coordenacao, project_scoped,
         perm_level_id, level_order, pl_allowed_pages, pl_allowed_actions,
         pl_name, pl_label, pl_color) = row

        # Derive flags from level_order when patente is set; else fall back to DB flags
        if perm_level_id is not None and level_order is not None:
            is_root = level_order >= 5
            is_direcao = level_order >= 4
            is_coordenacao = level_order >= 3
        else:
            is_root = bool(db_is_root)
            is_direcao = bool(db_is_direcao)
            is_coordenacao = bool(db_is_coordenacao)

        # Determine allowed_pages
        if is_root:
            allowed_pages = set(ALL_PAGE_SLUGS)
        elif perm_level_id is not None and pl_allowed_pages is not None:
            pages_list = pl_allowed_pages if isinstance(pl_allowed_pages, list) else []
            allowed_pages = set(pages_list) & ALL_PAGE_SLUGS
        else:
            # Legacy fallback: role page permissions
            cur.execute("""
                SELECT rpp.page_slug
                FROM role_page_permissions rpp
                JOIN roles r ON r.id = rpp.role_id
                WHERE r.name = %s
            """, (role,))
            allowed_pages = {r[0] for r in cur.fetchall()}
            if is_direcao:
                allowed_pages = set(ALL_PAGE_SLUGS) - {"admin"}
            elif is_coordenacao:
                allowed_pages.add("equipamento")

        # Per-user page overrides (always applied, even with patente)
        if not is_root:
            cur.execute(
                "SELECT page_slug, granted FROM user_page_permissions WHERE user_id = %s",
                (user_id,)
            )
            for page_slug, granted in cur.fetchall():
                if granted:
                    allowed_pages.add(page_slug)
                else:
                    allowed_pages.discard(page_slug)

        # Allowed actions from patente
        if perm_level_id is not None and pl_allowed_actions is not None:
            allowed_actions = pl_allowed_actions if isinstance(pl_allowed_actions, dict) else {}
        else:
            allowed_actions = {}

        # Permission level summary object
        permission_level = None
        if perm_level_id is not None:
            permission_level = {
                "id": perm_level_id,
                "name": pl_name,
                "label": pl_label,
                "level_order": level_order,
                "color": pl_color,
            }

        # Project access
        allowed_project_ids = []
        if project_scoped and not is_root:
            cur.execute(
                "SELECT projeto_id FROM user_project_access WHERE user_id = %s",
                (user_id,)
            )
            allowed_project_ids = [r[0] for r in cur.fetchall()]

        cur.close()

        # Feature flags: remove globally disabled modules (root not affected)
        if not is_root:
            try:
                from services import settings_service as _settings_svc
                _MODULE_FLAGS = {
                    "chat":         "module_chat_enabled",
                    "financeiro":   "module_financeiro_enabled",
                    "estudio":      "module_estudio_enabled",
                    "wiki":         "module_wiki_enabled",
                    "formacao":     "module_formacao_enabled",
                    "equipamento":  "module_equipamento_enabled",
                    "estatisticas": "module_estatisticas_enabled",
                }
                for page, flag in _MODULE_FLAGS.items():
                    if not _settings_svc.obter(flag, True):
                        allowed_pages.discard(page)
            except Exception as _e:
                logger.warning("Erro ao aplicar feature flags: %s", _e)

        result = {
            "is_root": bool(is_root),
            "is_direcao": bool(is_direcao),
            "is_coordenacao": bool(is_coordenacao),
            "role": role or "mentor",
            "allowed_pages": allowed_pages,
            "allowed_actions": allowed_actions,
            "permission_level": permission_level,
            "project_scoped": bool(project_scoped),
            "allowed_project_ids": allowed_project_ids,
        }
        _cache_set(user_id, result)
        return result
    except Exception as e:
        logger.error(f"Erro ao obter permissões do utilizador {user_id}: {e}")
        return {
            "is_root": False, "is_direcao": False, "is_coordenacao": False,
            "role": "mentor", "allowed_pages": set(), "allowed_actions": {},
            "permission_level": None, "project_scoped": False, "allowed_project_ids": [],
        }
    finally:
        conn.close()


def has_action(user_id: str, action_key: str) -> bool:
    """Returns True if the user's patente grants the specified action."""
    perms = get_user_permissions(user_id)
    if perms["is_root"]:
        return True
    return bool(perms["allowed_actions"].get(action_key, False))


def get_project_filter(user_id: str) -> Optional[list]:
    """Returns None if user sees all projects, or a list of allowed projeto_ids."""
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
            SELECT r.id, r.name, r.label, r.is_system, r.default_permission_level_id, r.color,
                   COALESCE(
                       array_agg(rpp.page_slug ORDER BY rpp.page_slug)
                       FILTER (WHERE rpp.page_slug IS NOT NULL),
                       '{}'
                   ) AS pages
            FROM roles r
            LEFT JOIN role_page_permissions rpp ON rpp.role_id = r.id
            GROUP BY r.id, r.name, r.label, r.is_system, r.default_permission_level_id, r.color
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


def criar_role(name: str, label: str, pages: list[str], default_permission_level_id: Optional[int] = None, color: Optional[str] = None) -> dict:
    from database.connection import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO roles (name, label, is_system, default_permission_level_id, color) VALUES (%s, %s, FALSE, %s, %s) RETURNING id",
            (name, label, default_permission_level_id, color)
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
        return {"id": role_id, "name": name, "label": label, "is_system": False,
                "pages": pages, "default_permission_level_id": default_permission_level_id, "color": color}
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao criar role: {e}")
        raise
    finally:
        conn.close()


def atualizar_role_pages(role_id: int, pages: list[str], default_permission_level_id=_NOT_SET, color=_NOT_SET) -> bool:
    from database.connection import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT is_system FROM roles WHERE id = %s", (role_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError("Role não encontrado")
        cur.execute("DELETE FROM role_page_permissions WHERE role_id = %s", (role_id,))
        for slug in pages:
            if slug in ALL_PAGE_SLUGS:
                cur.execute(
                    "INSERT INTO role_page_permissions (role_id, page_slug) VALUES (%s, %s)",
                    (role_id, slug)
                )
        if default_permission_level_id is not _NOT_SET:
            cur.execute(
                "UPDATE roles SET default_permission_level_id = %s WHERE id = %s",
                (default_permission_level_id, role_id)
            )
        if color is not _NOT_SET:
            cur.execute("UPDATE roles SET color = %s WHERE id = %s", (color, role_id))
        conn.commit()
        cur.close()
        _CACHE.clear()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao atualizar páginas do role {role_id}: {e}")
        raise
    finally:
        conn.close()


# --- Patentes (permission levels) management ---

def listar_patentes() -> list:
    from database.connection import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT id, name, label, level_order, allowed_pages, allowed_actions,
                   is_system, color, created_at
            FROM permission_levels
            ORDER BY level_order
        """)
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, row)) for row in cur.fetchall()]
        cur.close()
        return rows
    except Exception as e:
        logger.error(f"Erro ao listar patentes: {e}")
        return []
    finally:
        conn.close()


def criar_patente(name: str, label: str, level_order: int, allowed_pages: list,
                  allowed_actions: dict, color: Optional[str] = None) -> dict:
    from database.connection import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO permission_levels (name, label, level_order, allowed_pages, allowed_actions, is_system, color)
            VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, FALSE, %s)
            RETURNING id
        """, (name, label, level_order, json.dumps(allowed_pages), json.dumps(allowed_actions), color))
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        return {"id": new_id, "name": name, "label": label, "level_order": level_order,
                "allowed_pages": allowed_pages, "allowed_actions": allowed_actions,
                "is_system": False, "color": color}
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao criar patente: {e}")
        raise
    finally:
        conn.close()


def atualizar_patente(patente_id: int, label: str, allowed_pages: list,
                      allowed_actions: dict, color: Optional[str] = None,
                      level_order: Optional[int] = None) -> bool:
    from database.connection import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT is_system FROM permission_levels WHERE id = %s", (patente_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError("Patente não encontrada")
        updates = ["label = %s", "allowed_pages = %s::jsonb", "allowed_actions = %s::jsonb", "color = %s"]
        params = [label, json.dumps(allowed_pages), json.dumps(allowed_actions), color]
        # level_order of system patentes cannot be changed
        if level_order is not None and not row[0]:
            updates.append("level_order = %s")
            params.append(level_order)
        params.append(patente_id)
        cur.execute(f"UPDATE permission_levels SET {', '.join(updates)} WHERE id = %s", params)
        conn.commit()
        cur.close()
        _CACHE.clear()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao atualizar patente {patente_id}: {e}")
        raise
    finally:
        conn.close()


def apagar_patente(patente_id: int) -> bool:
    from database.connection import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        cur.execute("SELECT is_system FROM permission_levels WHERE id = %s", (patente_id,))
        row = cur.fetchone()
        if not row:
            raise ValueError("Patente não encontrada")
        if row[0]:
            raise ValueError("Não é possível apagar uma patente de sistema")
        cur.execute("DELETE FROM permission_levels WHERE id = %s", (patente_id,))
        conn.commit()
        cur.close()
        _CACHE.clear()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao apagar patente {patente_id}: {e}")
        raise
    finally:
        conn.close()


# --- User management ---

def criar_utilizador(
    email: str,
    password: str,
    full_name: str,
    role_name: str,
    page_overrides: dict,
    project_ids: list[int],
    is_root: bool,
    is_direcao: bool = False,
    is_coordenacao: bool = False,
    permission_level_id: Optional[int] = None,
) -> dict:
    """Creates a new user via Supabase Admin API (email pre-confirmed)."""
    response = supabase.auth.admin.create_user({
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": {"full_name": full_name, "role": role_name},
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

        cur.execute("""
            INSERT INTO profiles (id, email, full_name, role, is_root, is_direcao, is_coordenacao,
                                  project_scoped, permission_level_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                role = EXCLUDED.role,
                is_root = EXCLUDED.is_root,
                is_direcao = EXCLUDED.is_direcao,
                is_coordenacao = EXCLUDED.is_coordenacao,
                project_scoped = EXCLUDED.project_scoped,
                permission_level_id = EXCLUDED.permission_level_id,
                updated_at = NOW()
        """, (user_id, email, full_name, role_name, is_root, is_direcao, is_coordenacao,
              project_scoped, permission_level_id))

        for slug, granted in page_overrides.items():
            if slug in ALL_PAGE_SLUGS:
                cur.execute("""
                    INSERT INTO user_page_permissions (user_id, page_slug, granted)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id, page_slug) DO UPDATE SET granted = EXCLUDED.granted
                """, (user_id, slug, granted))

        for pid in project_ids:
            cur.execute(
                "INSERT INTO user_project_access (user_id, projeto_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (user_id, pid)
            )

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
            "SELECT role, is_root, is_direcao, is_coordenacao, project_scoped, permission_level_id FROM profiles WHERE id = %s",
            (user_id,)
        )
        row = cur.fetchone()
        if not row:
            return {}
        role, is_root, is_direcao, is_coordenacao, project_scoped, permission_level_id = row

        cur.execute("SELECT page_slug, granted FROM user_page_permissions WHERE user_id = %s", (user_id,))
        page_overrides = {r[0]: r[1] for r in cur.fetchall()}

        cur.execute("SELECT projeto_id FROM user_project_access WHERE user_id = %s", (user_id,))
        project_ids = [r[0] for r in cur.fetchall()]

        cur.close()
        return {
            "role": role,
            "is_root": bool(is_root),
            "is_direcao": bool(is_direcao),
            "is_coordenacao": bool(is_coordenacao),
            "project_scoped": bool(project_scoped),
            "permission_level_id": permission_level_id,
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
    permission_level_id: Optional[int] = None,
) -> bool:
    from database.connection import get_db_connection
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        project_scoped = len(project_ids) > 0 and not is_root

        cur.execute("""
            UPDATE profiles
            SET role = %s, is_root = %s, is_direcao = %s, is_coordenacao = %s,
                project_scoped = %s, permission_level_id = %s, updated_at = NOW()
            WHERE id = %s
        """, (role_name, is_root, is_direcao, is_coordenacao, project_scoped, permission_level_id, user_id))

        cur.execute("DELETE FROM user_page_permissions WHERE user_id = %s", (user_id,))
        for slug, granted in page_overrides.items():
            if slug in ALL_PAGE_SLUGS:
                cur.execute(
                    "INSERT INTO user_page_permissions (user_id, page_slug, granted) VALUES (%s, %s, %s)",
                    (user_id, slug, granted)
                )

        cur.execute("DELETE FROM user_project_access WHERE user_id = %s", (user_id,))
        for pid in project_ids:
            cur.execute(
                "INSERT INTO user_project_access (user_id, projeto_id) VALUES (%s, %s)",
                (user_id, pid)
            )

        conn.commit()
        cur.close()

        supabase.auth.admin.update_user_by_id(user_id, {"user_metadata": {"role": role_name}})

        _cache_invalidate(user_id)
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao atualizar permissões do utilizador {user_id}: {e}")
        raise
    finally:
        conn.close()

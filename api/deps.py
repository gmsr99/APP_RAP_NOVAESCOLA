"""
Dependências e helpers de permissão partilhados por todos os routers.
"""
from fastapi import HTTPException
from services import permission_service as _perm_svc


def _require_admin(user: dict):
    """Levanta 403 se o utilizador não for root. Gestão de sistema é exclusiva de IT."""
    user_id = user.get("sub")
    perms = _perm_svc.get_user_permissions(user_id)
    if perms["is_root"]:
        return
    raise HTTPException(status_code=403, detail="Acesso negado.")


def _require_direcao(user: dict):
    """Levanta 403 se o utilizador não tiver acesso de direção (is_root ou is_direcao)."""
    user_id = user.get("sub")
    perms = _perm_svc.get_user_permissions(user_id)
    if perms["is_root"] or perms["is_direcao"]:
        return
    raise HTTPException(status_code=403, detail="Acesso negado.")


def _require_coordenacao(user: dict):
    """Levanta 403 se o utilizador não tiver acesso de coordenação."""
    user_id = user.get("sub")
    perms = _perm_svc.get_user_permissions(user_id)
    if perms["is_root"] or perms["is_direcao"] or perms["is_coordenacao"]:
        return
    raise HTTPException(status_code=403, detail="Acesso negado.")


def _require_root_or_role(user: dict, allowed_roles: set):
    """Levanta 403 se o utilizador não for root nem tiver um dos roles permitidos."""
    user_id = user.get("sub")
    perms = _perm_svc.get_user_permissions(user_id)
    if perms["is_root"]:
        return
    if perms["role"] not in allowed_roles:
        raise HTTPException(status_code=403, detail="Acesso negado.")


def _require_action(user: dict, action_key: str):
    """Levanta 403 se o utilizador não tiver a action_key permitida na sua patente."""
    user_id = user.get("sub")
    if not _perm_svc.has_action(user_id, action_key):
        raise HTTPException(status_code=403, detail="Acesso negado.")

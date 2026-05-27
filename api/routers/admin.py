from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import settings_service as _settings_svc
from services import audit_service as _audit_svc

router = APIRouter()


class SettingUpdatePayload(BaseModel):
    value: Any


class RoleCreatePayload(BaseModel):
    name: str
    label: str
    pages: List[str] = []
    default_permission_level_id: Optional[int] = None
    color: Optional[str] = None


class RolePagesUpdatePayload(BaseModel):
    pages: List[str]
    default_permission_level_id: Optional[int] = None
    color: Optional[str] = None


class AdminCreateUserPayload(BaseModel):
    email: str
    password: str
    full_name: str
    role: str
    page_overrides: dict = {}
    project_ids: List[int] = []
    is_root: bool = False
    is_direcao: bool = False
    is_coordenacao: bool = False
    permission_level_id: Optional[int] = None


class AdminUpdatePermissionsPayload(BaseModel):
    role: str
    page_overrides: dict = {}
    project_ids: List[int] = []
    is_root: bool = False
    is_direcao: bool = False
    is_coordenacao: bool = False
    permission_level_id: Optional[int] = None


class PatenteCreatePayload(BaseModel):
    name: str
    label: str
    level_order: int
    allowed_pages: List[str] = []
    allowed_actions: dict = {}
    color: Optional[str] = None


class PatenteUpdatePayload(BaseModel):
    label: str
    allowed_pages: List[str] = []
    allowed_actions: dict = {}
    color: Optional[str] = None
    level_order: Optional[int] = None


@router.get("/api/admin/settings", tags=["Admin"])
async def admin_listar_settings(user=Depends(get_current_user_required)):
    """Lista todas as configurações do sistema. Leitura: direção e root."""
    _require_direcao(user)
    return _settings_svc.obter_todas()


@router.patch("/api/admin/settings/{key}", tags=["Admin"])
async def admin_atualizar_setting(key: str, payload: SettingUpdatePayload, user=Depends(get_current_user_required)):
    """Actualiza o valor de uma configuração do sistema. Escrita: root apenas."""
    _require_admin(user)
    ok = _settings_svc.definir(key, payload.value, user.get("sub"))
    if not ok:
        raise HTTPException(status_code=404, detail=f"Setting '{key}' não encontrada.")
    _audit_svc.registar(user.get("sub"), user.get("email"), "setting.update", "setting", key, {"value": payload.value})
    return {"ok": True, "key": key, "value": payload.value}


@router.get("/api/public/identity", tags=["Public"])
async def get_app_identity():
    """Endpoint sem auth — devolve branding/identidade da app para o frontend."""
    s = _settings_svc.obter_todas()
    return {
        "app_name":          s.get("app_name", {}).get("value", "RAP Nova Escola"),
        "app_logo_url":      s.get("app_logo_url", {}).get("value", ""),
        "app_support_email": s.get("app_support_email", {}).get("value", ""),
        "app_primary_color": s.get("app_primary_color", {}).get("value", "#3399ce"),
    }


@router.get("/api/admin/audit-logs", tags=["Admin"])
async def admin_audit_logs(limit: int = 200, user=Depends(get_current_user_required)):
    """Lista as últimas entradas do audit log. Apenas root."""
    _require_admin(user)
    return _audit_svc.listar(limit)


@router.get("/api/admin/roles", tags=["Admin"])
async def admin_listar_roles(user=Depends(get_current_user_required)):
    """Lista todos os roles (sistema + custom). Qualquer utilizador autenticado pode ler."""
    return _perm_svc.listar_roles()


@router.post("/api/admin/roles", tags=["Admin"])
async def admin_criar_role(payload: RoleCreatePayload, user=Depends(get_current_user_required)):
    """Cria um role custom com as páginas indicadas."""
    _require_admin(user)
    try:
        result = _perm_svc.criar_role(payload.name, payload.label, payload.pages, payload.default_permission_level_id, payload.color)
        _audit_svc.registar(user.get("sub"), user.get("email"), "role.create", "role", payload.name, {"label": payload.label, "pages": payload.pages})
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/api/admin/roles/{role_id}", tags=["Admin"])
async def admin_atualizar_role_pages(role_id: int, payload: RolePagesUpdatePayload, user=Depends(get_current_user_required)):
    """Atualiza as páginas acessíveis e patente padrão de um role."""
    _require_admin(user)
    try:
        _perm_svc.atualizar_role_pages(role_id, payload.pages, payload.default_permission_level_id, payload.color)
        _audit_svc.registar(user.get("sub"), user.get("email"), "role.update", "role", str(role_id), {"pages": payload.pages})
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/api/admin/users", tags=["Admin"])
async def admin_criar_utilizador(payload: AdminCreateUserPayload, user=Depends(get_current_user_required)):
    """Cria uma nova conta (email pré-confirmado, password definida na hora)."""
    _require_admin(user)
    try:
        result = _perm_svc.criar_utilizador(
            email=payload.email,
            password=payload.password,
            full_name=payload.full_name,
            role_name=payload.role,
            page_overrides=payload.page_overrides,
            project_ids=payload.project_ids,
            is_root=payload.is_root,
            is_direcao=payload.is_direcao,
            is_coordenacao=payload.is_coordenacao,
            permission_level_id=payload.permission_level_id,
        )
        _audit_svc.registar(user.get("sub"), user.get("email"), "user.create", "user", payload.email, {"full_name": payload.full_name, "role": payload.role})
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/admin/users/{user_id}/permissions", tags=["Admin"])
async def admin_obter_permissoes(user_id: str, user=Depends(get_current_user_required)):
    """Devolve o detalhe de permissões de um utilizador (para o painel admin)."""
    _require_admin(user)
    result = _perm_svc.obter_permissoes_utilizador_detalhe(user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Utilizador não encontrado.")
    return result


@router.put("/api/admin/users/{user_id}/permissions", tags=["Admin"])
async def admin_atualizar_permissoes(user_id: str, payload: AdminUpdatePermissionsPayload, user=Depends(get_current_user_required)):
    """Atualiza role, overrides de página, projetos, patente e flag root de um utilizador."""
    _require_admin(user)
    caller_id = user.get("sub")
    if user_id == caller_id:
        raise HTTPException(status_code=400, detail="Não podes alterar as tuas próprias permissões aqui.")
    try:
        _perm_svc.atualizar_permissoes_utilizador(
            user_id=user_id,
            role_name=payload.role,
            page_overrides=payload.page_overrides,
            project_ids=payload.project_ids,
            is_root=payload.is_root,
            is_direcao=payload.is_direcao,
            is_coordenacao=payload.is_coordenacao,
            permission_level_id=payload.permission_level_id,
        )
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/admin/patentes", tags=["Admin"])
async def admin_listar_patentes(user=Depends(get_current_user_required)):
    """Lista todas as patentes (permission levels) ordenadas por nível. Direção+."""
    _require_direcao(user)
    return _perm_svc.listar_patentes()


@router.get("/api/admin/action-keys", tags=["Admin"])
async def admin_action_keys(user=Depends(get_current_user_required)):
    """Lista todas as action keys disponíveis com labels e categorias."""
    _require_direcao(user)
    return _perm_svc.ACTION_KEYS_CATALOGUE


@router.post("/api/admin/patentes", tags=["Admin"])
async def admin_criar_patente(payload: PatenteCreatePayload, user=Depends(get_current_user_required)):
    """Cria uma nova patente. Apenas root."""
    _require_admin(user)
    try:
        result = _perm_svc.criar_patente(
            payload.name, payload.label, payload.level_order,
            payload.allowed_pages, payload.allowed_actions, payload.color,
        )
        _audit_svc.registar(user.get("sub"), user.get("email"), "patente.create", "patente", payload.name, {"label": payload.label})
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/api/admin/patentes/{patente_id}", tags=["Admin"])
async def admin_atualizar_patente(patente_id: int, payload: PatenteUpdatePayload, user=Depends(get_current_user_required)):
    """Atualiza label, páginas, ações e cor de uma patente. Apenas root."""
    _require_admin(user)
    try:
        _perm_svc.atualizar_patente(
            patente_id, payload.label, payload.allowed_pages,
            payload.allowed_actions, payload.color, payload.level_order,
        )
        _audit_svc.registar(user.get("sub"), user.get("email"), "patente.update", "patente", str(patente_id), {"label": payload.label})
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/api/admin/patentes/{patente_id}", tags=["Admin"])
async def admin_apagar_patente(patente_id: int, user=Depends(get_current_user_required)):
    """Apaga uma patente não-sistema. Apenas root."""
    _require_admin(user)
    try:
        _perm_svc.apagar_patente(patente_id)
        _audit_svc.registar(user.get("sub"), user.get("email"), "patente.delete", "patente", str(patente_id), {})
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

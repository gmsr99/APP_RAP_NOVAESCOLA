import os
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import projeto_service

router = APIRouter()


class ProjetoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None


class ProjetoEstabAssoc(BaseModel):
    estabelecimento_id: int


class ProjetoConfigPayload(BaseModel):
    requer_digitalizacao: bool
    tem_pre_registos: Optional[bool] = None
    codigo_projeto: Optional[str] = None
    usar_template_proprio: Optional[bool] = None
    usa_template_pis: Optional[bool] = None
    honorario_entidade: Optional[str] = None
    honorario_morada: Optional[str] = None
    honorario_cod_postal: Optional[str] = None
    honorario_nipc: Optional[str] = None
    honorario_designacao: Optional[str] = None


_ASSET_TIPOS = {"logo_esq": "logo_esq_path", "logo_dir": "logo_dir_path", "footer": "footer_path"}


@router.get("/api/projetos", tags=["Projetos"])
async def get_projetos(user=Depends(get_current_user_required)):
    """Lista todos os projetos (filtrado por project scoping se aplicável)."""
    project_filter = _perm_svc.get_project_filter(user.get("sub"))
    return projeto_service.listar_projetos(allowed_ids=project_filter)


@router.post("/api/projetos", tags=["Projetos"])
async def create_projeto(data: ProjetoCreate, user=Depends(get_current_user_required)):
    """Cria um novo projeto."""
    _require_coordenacao(user)
    res = projeto_service.criar_projeto(data.nome, data.descricao)
    if not res:
        raise HTTPException(status_code=400, detail="Falha ao criar projeto")
    return res


@router.put("/api/projetos/{id}", tags=["Projetos"])
async def update_projeto(id: int, data: ProjetoCreate, user=Depends(get_current_user_required)):
    """Atualiza um projeto."""
    _require_coordenacao(user)
    sucesso = projeto_service.atualizar_projeto(id, data.nome, data.descricao)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atualizar projeto")
    return {"message": "Projeto atualizado"}


@router.delete("/api/projetos/{id}", tags=["Projetos"])
async def delete_projeto(id: int, user=Depends(get_current_user_required)):
    """Apaga um projeto."""
    _require_coordenacao(user)
    sucesso = projeto_service.apagar_projeto(id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return {"message": "Projeto apagado"}


@router.get("/api/projetos/{id}/estabelecimentos", tags=["Projetos"])
async def get_projeto_estabelecimentos(id: int, user=Depends(get_current_user_required)):
    """Lista estabelecimentos de um projeto."""
    return projeto_service.listar_estabelecimentos_por_projeto(id)


@router.post("/api/projetos/{id}/estabelecimentos", tags=["Projetos"])
async def add_projeto_estabelecimento(id: int, data: ProjetoEstabAssoc, user=Depends(get_current_user_required)):
    """Associa um estabelecimento a um projeto."""
    _require_coordenacao(user)
    sucesso = projeto_service.associar_estabelecimento(id, data.estabelecimento_id)
    if not sucesso:
        raise HTTPException(status_code=400, detail="Falha ao associar estabelecimento")
    return {"message": "Estabelecimento associado"}


@router.delete("/api/projetos/{id}/estabelecimentos/{estab_id}", tags=["Projetos"])
async def remove_projeto_estabelecimento(id: int, estab_id: int, user=Depends(get_current_user_required)):
    """Remove associação entre projeto e estabelecimento."""
    _require_coordenacao(user)
    sucesso = projeto_service.desassociar_estabelecimento(id, estab_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Associação não encontrada")
    return {"message": "Estabelecimento desassociado"}


@router.patch("/api/projetos/{id}/config", tags=["Projetos"])
async def update_projeto_config(id: int, data: ProjetoConfigPayload, user=Depends(get_current_user_required)):
    _require_coordenacao(user)
    sucesso = projeto_service.atualizar_config_projeto(
        id, data.requer_digitalizacao, data.tem_pre_registos, data.codigo_projeto, data.usar_template_proprio,
        data.usa_template_pis, data.honorario_entidade, data.honorario_morada,
        data.honorario_cod_postal, data.honorario_nipc, data.honorario_designacao,
    )
    if not sucesso:
        raise HTTPException(status_code=404, detail="Projeto não encontrado")
    return {"message": "Configurações atualizadas"}


@router.post("/api/projetos/{id}/assets", tags=["Projetos"])
async def upload_projeto_asset(
    id: int,
    tipo: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user_required),
):
    _require_coordenacao(user)
    if tipo not in _ASSET_TIPOS:
        raise HTTPException(status_code=400, detail="tipo inválido: use logo_esq, logo_dir ou footer")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("png", "jpg", "jpeg", "webp"):
        raise HTTPException(status_code=400, detail="Formato não suportado. Use PNG ou JPG.")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ficheiro demasiado grande (máx 5MB).")
    from supabase import create_client as _sb_client
    sb_url = os.environ.get("SUPABASE_URL", "")
    sb_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")
    sb = _sb_client(sb_url, sb_key)
    path = f"{id}/{tipo}.{ext}"
    sb.storage.from_("project-assets").upload(path, content, {"upsert": "true", "content-type": file.content_type})
    campo = _ASSET_TIPOS[tipo]
    projeto_service.atualizar_logo_projeto(id, campo, path)
    public_url = f"{sb_url}/storage/v1/object/public/project-assets/{path}"
    return {"path": path, "url": public_url}


@router.delete("/api/projetos/{id}/assets/{tipo}", tags=["Projetos"])
async def delete_projeto_asset(id: int, tipo: str, user=Depends(get_current_user_required)):
    _require_coordenacao(user)
    if tipo not in _ASSET_TIPOS:
        raise HTTPException(status_code=400, detail="tipo inválido")
    from supabase import create_client as _sb_client
    sb_url = os.environ.get("SUPABASE_URL", "")
    sb_key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_ANON_KEY", "")
    sb = _sb_client(sb_url, sb_key)
    # Try to remove both .png and .jpg variants
    for ext in ("png", "jpg", "jpeg", "webp"):
        try:
            sb.storage.from_("project-assets").remove([f"{id}/{tipo}.{ext}"])
        except Exception:
            pass
    projeto_service.atualizar_logo_projeto(id, _ASSET_TIPOS[tipo], None)
    return {"message": "Asset removido"}

import os
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from typing import Optional
from pydantic import BaseModel
from auth import get_current_user_required
from api.deps import _require_coordenacao
from services import permission_service as _perm_svc
from services import projeto_service
from services import sub_projeto_service

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
    usar_sub_projetos: Optional[bool] = None
    usar_template_km_proprio: Optional[bool] = None


class SubProjetoCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None


class SubProjetoEstabAssoc(BaseModel):
    estabelecimento_id: int


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
async def get_projeto_estabelecimentos(id: int, _user=Depends(get_current_user_required)):
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
        data.usar_sub_projetos, data.usar_template_km_proprio,
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
    for ext in ("png", "jpg", "jpeg", "webp"):
        try:
            sb.storage.from_("project-assets").remove([f"{id}/{tipo}.{ext}"])
        except Exception:
            pass
    projeto_service.atualizar_logo_projeto(id, _ASSET_TIPOS[tipo], None)
    return {"message": "Asset removido"}


# ─── Sub-Projetos ────────────────────────────────────────────────────────────

@router.get("/api/sub-projetos", tags=["SubProjetos"])
async def get_all_sub_projetos(_user=Depends(get_current_user_required)):
    """Lista todos os sub-projetos de todos os projetos."""
    return sub_projeto_service.listar_todos_sub_projetos()


@router.get("/api/projetos/{id}/sub-projetos", tags=["SubProjetos"])
async def get_sub_projetos(id: int, _user=Depends(get_current_user_required)):
    """Lista sub-projetos de um projeto, com os respetivos estabelecimentos."""
    return sub_projeto_service.listar_sub_projetos(id)


@router.post("/api/projetos/{id}/sub-projetos", tags=["SubProjetos"])
async def create_sub_projeto(id: int, data: SubProjetoCreate, user=Depends(get_current_user_required)):
    """Cria um sub-projeto dentro de um projeto."""
    _require_coordenacao(user)
    res = sub_projeto_service.criar_sub_projeto(id, data.nome, data.descricao)
    if not res:
        raise HTTPException(status_code=400, detail="Falha ao criar sub-projeto")
    return res


@router.put("/api/sub-projetos/{sub_id}", tags=["SubProjetos"])
async def update_sub_projeto(sub_id: int, data: SubProjetoCreate, user=Depends(get_current_user_required)):
    """Atualiza nome/descrição de um sub-projeto."""
    _require_coordenacao(user)
    sucesso = sub_projeto_service.atualizar_sub_projeto(sub_id, data.nome, data.descricao)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Sub-projeto não encontrado")
    return {"message": "Sub-projeto atualizado"}


@router.delete("/api/sub-projetos/{sub_id}", tags=["SubProjetos"])
async def delete_sub_projeto(sub_id: int, user=Depends(get_current_user_required)):
    """Remove um sub-projeto (os estabelecimentos ficam no projeto pai sem sub-projeto)."""
    _require_coordenacao(user)
    sucesso = sub_projeto_service.remover_sub_projeto(sub_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Sub-projeto não encontrado")
    return {"message": "Sub-projeto removido"}


@router.get("/api/sub-projetos/{sub_id}/estabelecimentos", tags=["SubProjetos"])
async def get_sub_projeto_estabelecimentos(sub_id: int, _user=Depends(get_current_user_required)):
    """Lista estabelecimentos de um sub-projeto."""
    return sub_projeto_service.listar_estabelecimentos_por_sub_projeto(sub_id)


@router.post("/api/sub-projetos/{sub_id}/estabelecimentos", tags=["SubProjetos"])
async def add_sub_projeto_estabelecimento(
    sub_id: int, data: SubProjetoEstabAssoc, user=Depends(get_current_user_required)
):
    """Associa um estabelecimento a um sub-projeto (e ao projeto pai)."""
    _require_coordenacao(user)
    projeto_id = sub_projeto_service.obter_projeto_id(sub_id)
    if projeto_id is None:
        raise HTTPException(status_code=404, detail="Sub-projeto não encontrado")
    sucesso = sub_projeto_service.associar_estabelecimento(projeto_id, sub_id, data.estabelecimento_id)
    if not sucesso:
        raise HTTPException(status_code=400, detail="Falha ao associar estabelecimento")
    return {"message": "Estabelecimento associado ao sub-projeto"}


@router.delete("/api/sub-projetos/{sub_id}/estabelecimentos/{estab_id}", tags=["SubProjetos"])
async def remove_sub_projeto_estabelecimento(
    sub_id: int, estab_id: int, user=Depends(get_current_user_required)
):
    """Remove a associação de um estabelecimento com um sub-projeto."""
    _require_coordenacao(user)
    sucesso = sub_projeto_service.desassociar_estabelecimento(sub_id, estab_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Associação não encontrada")
    return {"message": "Estabelecimento desassociado do sub-projeto"}

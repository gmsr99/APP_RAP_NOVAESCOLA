from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import equipment_service, aula_service

router = APIRouter()


class EquipamentoAtribuir(BaseModel):
    item_ids: list[int]


class ConflitosVerificar(BaseModel):
    item_ids: list[int]
    data_hora: str
    duracao_minutos: int
    excluir_aula_id: Optional[int] = None


class ItemCreate(BaseModel):
    categoria_id: int
    nome: str
    identificador: str
    estado: str = 'excelente'
    observacoes: Optional[str] = None


class ItemUpdate(BaseModel):
    nome: Optional[str] = None
    identificador: Optional[str] = None
    estado: Optional[str] = None
    observacoes: Optional[str] = None
    categoria_id: Optional[int] = None


class UtilizacaoCreate(BaseModel):
    user_id: str
    user_nome: Optional[str] = None
    aula_id: Optional[int] = None
    observacoes: Optional[str] = None


class LocalizacaoPayload(BaseModel):
    tipo: str  # 'estabelecimento' | 'mentor' | 'estudio'
    ref_id: Optional[str] = None
    nome: str


@router.get("/api/equipamento/categorias", tags=["Equipamento"])
async def get_categorias_equipamento(user=Depends(get_current_user_required)):
    """Lista categorias de equipamento com os seus itens."""
    return equipment_service.listar_categorias()


@router.get("/api/aulas/{aula_id}/equipamento", tags=["Equipamento"])
async def get_equipamento_sessao(aula_id: int, user=Depends(get_current_user_required)):
    """Lista itens de equipamento atribuídos a uma sessão."""
    return equipment_service.listar_equipamento_sessao(aula_id)


@router.put("/api/aulas/{aula_id}/equipamento", tags=["Equipamento"])
async def put_equipamento_sessao(aula_id: int, payload: EquipamentoAtribuir, user=Depends(get_current_user_required)):
    """Atribui itens de equipamento a uma sessão."""
    sucesso = equipment_service.atribuir_equipamento_sessao(aula_id, payload.item_ids)
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao atribuir equipamento")
    return {"message": "Equipamento atribuído"}


@router.post("/api/equipamento/verificar-conflitos", tags=["Equipamento"])
async def verificar_conflitos_equipamento(payload: ConflitosVerificar, user=Depends(get_current_user_required)):
    """Verifica conflitos temporais de equipamento."""
    conflitos = equipment_service.verificar_conflitos(
        payload.item_ids, payload.data_hora, payload.duracao_minutos, payload.excluir_aula_id
    )
    # Enviar notificacoes de conflito
    for c in conflitos:
        if 'item_nome' in c and 'item_identificador' in c:
            equipment_service.notificar_conflito(
                c['item_nome'], c['item_identificador'],
                f"Conflito com sessao #{c.get('aula_id', '?')}"
            )
    return {"conflitos": conflitos, "tem_conflitos": len(conflitos) > 0}


@router.get("/api/equipamento/itens", tags=["Equipamento"])
async def get_equipamento_itens(
    categoria_id: Optional[int] = None,
    estado: Optional[str] = None,
    user=Depends(get_current_user_required),
):
    """Lista todos os itens individuais de equipamento (localizacao/responsavel derivados de sessoes)."""
    return equipment_service.listar_itens(categoria_id, estado)


@router.get("/api/equipamento/stats", tags=["Equipamento"])
async def get_equipamento_stats(user=Depends(get_current_user_required)):
    """Estatisticas globais de equipamento."""
    return equipment_service.obter_stats()


@router.post("/api/equipamento/itens", tags=["Equipamento"])
async def post_equipamento_item(item: ItemCreate, user=Depends(get_current_user_required)):
    """Cria um novo item de equipamento individual."""
    resultado = equipment_service.criar_item(item.dict())
    if not resultado:
        raise HTTPException(status_code=500, detail="Erro ao criar item")
    return resultado


@router.put("/api/equipamento/itens/{item_id}", tags=["Equipamento"])
async def put_equipamento_item(item_id: int, item: ItemUpdate, user=Depends(get_current_user_required)):
    """Atualiza um item de equipamento."""
    dados = {k: v for k, v in item.dict().items() if v is not None}
    sucesso = equipment_service.atualizar_item(item_id, dados)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Item nao encontrado ou erro ao atualizar")
    return {"message": "Item atualizado"}


@router.delete("/api/equipamento/itens/{item_id}", tags=["Equipamento"])
async def delete_equipamento_item(item_id: int, user=Depends(get_current_user_required)):
    """Remove um item de equipamento."""
    sucesso = equipment_service.apagar_item(item_id)
    if not sucesso:
        raise HTTPException(status_code=404, detail="Item nao encontrado")
    return {"message": "Item removido"}


@router.post("/api/equipamento/itens/{item_id}/utilizacao", tags=["Equipamento"])
async def post_utilizacao(item_id: int, payload: UtilizacaoCreate, user=Depends(get_current_user_required)):
    """Regista utilizacao de um item."""
    sucesso = equipment_service.registar_utilizacao(
        item_id, payload.user_id, payload.user_nome, payload.aula_id, payload.observacoes
    )
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao registar utilizacao")
    return {"message": "Utilizacao registada"}


@router.get("/api/equipamento/itens/{item_id}/historico", tags=["Equipamento"])
async def get_historico_item(item_id: int, user=Depends(get_current_user_required)):
    """Lista historico de utilizacao de um item."""
    return equipment_service.listar_historico(item_id)


@router.get("/api/equipamento/itens/{item_id}/ocupacoes", tags=["Equipamento"])
async def get_ocupacoes_item(item_id: int, user=Depends(get_current_user_required)):
    """Lista sessoes futuras que usam este item."""
    return equipment_service.listar_ocupacoes_item(item_id)


@router.patch("/api/equipamento/itens/{item_id}/localizacao", tags=["Equipamento"])
async def patch_localizacao_item(item_id: int, payload: LocalizacaoPayload, user=Depends(get_current_user_required)):
    """Atualiza a localizacao manual de um item de equipamento."""
    if payload.tipo not in ('estabelecimento', 'mentor', 'estudio'):
        raise HTTPException(status_code=400, detail="Tipo de localização inválido. Usar: estabelecimento, mentor, estudio")
    ok = equipment_service.atualizar_localizacao(
        item_id, payload.tipo, payload.ref_id, payload.nome, user["sub"]
    )
    if not ok:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    return {"message": "Localização atualizada"}


@router.get("/api/equipamento/localizacoes", tags=["Equipamento"])
async def get_localizacoes_possiveis(user=Depends(get_current_user_required)):
    """Lista todas as localizacoes possiveis para equipamento (estabelecimentos, membros, estudio)."""
    return equipment_service.listar_localizacoes_possiveis()

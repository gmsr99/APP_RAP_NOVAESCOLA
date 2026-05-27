from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc
from services import honorario_service as _hon_svc
from services import profile_service

router = APIRouter()


class HonorarioRequest(BaseModel):
    projeto_id: int
    mes: int
    ano: int
    target_user_id: Optional[str] = None
    data_emissao: Optional[str] = None


class UserRateUpsert(BaseModel):
    valor_hora: float


class DadosFinanceirosUpdate(BaseModel):
    nif: Optional[str] = None
    morada: Optional[str] = None
    cod_postal: Optional[str] = None
    funcao: Optional[str] = None


@router.post("/api/honorarios/gerar", tags=["Financeiro"])
async def gerar_honorario(payload: HonorarioRequest, user=Depends(get_current_user_required)):
    """Gera nota de honorários em XLSX. Próprio utilizador ou coordenação para outro."""
    import datetime
    from fastapi.responses import Response as _Resp

    user_id = user.get("sub")
    target = payload.target_user_id or user_id
    if target != user_id:
        _require_coordenacao(user)

    data_emissao = payload.data_emissao or datetime.date.today().isoformat()
    try:
        xlsx_bytes = _hon_svc.gerar_honorario(user_id, target, payload.projeto_id, payload.mes, payload.ano, data_emissao)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    mes_str = str(payload.mes).zfill(2)
    filename = f"honorario_{mes_str}_{payload.ano}.xlsx"
    return _Resp(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/api/honorarios/preview", tags=["Financeiro"])
async def preview_honorario(
    projeto_id: int,
    mes: int,
    ano: int,
    target_user_id: Optional[str] = None,
    user=Depends(get_current_user_required),
):
    """Devolve JSON com grupos de sessões para pré-visualização sem gerar o XLSX."""
    user_id = user.get("sub")
    target = target_user_id or user_id
    if target != user_id:
        _require_coordenacao(user)
    try:
        return _hon_svc.obter_preview_honorario(target, projeto_id, mes, ano)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/honorarios/my-rate/{projeto_id}", tags=["Financeiro"])
async def get_my_rate(projeto_id: int, user=Depends(get_current_user_required)):
    """Devolve valor_hora do utilizador autenticado neste projeto."""
    return _hon_svc.obter_rate(user.get("sub"), projeto_id)


@router.put("/api/honorarios/rates/{projeto_id}/{target_user_id}", tags=["Financeiro"])
async def upsert_user_rate(projeto_id: int, target_user_id: str, payload: UserRateUpsert, user=Depends(get_current_user_required)):
    """Define/atualiza valor_hora de um utilizador num projeto (direção/root)."""
    _require_direcao(user)
    return _hon_svc.upsert_rate(target_user_id, projeto_id, payload.valor_hora)


@router.get("/api/honorarios/rates/{projeto_id}", tags=["Financeiro"])
async def get_rates_projeto(projeto_id: int, user=Depends(get_current_user_required)):
    """Lista rates de todos os utilizadores num projeto (direção/root)."""
    _require_direcao(user)
    return _hon_svc.listar_rates_projeto(projeto_id)


@router.patch("/api/profile/financeiro", tags=["Financeiro"])
async def update_dados_financeiros(payload: DadosFinanceirosUpdate, user=Depends(get_current_user_required)):
    """Atualiza dados financeiros pessoais do utilizador autenticado."""
    sucesso = profile_service.atualizar_dados_financeiros(
        user.get("sub"), payload.nif, payload.morada, payload.cod_postal, payload.funcao
    )
    if not sucesso:
        raise HTTPException(status_code=500, detail="Erro ao guardar dados financeiros.")
    return {"ok": True}

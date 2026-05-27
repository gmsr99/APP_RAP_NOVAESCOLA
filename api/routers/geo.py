import httpx
from fastapi import APIRouter, Depends, HTTPException
from typing import Any, List, Optional
from pydantic import BaseModel, Field
from auth import get_current_user_required, get_current_user_optional
from api.deps import _require_admin, _require_direcao, _require_coordenacao, _require_root_or_role, _require_action
from services import permission_service as _perm_svc

router = APIRouter()


@router.get("/api/geocode/search", tags=["Geocoding"])
async def geocode_search(q: str, user=Depends(get_current_user_required)):
    """Proxy para Nominatim — pesquisa de moradas (Portugal)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": q, "format": "json", "limit": 5, "countrycodes": "pt"},
            headers={"User-Agent": "RAPNovaEscola/1.0 (rap-nova-escola@edu.pt)"},
        )
        return resp.json()


@router.get("/api/distance", tags=["Geocoding"])
async def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float, user=Depends(get_current_user_required)):
    """Calcula distância de condução via OSRM (km)."""
    url = f"https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=false"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        data = resp.json()
        if data.get("routes"):
            distance_km = round(data["routes"][0]["distance"] / 1000, 1)
            return {"distance_km": distance_km}
        return {"distance_km": None, "error": "Rota não encontrada"}

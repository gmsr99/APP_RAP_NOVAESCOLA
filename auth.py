"""
Validação opcional do JWT do Supabase para identificar o user nas rotas.
Se SUPABASE_JWT_SECRET não estiver definido, as rotas protegidas não exigem auth.
"""
import os
from typing import Optional

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

load_dotenv()

JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
HTTP_BEARER = HTTPBearer(auto_error=False)


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTP_BEARER),
) -> Optional[dict]:
    """
    Extrai e valida o JWT do Supabase. Retorna o payload (sub, email, user_metadata, etc.)
    se o token for válido; caso contrário retorna None (não falha o request).
    """
    if not JWT_SECRET:
        return None
    if not credentials or not credentials.credentials:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials,
            JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.InvalidTokenError:
        return None


def get_current_user_required(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTP_BEARER),
) -> dict:
    """
    Exige um JWT válido. Retorna 401 se não houver token ou for inválido.
    """
    user = get_current_user_optional(credentials)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado. Envia o token no header Authorization.",
        )
    return user

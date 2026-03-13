from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.auth import verify_credentials, create_access_token, get_current_user
from fastapi import Depends

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'


@router.post('/login', response_model=TokenResponse)
def login(req: LoginRequest):
    if not verify_credentials(req.username, req.password):
        raise HTTPException(status_code=401, detail='Ongeldige inloggegevens')
    token = create_access_token(req.username)
    return TokenResponse(access_token=token)


@router.get('/me')
def me(user=Depends(get_current_user)):
    return user

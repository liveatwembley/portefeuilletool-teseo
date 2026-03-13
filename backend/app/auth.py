import os
import hashlib
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

SECRET_KEY = os.environ.get('JWT_SECRET', 'teseo-dev-secret-change-in-prod')
ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 uur

security = HTTPBearer()


def _get_users():
    users_str = os.environ.get('APP_USERS', '')
    users = {}
    if users_str:
        for pair in users_str.split(','):
            parts = pair.strip().split(':')
            if len(parts) == 2:
                users[parts[0]] = parts[1]
    return users


def verify_credentials(username, password):
    users = _get_users()
    username_hash = hashlib.sha256(username.encode()).hexdigest()
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    return users.get(username_hash) == password_hash


def create_access_token(username):
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        'sub': hashlib.sha256(username.encode()).hexdigest(),
        'exp': expire,
        'username': username,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get('username')
        if username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Ongeldige token')
        return {'username': username, 'sub': payload.get('sub')}
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Ongeldige of verlopen token')

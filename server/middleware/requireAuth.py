import os

from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from typing_extensions import Annotated

from config.database import user_collection

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/authenticate"
)

def require_auth(
    token: Annotated[str, Depends(oauth2_scheme)],
) -> str:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Your session is invalid or expired. Please sign in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            os.getenv("SECRET_KEY"),
            algorithms=[os.getenv("ALGORITHM")],
        )
    except JWTError:
        raise credentials_error

    user_id = payload.get("sub")

    if not isinstance(user_id, str) or not ObjectId.is_valid(user_id):
        raise credentials_error

    user = user_collection.find_one(
        {"_id": ObjectId(user_id)},
        {"is_disabled": 1},
    )

    if not user:
        raise credentials_error

    if user.get("is_disabled", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been disabled. Please contact support.",
        )

    return user_id
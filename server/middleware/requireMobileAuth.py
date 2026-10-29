import os

from dotenv import dotenv_values
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

config_dotenv = dotenv_values()

mobile_bearer = HTTPBearer(auto_error=False)


def _credentials_exception():
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate mobile credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def decode_mobile_token(token: str) -> dict:
    try:
        payload = jwt.decode(
            token,
            os.getenv("SECRET_KEY"),
            algorithms=[os.getenv("ALGORITHM")],
            audience="mobile",
        )
    except JWTError as error:
        raise _credentials_exception() from error

    if (
        payload.get("typ") != "mobile_access"
        or not isinstance(payload.get("sub"), str)
        or not payload.get("sub")
    ):
        raise _credentials_exception()
    return payload


async def require_mobile_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(mobile_bearer),
) -> dict:
    if credentials is None:
        raise _credentials_exception()
    return decode_mobile_token(credentials.credentials)


async def optional_mobile_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(mobile_bearer),
) -> dict | None:
    if credentials is None:
        return None
    return decode_mobile_token(credentials.credentials)

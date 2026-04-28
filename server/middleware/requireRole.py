from fastapi import Depends, HTTPException, status
from typing import List
from bson import ObjectId

from middleware.requireAuth import require_auth
from config.database import user_collection

def require_role(allowed_roles: List[str]):
    async def role_checker(user_id: str = Depends(require_auth)):
        user = user_collection.find_one({"_id": ObjectId(user_id)})

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
            )
        
        if user.get("user_type") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized",
            )
        
        #for region/org/scope checking here if PL told us

        return user 
    
    return role_checker

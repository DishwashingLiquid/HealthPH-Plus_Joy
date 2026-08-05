from typing_extensions import Annotated

import pymongo
import re
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.responses import JSONResponse

from config.database import role_label_collection, user_collection
from helpers.miscHelpers import get_ph_datetime
from helpers.roleLabelHelpers import (
    ensure_default_role_labels,
    normalize_role_label_name,
)
from middleware.requireAuth import require_auth
from middleware.requireRole import require_role
from models.roleLabel import RoleLabelRequest
from schema.roleLabelSchema import individual_role_label, list_role_labels


def validate_role_label_payload(data: RoleLabelRequest):
    errors = []

    name = normalize_role_label_name(data.name)
    description = data.description.strip() if data.description else ""
    is_active = data.is_active if data.is_active is not None else True

    if not name:
        errors.append({"field": "name", "error": "Must enter role label"})

    return {
        "errors": errors,
        "payload": {
            "name": name,
            "description": description,
            "is_active": is_active,
        },
    }


async def fetch_role_labels(user_id: Annotated[str, Depends(require_auth)]):
    ensure_default_role_labels()

    role_labels = role_label_collection.find().sort([("name", pymongo.ASCENDING)])

    return list_role_labels(role_labels)


async def create_role_label(
    data: RoleLabelRequest,
    current_user: Annotated[dict, Depends(require_role(["SUPERADMIN"]))],
):
    validation = validate_role_label_payload(data)

    if validation["errors"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation["errors"],
        )

    payload = validation["payload"]

    duplicate = role_label_collection.find_one(
        {"name": {"$regex": f"^{re.escape(payload['name'])}$", "$options": "i"}}
    )

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=[{"field": "name", "error": "Role label already exists"}],
        )

    payload.update(
        {
            "is_system": False,
            "created_by": str(current_user["_id"]),
            "created_at": get_ph_datetime(),
            "updated_at": get_ph_datetime(),
        }
    )

    new_role_label = role_label_collection.insert_one(payload)

    if not new_role_label:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create role label",
        )

    role_label = role_label_collection.find_one({"_id": new_role_label.inserted_id})

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": "Role label created successfully",
            "role_label": individual_role_label(role_label),
        },
    )


async def update_role_label(
    id: str,
    data: RoleLabelRequest,
    current_user: Annotated[dict, Depends(require_role(["SUPERADMIN"]))],
):
    if not id or not ObjectId.is_valid(id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role label ID",
        )

    validation = validate_role_label_payload(data)

    if validation["errors"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation["errors"],
        )

    payload = validation["payload"]

    duplicate = role_label_collection.find_one(
        {
            "_id": {"$ne": ObjectId(id)},
            "name": {"$regex": f"^{re.escape(payload['name'])}$", "$options": "i"},
        }
    )

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=[{"field": "name", "error": "Role label already exists"}],
        )

    role_label = role_label_collection.find_one({"_id": ObjectId(id)})

    if not role_label:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role label does not exist",
        )

    connected_accounts = user_collection.count_documents(
        {
            "role_label": {
                "$regex": f"^{re.escape(role_label.get('name', ''))}$",
                "$options": "i",
            }
        }
    )

    if connected_accounts > 0 and role_label.get("name") != payload["name"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=[
                {
                    "field": "name",
                    "error": "Cannot rename a role label with connected accounts",
                }
            ],
        )

    payload.update({"updated_at": get_ph_datetime()})

    updated_role_label = role_label_collection.find_one_and_update(
        {"_id": ObjectId(id)},
        {"$set": payload},
        return_document=pymongo.ReturnDocument.AFTER,
    )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "Role label updated successfully",
            "role_label": individual_role_label(updated_role_label),
        },
    )


async def delete_role_label(
    id: str,
    current_user: Annotated[dict, Depends(require_role(["SUPERADMIN"]))],
):
    if not id or not ObjectId.is_valid(id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role label ID",
        )

    role_label = role_label_collection.find_one({"_id": ObjectId(id)})

    if not role_label:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role label does not exist",
        )

    connected_accounts = user_collection.count_documents(
        {
            "role_label": {
                "$regex": f"^{re.escape(role_label.get('name', ''))}$",
                "$options": "i",
            }
        }
    )

    if connected_accounts > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=[
                {
                    "field": "role_label",
                    "error": f"Cannot delete role label with {connected_accounts} connected account(s).",
                }
            ],
        )

    deleted_role_label = role_label_collection.delete_one({"_id": ObjectId(id)})

    if deleted_role_label.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to delete role label",
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "Role label deleted successfully"},
    )

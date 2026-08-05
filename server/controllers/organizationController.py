from typing_extensions import Annotated

import re

import pymongo
from bson import ObjectId
from fastapi import Depends, HTTPException, status
from fastapi.responses import JSONResponse

from config.database import organization_collection, user_collection
from helpers.miscHelpers import get_ph_datetime
from middleware.requireRole import require_role
from models.organization import OrganizationRequest
from schema.organizationSchema import individual_organization, list_organizations


VALID_REGIONS = [
    "NCR",
    "I",
    "II",
    "III",
    "CAR",
    "IVA",
    "IVB",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "BARMM",
    "ALL",
]

def validate_organization_payload(data: OrganizationRequest):
    errors = []

    name = data.name.strip() if data.name else ""
    description = data.description.strip() if data.description else ""
    main_region = data.main_region.strip() if data.main_region else ""
    region_coverage = data.region_coverage.strip() if data.region_coverage else ""
    partnership_status = (
        data.partnership_status.strip().upper()
        if data.partnership_status
        else "ACTIVE"
    )

    if not name:
        errors.append({"field": "name", "error": "Must enter organization name"})

    if not main_region:
        errors.append({"field": "main_region", "error": "Must choose main region"})

    if not region_coverage:
        errors.append({"field": "region_coverage", "error": "Must choose at least one covered region"})

    if main_region and main_region not in VALID_REGIONS:
        errors.append({"field": "main_region", "error": "Invalid selected region"})

    coverage_values = [
        region.strip()
        for region in region_coverage.split(",")
        if region.strip()
    ]

    invalid_coverage = [
        region for region in coverage_values if region not in VALID_REGIONS
    ]

    if invalid_coverage:
        errors.append({"field": "region_coverage", "error": "Invalid selected coverage region"})

    if partnership_status not in ["ACTIVE", "INACTIVE"]:
        errors.append({"field": "partnership_status", "error": "Invalid partnership status"})

    return {
        "errors": errors,
        "payload": {
            "name": name,
            "description": description,
            "main_region": main_region,
            "region_coverage": ",".join(coverage_values),
            "partnership_status": partnership_status,
        },
    }

async def fetch_organizations(
    current_user: Annotated[dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))]
):
    organizations = organization_collection.find().sort([("name", pymongo.ASCENDING)])

    return list_organizations(organizations)

async def create_organization(
    data: OrganizationRequest,
    current_user: Annotated[dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))]
):
    validation = validate_organization_payload(data)

    if validation["errors"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation["errors"],
        )

    payload = validation["payload"]

    existing_organization = organization_collection.find_one({
        "name": {"$regex": f"^{re.escape(payload['name'])}$", "$options": "i"}
    })

    if existing_organization:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=[{
                "field": "name",
                "error": "Organization already exists",
            }],
        )

    payload.update({
        "created_by": str(current_user["_id"]),
        "created_at": get_ph_datetime(),
        "updated_at": get_ph_datetime(),
    })

    new_organization = organization_collection.insert_one(payload)

    if not new_organization:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create organization",
        )

    organization = organization_collection.find_one({"_id": new_organization.inserted_id})

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "message": "Organization created successfully",
            "organization": individual_organization(organization),
        },
    )

async def update_organization(
    id: str,
    data: OrganizationRequest,
    current_user: Annotated[dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))]
):
    if not id or not ObjectId.is_valid(id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization ID",
        )

    validation = validate_organization_payload(data)

    if validation["errors"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation["errors"],
        )

    payload = validation["payload"]

    duplicate = organization_collection.find_one({
        "_id": {"$ne": ObjectId(id)},
        "name": {"$regex": f"^{re.escape(payload['name'])}$", "$options": "i"},
    })

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=[{"field": "name", "error": "Organization already exists"}],
        )

    payload.update({"updated_at": get_ph_datetime()})

    updated_organization = organization_collection.find_one_and_update(
        {"_id": ObjectId(id)},
        {"$set": payload},
        return_document=pymongo.ReturnDocument.AFTER,
    )

    if not updated_organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization does not exist",
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "Organization updated successfully",
            "organization": individual_organization(updated_organization),
        },
    )

async def delete_organization(
    id: str,
    current_user: Annotated[dict, Depends(require_role(["ADMIN", "SUPERADMIN"]))]
):
    if not id or not ObjectId.is_valid(id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization ID",
        )

    organization = organization_collection.find_one({"_id": ObjectId(id)})

    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization does not exist",
        )

    organization_name = organization.get("name", "")

    connected_accounts = user_collection.count_documents({
        "organization": {
            "$regex": f"^{re.escape(organization_name)}$",
            "$options": "i",
        }
    })

    if connected_accounts > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=[{
                "field": "organization",
                "error": f"Cannot delete organization with {connected_accounts} connected account(s).",
            }],
        )

    deleted_organization = organization_collection.delete_one({"_id": ObjectId(id)})

    if deleted_organization.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to delete organization",
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "Organization deleted successfully"},
    )
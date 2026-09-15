from fastapi import APIRouter

from controllers.organizationController import (
    create_organization,
    delete_organization,
    fetch_organizations,
    update_organization,
)

router = APIRouter()

router.add_api_route("", methods=["GET"], endpoint=fetch_organizations)
router.add_api_route("", methods=["POST"], endpoint=create_organization)
router.add_api_route("/{id}", methods=["PUT"], endpoint=update_organization)
router.add_api_route("/{id}", methods=["DELETE"], endpoint=delete_organization)
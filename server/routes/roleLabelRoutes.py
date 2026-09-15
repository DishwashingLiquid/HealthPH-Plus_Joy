from fastapi import APIRouter

from controllers.roleLabelController import (
    create_role_label,
    delete_role_label,
    fetch_role_labels,
    update_role_label,
)


router = APIRouter()

router.add_api_route("", methods=["GET"], endpoint=fetch_role_labels)
router.add_api_route("", methods=["POST"], endpoint=create_role_label)
router.add_api_route("/{id}", methods=["PUT"], endpoint=update_role_label)
router.add_api_route("/{id}", methods=["DELETE"], endpoint=delete_role_label)

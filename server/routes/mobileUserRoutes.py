from fastapi import APIRouter

from controllers.mobileUserController import (
    login_mobile_user,
    register_mobile_user,
    update_mobile_user_pin,
    verify_mobile_user_pin,
)

mobile_users_router = APIRouter()

mobile_users_router.add_api_route("/users", methods=["POST"], endpoint=register_mobile_user)
mobile_users_router.add_api_route("/users/login", methods=["POST"], endpoint=login_mobile_user)
mobile_users_router.add_api_route("/users/{user_id}/pin", methods=["PATCH"], endpoint=update_mobile_user_pin)
mobile_users_router.add_api_route("/users/{user_id}/pin/verify", methods=["POST"], endpoint=verify_mobile_user_pin)

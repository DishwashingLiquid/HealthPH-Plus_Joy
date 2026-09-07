from fastapi import APIRouter

from controllers.mobileUserController import login_mobile_user, register_mobile_user

mobile_users_router = APIRouter()

mobile_users_router.add_api_route("/users", methods=["POST"], endpoint=register_mobile_user)
mobile_users_router.add_api_route("/users/login", methods=["POST"], endpoint=login_mobile_user)

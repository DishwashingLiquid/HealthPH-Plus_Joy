"""Public activation endpoints and protected invitation resend for web accounts."""
from typing import Annotated

from bson import ObjectId
from fastapi import Depends, HTTPException

from config.database import user_collection
from helpers.accountInvitationHelpers import (
    activate_invited_account, invalid_invitation, invitation_query, send_account_invitation,
)
from middleware.requireRole import require_role
from models.auth import ActivateAccountRequest, AccountInvitationToken


def verify_account_invitation(data: AccountInvitationToken):
    if not user_collection.find_one(invitation_query(data.token), {"_id": 1}):
        raise invalid_invitation()
    return {"message": "Invitation is valid. Set your password to activate your account."}


def activate_account(data: ActivateAccountRequest):
    activate_invited_account(user_collection, data.token, data.password, data.re_password)
    return {"message": "Your account is activated. You can now sign in."}


def resend_account_invitation(
    id: str,
    current_user: Annotated[dict, Depends(require_role(["Admin", "SUPERADMIN"]))],
):
    if not ObjectId.is_valid(id):
        raise HTTPException(status_code=400, detail="Invalid account ID.")
    user = user_collection.find_one({"_id": ObjectId(id)})
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")
    if current_user.get("user_type") != "SUPERADMIN" and (
        user.get("user_type") == "SUPERADMIN" or user.get("role_label") == "Admin"
    ):
        raise HTTPException(status_code=403, detail="Only superadmins can resend administrator invitations.")
    if not user.get("activation_pending"):
        raise HTTPException(status_code=400, detail="This account is already activated.")
    if user.get("is_disabled"):
        raise HTTPException(status_code=400, detail="Enable this account before resending its invitation.")
    try:
        sent = send_account_invitation(user_collection, user)
    except ValueError:
        raise HTTPException(status_code=503, detail="Invitation delivery is not configured. Ask your administrator to check the dashboard URL and invitation settings.")
    if not sent:
        raise HTTPException(status_code=503, detail="The invitation could not be sent. The account remains pending. Please try again in one minute.")
    return {"message": "Invitation sent. Earlier invitation links no longer work."}

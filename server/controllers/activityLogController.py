from fastapi import HTTPException, status, Depends, Request
from fastapi.responses import JSONResponse
from bson import ObjectId
import pymongo
from typing_extensions import Annotated
from datetime import datetime, timedelta
import re

from config.database import activity_logs_collection, role_label_collection, user_collection
from helpers.roleLabelHelpers import ensure_default_role_labels
from models.activityLogs import ActivityLog
from schema.activityLogSchema import list_activity_logs
from helpers.miscHelpers import get_ph_datetime
from middleware.requireAuth import require_auth

def get_client_ip(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")

    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    
    if request.client:
        return request.client.host
    
    return ""

def build_last_7_days_activity():
    today = get_ph_datetime().replace(hour=0, minute=0, second=0, microsecond=0)

    days = []

    for index in range(7):
        date = today - timedelta(days=6 - index)

        days.append({
            "key": date.strftime("%Y-%m-%d"),
            "day": date.strftime("%a"),
            "actions": 0,
        })

    return days


def get_activity_day_key(created_at):
    if not created_at:
        return ""

    if isinstance(created_at, datetime):
        return created_at.strftime("%Y-%m-%d")

    if isinstance(created_at, str):
        try:
            parsed_date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            return parsed_date.strftime("%Y-%m-%d")
        except ValueError:
            return ""

    return ""

"""
@desc     Fetch all activity logs
route     GET api/activity_logs
@access   Private
"""


async def fetch_activity_logs(user_id: Annotated[str, Depends(require_auth)]):
    user_data = user_collection.find_one({"_id": ObjectId(user_id)})

    activity_logs = []

    if user_data.get("role_label") == "Admin":
        # Fetch activity logs from Activity Logs table joined with Users table
        organization = user_data.get("organization", "")

        same_organization_users = user_collection.find(
            {
                "user_type": "USER",
                "organization": {
                    "$regex": f"^{re.escape(organization)}$",
                    "$options": "i",
                },
            },
            {"_id": 1},
        )

        same_organization_user_ids = [
            str(account["_id"]) for account in same_organization_users
        ]

        data = activity_logs_collection.aggregate(
            [
                {"$match": {"user_id": {"$in" : same_organization_user_ids}}},
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "user_id",
                        "foreignField": "_id",
                        "as": "user_data",
                    }
                },
                {"$sort": {"created_at": pymongo.DESCENDING}},
            ]
        )

    elif user_data["user_type"] == "SUPERADMIN":
        # Fetch activity logs from Activity Logs table joined with Users table
        data = activity_logs_collection.aggregate(
            [
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "user_id",
                        "foreignField": "_id",
                        "as": "user_data",
                    }
                },
                {"$sort": {"created_at": pymongo.DESCENDING}},
            ]
        )

    else:
        data = activity_logs_collection.aggregate(
            [
                {"$match": {"user_id": user_id}},
                {
                    "$lookup": {
                        "from": "users",
                        "localField": "user_id",
                        "foreignField": "_id",
                        "as": "user_data",
                    }
                },
                {"$sort": {"created_at": pymongo.DESCENDING}},
            ]
        )

    # Convert data to list of JSON objects
    activity_logs = list_activity_logs(data)

    return activity_logs

async def fetch_account_analytics(user_id: Annotated[str, Depends(require_auth)]):
    user_data = user_collection.find_one({"_id": ObjectId(user_id)})

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not Authorized",
        )

    activity_by_day = build_last_7_days_activity()
    activity_by_day_map = {day["key"]: day for day in activity_by_day}

    start_date = get_ph_datetime().replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    ) - timedelta(days=6)

    user_activity_logs = activity_logs_collection.find({
        "created_at": {"$gte": start_date},
    })

    for log in user_activity_logs:
        key = get_activity_day_key(log.get("created_at"))

        if key in activity_by_day_map:
            activity_by_day_map[key]["actions"] += 1

    ensure_default_role_labels()

    role_definitions = [
        role_label["name"]
        for role_label in role_label_collection.find(
            {"is_active": {"$ne": False}}
        ).sort([("name", pymongo.ASCENDING)])
    ]

    role_region_map = {}

    user_accounts = list(user_collection.find({"user_type": "USER"}))
    total_user_accounts = len(user_accounts)

    for account in user_accounts:
        region = account.get("region", "") or "Unassigned"
        role_label = account.get("role_label", "") or "Viewer"

        if region not in role_region_map:
            role_region_map[region] = {"region": region}

            for role in role_definitions:
                role_region_map[region][role] = 0

        if role_label in role_region_map[region]:
            role_region_map[region][role_label] += 1

    recent_activity = []
    show_recent_activity = (
        user_data.get("user_type") == "SUPERADMIN"
        or user_data.get("role_label") == "Admin"
    )

    if user_data.get("user_type") == "SUPERADMIN":
        recent_cursor = activity_logs_collection.find().sort(
            [("created_at", pymongo.DESCENDING)]
        ).limit(20)

        recent_activity = list_activity_logs(recent_cursor)

    elif user_data.get("role_label") == "Admin":
        organization = user_data.get("organization", "")

        same_organization_users = user_collection.find(
            {
                "user_type": "USER",
                "organization": {
                    "$regex": f"^{re.escape(organization)}$",
                    "$options": "i",
                },
            },
            {"_id": 1},
        )

        same_organization_user_ids = [
            str(account["_id"]) for account in same_organization_users
        ]

        recent_cursor = activity_logs_collection.find({
            "user_id": {"$in": same_organization_user_ids}
        }).sort([("created_at", pymongo.DESCENDING)]).limit(20)

        recent_activity = list_activity_logs(recent_cursor)

    return {
        "activity_by_day": activity_by_day,
        "total_user_accounts": total_user_accounts,
        "role_region_distribution": list(role_region_map.values()),
        "recent_activity": recent_activity,
        "show_recent_activity": show_recent_activity,
    }


"""
@desc     Create a single activity log
route     POST api/activity_logs
@access   Private
"""


async def create_activity_log(data: ActivityLog, request: Request):
    # Create a copy of request data
    to_encode = dict(data).copy()

    # Check if id is valid object ID
    if not ObjectId.is_valid(to_encode["user_id"]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Error creating activity log...",
        )

    # Check if user exists in database
    user_data = user_collection.find_one({"_id": ObjectId(to_encode["user_id"])})

    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating activity log...",
        )

    # Update request data
    to_encode.update(
        {
            "user_name": f"{user_data['first_name']} {user_data['last_name']}",
            "user_type": user_data["user_type"],
            "role_label": user_data.get("role_label", ""),
            "ip_address": get_client_ip(request),
            "created_at": get_ph_datetime(),
        }
    )

    # Create new activity log
    new_activity_log = activity_logs_collection.insert_one(dict(to_encode))

    if not new_activity_log:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating activity log...",
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "Activity log created successfully"},
    )


async def delete_all_activity_logs():
    # Delete all activity logs
    deleted = activity_logs_collection.delete_many({})

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error deleting activity logs...",
        )

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "All activity logs deleted successfully"},
    )

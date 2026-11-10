"""Website-only discussions. All writes are confined to health_literacy_comments."""
import base64
import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel, ConfigDict, Field, field_validator

from middleware.requireRole import require_role
from models.mobileUser import MobileLoginRequest, MOBILE_REGISTRATION_SOURCE, MOBILE_ROLE_ID

router = APIRouter(prefix="/comments", tags=["Website health literacy comments"])
bearer = HTTPBearer(auto_error=False)
moderator = require_role(["Admin", "SUPERADMIN"])
# Immutable bundled article IDs, deliberately independent of titles and slugs.
STATIC_ARTICLE_IDS = frozenset({"1", "2", "3", "4", "5", "6", "7", "8", "9", "15", "16", "17", "18"})


def database():
    from config.database import db
    return db


def comments():
    return database()["health_literacy_comments"]


def now():
    return datetime.now(timezone.utc)


class Resource(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contentId: str = Field(min_length=1, max_length=100)
    contentType: Literal["articles", "videos", "infographics"]
    contentOrigin: Literal["api", "static"]


class NewComment(Resource):
    body: str = Field(min_length=1, max_length=2000)

    @field_validator("body")
    @classmethod
    def plain_text(cls, value):
        value = value.strip()
        if not value or any(ord(c) < 32 and c not in "\n\t" for c in value):
            raise ValueError("Write a comment using plain text")
        return value


class Moderation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Literal["approved", "hidden", "deleted"]


def resource_query(resource):
    return {key: getattr(resource, key) for key in ("contentId", "contentType", "contentOrigin")}


def require_published(resource):
    if resource.contentOrigin == "static":
        valid = resource.contentType == "articles" and resource.contentId in STATIC_ARTICLE_IDS
    else:
        from controllers.health_literacy_hub.content_bridge import get_published_website_match
        query = {**get_published_website_match(resource.contentType), "id": resource.contentId}
        valid = database().content.find_one(query) is not None
    if not valid:
        raise HTTPException(404, "Published content not found")


def rate_limit(key, limit, seconds=60):
    """Atomic fixed windows shared across workers, TTL records in the same collection."""
    bucket = int(now().timestamp()) // seconds
    digest = hashlib.sha256(key.encode()).hexdigest()
    document = comments().find_one_and_update(
        {"_id": f"rate:{digest}:{seconds}:{bucket}"},
        {"$inc": {"count": 1}, "$setOnInsert": {"recordType": "rate",
         "expiresAt": now() + timedelta(seconds=seconds * 2)}}, upsert=True, return_document=True)
    if document["count"] > limit:
        raise HTTPException(429, "Too many attempts. Please try again shortly.", headers={"Retry-After": str(seconds)})


def resolve_account(subject):
    return database().mobile_users.find_one({"id": subject,
        "source": MOBILE_REGISTRATION_SOURCE, "roleId": MOBILE_ROLE_ID})


def unauthorized():
    return HTTPException(401, "Your comment session expired. Sign in again; your draft is saved.")


def require_commenter(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if not credentials:
        raise unauthorized()
    try:
        claims = jwt.decode(credentials.credentials, os.getenv("SECRET_KEY"),
            algorithms=[os.getenv("ALGORITHM")], audience="health_literacy_comments",
            options={"require_exp": True, "require_sub": True, "require_aud": True, "require_iat": True})
        if (claims.get("typ") != "public_comment_access" or not isinstance(claims.get("sub"), str)
                or not claims["sub"]):
            raise unauthorized()
    except (JWTError, ValueError, TypeError) as error:
        raise unauthorized() from error
    account = resolve_account(claims["sub"])
    if not account:
        raise unauthorized()
    return account


@router.post("/session")
def login(payload: MobileLoginRequest, request: Request, response: Response):
    # Reuse canonical verification and eligibility without invoking optional hash migration.
    from controllers.mobileUserController import _stored_password_hash, _verify_password
    rate_limit(f"login:{request.client.host if request.client else 'unknown'}", 10, 600)
    account = database().mobile_users.find_one({"email": payload.email,
        "source": MOBILE_REGISTRATION_SOURCE, "roleId": MOBILE_ROLE_ID})
    if (not account or not isinstance(account.get("id"), str) or not account["id"]
            or not _verify_password(payload.password, _stored_password_hash(account))):
        raise HTTPException(401, "Invalid email or password")
    issued = now()
    token = jwt.encode({"sub": account["id"], "aud": "health_literacy_comments",
        "typ": "public_comment_access", "iat": issued, "exp": issued + timedelta(hours=1)},
        os.getenv("SECRET_KEY"), algorithm=os.getenv("ALGORITHM"))
    response.headers["Cache-Control"] = "no-store"
    return {"access_token": token, "expires_in": 3600, "userId": account["id"]}


def public_comment(document, own=False):
    account = resolve_account(document["userId"])
    result = {"id": str(document["_id"]), "body": document["body"],
        "author": "Community member" if account else "Removed account",
        "createdAt": document["createdAt"].replace(tzinfo=timezone.utc).isoformat()}
    if own:
        result["status"] = document["status"]
    return result


def cursor_query(cursor):
    if not cursor:
        return {}
    try:
        stamp, identifier = json.loads(base64.urlsafe_b64decode(cursor.encode()))
        date = datetime.fromisoformat(stamp)
        oid = ObjectId(identifier)
    except (ValueError, TypeError, json.JSONDecodeError) as error:
        raise HTTPException(400, "Invalid comment cursor") from error
    return {"$or": [{"createdAt": {"$lt": date}}, {"createdAt": date, "_id": {"$lt": oid}}]}


def page(query, cursor, limit, own=False, admin=False):
    documents = list(comments().find({**query, **cursor_query(cursor)}).sort(
        [("createdAt", -1), ("_id", -1)]).limit(limit + 1))
    more = len(documents) > limit
    documents = documents[:limit]
    items = []
    for doc in documents:
        item = public_comment(doc, own=own or admin)
        if admin or own:
            item.update({key: doc[key] for key in ("contentId", "contentType", "contentOrigin")})
        if admin:
            item["reportCount"] = comments().count_documents({"recordType": "report", "commentId": str(doc["_id"])})
        items.append(item)
    next_cursor = None
    if more:
        last = documents[-1]
        next_cursor = base64.urlsafe_b64encode(json.dumps([
            last["createdAt"].isoformat(), str(last["_id"])]).encode()).decode()
    return {"items": items, "nextCursor": next_cursor}


@router.get("")
def read(response: Response, contentId: str = Query(min_length=1, max_length=100),
         contentType: Literal["articles", "videos", "infographics"] = "articles",
         contentOrigin: Literal["api", "static"] = "api", cursor: str | None = Query(None, max_length=500),
         limit: int = Query(20, ge=1, le=50)):
    resource = Resource(contentId=contentId, contentType=contentType, contentOrigin=contentOrigin)
    require_published(resource)
    response.headers["Cache-Control"] = "no-store"
    return page({**resource_query(resource), "recordType": "comment", "status": "approved"}, cursor, limit)


@router.get("/mine")
def mine(response: Response, contentId: str = Query(min_length=1, max_length=100),
         contentType: Literal["articles", "videos", "infographics"] = "articles",
         contentOrigin: Literal["api", "static"] = "api", account=Depends(require_commenter), cursor: str | None = Query(None, max_length=500),
         limit: int = Query(20, ge=1, le=50)):
    response.headers["Cache-Control"] = "no-store"
    resource = Resource(contentId=contentId, contentType=contentType, contentOrigin=contentOrigin)
    return page({**resource_query(resource), "recordType": "comment", "userId": account["id"],
                 "status": {"$ne": "deleted"}}, cursor, limit, own=True)


@router.post("", status_code=201)
def create(payload: NewComment, account=Depends(require_commenter)):
    require_published(payload)
    rate_limit(f"post:{account['id']}", 5)
    stamp = now()
    document = {**resource_query(payload), "recordType": "comment", "userId": account["id"],
        "body": payload.body, "parentId": None, "status": "pending", "createdAt": stamp, "updatedAt": stamp}
    document["_id"] = comments().insert_one(document).inserted_id
    return public_comment(document, own=True)


def find_comment(identifier):
    if not ObjectId.is_valid(identifier):
        raise HTTPException(404, "Comment not found")
    document = comments().find_one({"_id": ObjectId(identifier), "recordType": "comment"})
    if not document:
        raise HTTPException(404, "Comment not found")
    return document


@router.delete("/{identifier}")
def delete(identifier: str, account=Depends(require_commenter)):
    document = find_comment(identifier)
    if document["userId"] != account["id"]:
        raise HTTPException(403, "You can only delete your own comments")
    # Owners can remove their comments even after content is unpublished.
    comments().update_one({"_id": document["_id"]}, {"$set": {"status": "deleted", "body": "", "updatedAt": now()}})
    return {"status": "deleted"}


@router.post("/{identifier}/report")
def report(identifier: str, account=Depends(require_commenter)):
    document = find_comment(identifier)
    require_published(Resource(**{k: document[k] for k in ("contentId", "contentType", "contentOrigin")}))
    if document["status"] != "approved":
        raise HTTPException(404, "Comment not found")
    rate_limit(f"report:{account['id']}", 10)
    # One bounded record per reporter/comment, no growing arrays or user profile copies.
    comments().update_one({"_id": f"report:{identifier}:{account['id']}"}, {"$setOnInsert": {
        "recordType": "report", "commentId": identifier, "userId": account["id"], "createdAt": now()}}, upsert=True)
    return {"status": "reported"}


@router.get("/moderation/queue")
def queue(response: Response, current_user=Depends(moderator),
          status: Literal["pending", "approved", "hidden"] = "pending",
          cursor: str | None = Query(None, max_length=500), limit: int = Query(20, ge=1, le=50)):
    response.headers["Cache-Control"] = "no-store"
    return page({"recordType": "comment", "status": status}, cursor, limit, admin=True)


@router.patch("/moderation/{identifier}")
def moderate(identifier: str, payload: Moderation, current_user=Depends(moderator)):
    document = find_comment(identifier)
    if document["status"] == "deleted":
        raise HTTPException(409, "Deleted comments cannot be restored")
    if payload.status == "approved":
        require_published(Resource(**{k: document[k] for k in ("contentId", "contentType", "contentOrigin")}))
    fields = {"status": payload.status, "updatedAt": now(), "moderatedBy": str(current_user["_id"])}
    if payload.status == "deleted":
        fields["body"] = ""
    result = comments().update_one({"_id": document["_id"], "status": {"$ne": "deleted"}}, {"$set": fields})
    if not result.matched_count:
        raise HTTPException(409, "Comment was deleted")
    return {"status": payload.status}

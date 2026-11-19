"""Opt-in setup for the single discussion collection. Never run automatically."""
import argparse
import os

NAME = "health_literacy_comments"


def record(required, properties):
    return {"bsonType": "object", "required": ["_id", "recordType", *required],
            "additionalProperties": False, "properties": properties}


STRING = {"bsonType": "string"}
DATE = {"bsonType": "date"}
VALIDATOR = {"$jsonSchema": {"oneOf": [
    record(["contentId", "contentType", "contentOrigin", "userId", "body", "parentId", "status", "createdAt", "updatedAt"], {
        "_id": {"bsonType": "objectId"}, "recordType": {"enum": ["comment"]},
        "contentId": {"bsonType": "string", "minLength": 1, "maxLength": 100},
        "contentType": {"enum": ["articles", "videos", "infographics"]},
        "contentOrigin": {"enum": ["api", "static"]}, "userId": STRING,
        "body": {"bsonType": "string", "maxLength": 2000}, "parentId": {"bsonType": "null"},
        "status": {"enum": ["pending", "approved", "hidden", "deleted"]},
        "createdAt": DATE, "updatedAt": DATE, "moderatedBy": STRING,
    }),
    record(["commentId", "userId", "createdAt"], {
        "_id": STRING, "recordType": {"enum": ["report"]}, "commentId": STRING,
        "userId": STRING, "createdAt": DATE,
    }),
    record(["count", "expiresAt"], {
        "_id": STRING, "recordType": {"enum": ["rate"]},
        "count": {"bsonType": ["int", "long"], "minimum": 1}, "expiresAt": DATE,
    }),
]}}


def setup(db):
    if NAME not in db.list_collection_names():
        db.create_collection(NAME, validator=VALIDATOR, validationLevel="strict", validationAction="error")
    else:
        db.command({"collMod": NAME, "validator": VALIDATOR, "validationLevel": "strict", "validationAction": "error"})
    collection = db[NAME]
    collection.create_index([("recordType", 1), ("contentOrigin", 1), ("contentType", 1), ("contentId", 1),
                             ("status", 1), ("createdAt", -1), ("_id", -1)], name="public_discussion_page")
    collection.create_index([("recordType", 1), ("userId", 1), ("contentOrigin", 1), ("contentType", 1),
                             ("contentId", 1), ("createdAt", -1), ("_id", -1)], name="author_discussion_page")
    collection.create_index([("recordType", 1), ("status", 1), ("createdAt", -1), ("_id", -1)], name="moderation_page")
    collection.create_index([("recordType", 1), ("commentId", 1)], name="comment_reports")
    collection.create_index("expiresAt", expireAfterSeconds=0, name="expire_rate_windows")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Apply only to the explicitly configured database")
    args = parser.parse_args()
    if not args.apply:
        parser.exit(message="No changes made. Review docs/health-literacy-discussions.md before using --apply.\n")
    from pymongo import MongoClient
    if not os.environ.get("MONGO_URI") or not os.environ.get("DB_NAME"):
        parser.error("Set MONGO_URI and DB_NAME explicitly for the intended database")
    setup(MongoClient(os.environ["MONGO_URI"])[os.environ["DB_NAME"]])
    print("Comment collection validator and indexes configured.")

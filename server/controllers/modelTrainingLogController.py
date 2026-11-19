import asyncio
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from fastapi import Depends, File, HTTPException, Query, UploadFile
from pydantic import ValidationError
from pymongo.errors import DuplicateKeyError

from config.database import model_training_logs_collection
from middleware.requirePage import require_page
from models.modelTrainingLog import TrainingLogUpload

MAX_TRAINING_LOG_BYTES = 2 * 1024 * 1024
MODEL_NAMES = {
    "fasttext": "FastText",
    "electra": "ELECTRA",
    "xlmr": "XLM-RoBERTa",
}


def fetch_training_logs(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    model: Literal["all", "fasttext", "electra", "xlmr"] = "all",
    status: Literal["all", "completed", "failed", "cancelled"] = "all",
    days: Literal["all", "7", "30", "90"] = "all",
    search: str = Query(default="", max_length=200),
    current_user: dict = Depends(require_page("Model Access and Toolkit")),
):
    collection = model_training_logs_collection
    query = {}
    if model != "all":
        query["modelId"] = model
    if status != "all":
        query["status"] = status
    if days != "all":
        now = datetime.now(timezone.utc)
        query["startedAt"] = {"$gte": now - timedelta(days=int(days)), "$lte": now}
    if search.strip():
        pattern = {"$regex": re.escape(search.strip()), "$options": "i"}
        query["$or"] = [
            {field: pattern}
            for field in ("runId", "name", "modelVersion", "trainingDataset", "validationDataset")
        ]
    records = list(
        collection.find(query, {"_id": 0, "uploadedBy": 0})
        .sort([("startedAt", -1), ("_id", -1)])
        .skip(offset)
        .limit(limit)
    )
    return {
        "schemaVersion": 1,
        "canUpload": current_user.get("user_type") == "SUPERADMIN",
        "total": collection.count_documents(query),
        "limit": limit,
        "offset": offset,
        "logs": records,
    }


async def upload_training_log(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_page("Model Access and Toolkit")),
):
    try:
        if current_user.get("user_type") != "SUPERADMIN":
            raise HTTPException(
                status_code=403,
                detail="Only SUPERADMIN accounts can upload training logs.",
            )
        if not str(file.filename or "").lower().endswith(".json"):
            raise HTTPException(status_code=400, detail="Choose a JSON training-log file.")
        contents = await file.read(MAX_TRAINING_LOG_BYTES + 1)
        if len(contents) > MAX_TRAINING_LOG_BYTES:
            raise HTTPException(status_code=413, detail="Training-log JSON must be 2 MB or smaller.")
        try:
            text = contents.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise HTTPException(
                status_code=400, detail="Save the JSON file using UTF-8 encoding."
            ) from error
        try:
            report = TrainingLogUpload.model_validate_json(text)
        except ValidationError as error:
            issue = error.errors(include_url=False)[0]
            location = ".".join(
                str(part + 1) if isinstance(part, int) else str(part)
                for part in issue["loc"]
            )
            message = issue["msg"].removeprefix("Value error, ")
            raise HTTPException(
                status_code=400, detail=f"Check {location or 'JSON file'}: {message}"
            ) from error

        # MongoDB's unique _id prevents concurrent or repeated imports of a run.
        identity = json.dumps([report.modelId, report.runId], ensure_ascii=False)
        document_id = hashlib.sha256(identity.encode("utf-8")).hexdigest()
        document = report.model_dump(mode="json")
        document.update({
            "_id": document_id,
            "name": MODEL_NAMES[report.modelId],
            "startedAt": report.startedAt.astimezone(timezone.utc),
            "endedAt": report.endedAt.astimezone(timezone.utc),
            "uploadedAt": datetime.now(timezone.utc),
            "uploadedBy": str(current_user["_id"]),
            "sourceFilename": Path(file.filename).name[:200],
            "durationSeconds": (report.endedAt - report.startedAt).total_seconds(),
        })
        try:
            await asyncio.to_thread(model_training_logs_collection.insert_one, document)
        except DuplicateKeyError as error:
            raise HTTPException(
                status_code=409,
                detail="This training run has already been uploaded. Existing records were kept.",
            ) from error
        return {
            "message": "Training log saved.",
            "runId": report.runId,
            "modelId": report.modelId,
        }
    finally:
        await file.close()

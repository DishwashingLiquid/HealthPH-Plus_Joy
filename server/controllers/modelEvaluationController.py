from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, File, HTTPException, UploadFile
from pydantic import ValidationError

from config.database import model_evaluations_collection
from middleware.requirePage import require_page
from models.modelEvaluation import EvaluationUpload

MAX_EVALUATION_BYTES = 256 * 1024
EVALUATION_DOCUMENT_ID = "disease-classification-v1"
MODEL_NAMES = {"electra": "ELECTRA", "xlmr": "XLM-RoBERTa"}


def fetch_model_evaluations(current_user: dict = Depends(require_page("Model Access and Toolkit"))):
    document = model_evaluations_collection.find_one({"_id": EVALUATION_DOCUMENT_ID}) or {}
    models = document.get("models") or {}
    return {
        "schemaVersion": 1,
        "canUpload": current_user.get("user_type") == "SUPERADMIN",
        "models": [models[key] for key in MODEL_NAMES if key in models],
    }


async def upload_model_evaluations(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_page("Model Access and Toolkit")),
):
    if current_user.get("user_type") != "SUPERADMIN":
        raise HTTPException(status_code=403, detail="Only SUPERADMIN accounts can upload evaluation records.")
    try:
        if not str(file.filename or "").lower().endswith(".json"):
            raise HTTPException(status_code=400, detail="Choose a JSON evaluation file.")
        contents = await file.read(MAX_EVALUATION_BYTES + 1)
        if len(contents) > MAX_EVALUATION_BYTES:
            raise HTTPException(status_code=413, detail="Evaluation JSON must be 256 KB or smaller.")
        try:
            text = contents.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise HTTPException(status_code=400, detail="Save the JSON file using UTF-8 encoding.") from error
        try:
            report = EvaluationUpload.model_validate_json(text)
        except ValidationError as error:
            issue = error.errors(include_url=False)[0]
            location = ".".join(str(part + 1) if isinstance(part, int) else str(part) for part in issue["loc"])
            message = issue["msg"].removeprefix("Value error, ")
            raise HTTPException(status_code=400, detail=f"Check {location or 'JSON file'}: {message}") from error
        uploaded_at = datetime.now(timezone.utc).isoformat()
        updates = {}
        for evaluation in report.models:
            row = evaluation.model_dump(mode="json")
            row.update({
                "name": MODEL_NAMES[evaluation.id],
                "uploadedAt": uploaded_at,
                "uploadedBy": str(current_user["_id"]),
                "sourceFilename": Path(file.filename).name[:200],
            })
            updates[f"models.{evaluation.id}"] = row
        # Replace only the models in this file, together in one atomic update.
        model_evaluations_collection.update_one(
            {"_id": EVALUATION_DOCUMENT_ID}, {"$set": updates}, upsert=True,
        )
        return {"message": "Evaluation records saved.", "modelIds": [row.id for row in report.models]}
    finally:
        await file.close()

from fastapi import APIRouter

from controllers.modelTrainingLogController import fetch_training_logs, upload_training_log

router = APIRouter()
router.add_api_route("/", methods=["GET"], endpoint=fetch_training_logs)
router.add_api_route("/upload", methods=["POST"], endpoint=upload_training_log)

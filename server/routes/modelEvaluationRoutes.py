from fastapi import APIRouter

from controllers.modelEvaluationController import fetch_model_evaluations, upload_model_evaluations

router = APIRouter()
router.add_api_route("/", methods=["GET"], endpoint=fetch_model_evaluations)
router.add_api_route("/upload", methods=["POST"], endpoint=upload_model_evaluations)

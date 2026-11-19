from fastapi import APIRouter

from controllers.sentiment_pulse.mobile_trends import fetch_mobile_trends

router = APIRouter()
router.add_api_route("/trends", methods=["GET"], endpoint=fetch_mobile_trends)

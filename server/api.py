import asyncio

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import HTTPException
from fastapi.templating import Jinja2Templates
from dotenv import dotenv_values, load_dotenv
import os

config = dotenv_values()

load_dotenv()

# Import Routes
from routes.authRoutes import router as authRouter
from routes.userRoutes import router as userRouter
from routes.organizationRoutes import router as organizationRouter
from routes.roleLabelRoutes import router as roleLabelRouter
from routes.activityLogRoutes import router as activityLogRouter
from routes.analyticsRoutes import router as analyticsRouter
from routes.datasetsRoutes import router as datasetsRouter
from routes.analyticsEntryRoutes import router as analyticsEntryRouter
from routes.pointRoutes import router as pointRouter
from routes.miscRoutes import router as miscRouter
from routes.healthLiteracyHubRoutes import (
    mobile_contract_router as healthLiteracyMobileContractRouter,
    router as healthLiteracyHubRouter,
)
from routes.sentimentPulseRoutes import router as sentimentPulseRouter
from routes.diseaseWatchFeedRoutes import (
    mobile_self_reports_router as mobileSelfReportsRouter,
)
from routes.mobileUserRoutes import mobile_users_router as mobileUsersRouter
from controllers.regionalAlertsController import (
    ensure_regional_alert_indexes,
    process_due_regional_alerts,
)

# Initialize FastAPI app
app = FastAPI()

# Initialize FastAPI app for api routes
api_app = FastAPI()
regional_alert_scheduler_task = None


async def _regional_alert_scheduler():
    """Small durable-job poller; database claiming makes multi-worker ticks safe."""
    while True:
        try:
            process_due_regional_alerts()
        except Exception as error:
            # Do not bring down the API for a transient delivery/store failure.
            print(f"Regional alert scheduler failed: {error}")
        await asyncio.sleep(30)


@app.on_event("startup")
async def start_regional_alert_scheduler():
    global regional_alert_scheduler_task
    ensure_regional_alert_indexes()
    regional_alert_scheduler_task = asyncio.create_task(_regional_alert_scheduler())


@app.on_event("shutdown")
async def stop_regional_alert_scheduler():
    if regional_alert_scheduler_task:
        regional_alert_scheduler_task.cancel()

# origins = os.getenv("CORS_ORIGINS").split(",")

cors_origins = os.getenv("CORS_ORIGINS", "")
origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
print("Allowed origins:", origins)


# Setup middlewares
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include Routes
api_app.include_router(router=authRouter, tags=["Auth"], prefix="/auth")
api_app.include_router(router=userRouter, tags=["Users"], prefix="/users")
api_app.include_router(router=organizationRouter, tags=["Organizations"], prefix="/organizations")
api_app.include_router(router=roleLabelRouter, tags=["Role Labels"], prefix="/role-labels")
api_app.include_router(router=activityLogRouter, tags=["Activity Logs"], prefix="/activity-logs")
api_app.include_router(router=datasetsRouter, tags=["Datasets"], prefix="/datasets")
api_app.include_router(router=analyticsEntryRouter, tags=["Analytics Entries"], prefix="/analytics-entries")
api_app.include_router(router=pointRouter, tags=["Points"], prefix="/points")
api_app.include_router(router=analyticsRouter, tags=["Analytics"])
api_app.include_router(router=miscRouter, tags=["Misc"])
api_app.include_router(router=healthLiteracyHubRouter, tags=["Health Literacy Hub"], prefix="/health-literacy-hub")
api_app.include_router(
    router=healthLiteracyMobileContractRouter,
    tags=["Health Literacy Hub"],
    prefix="/health-literacy",
)
api_app.include_router(router=sentimentPulseRouter, tags=["Sentiment Pulse"], prefix="/sentiment-pulse")
api_app.include_router(
    router=mobileSelfReportsRouter,
    tags=["Disease Watch Feed"],
    prefix="/mobile",
)
api_app.include_router(router=mobileUsersRouter, tags=["Mobile Users"], prefix="/mobile")

app.mount("/api", api_app, name="api")

# Serve build files from client / frontend
app.mount("/", StaticFiles(directory="../build", html=True), name="build")

templates = Jinja2Templates(directory="../build")

# Handle 404 error
""" @app.exception_handler(404)
async def catch_all(request: Request, exc: HTTPException):
    return templates.TemplateResponse("index.html", {"request": request}) """

@app.exception_handler(404)
async def catch_all(request: Request, exc: HTTPException):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={}
    )

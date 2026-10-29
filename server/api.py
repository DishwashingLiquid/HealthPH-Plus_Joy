import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from runtime_config import load_server_environment, web_build_directory
from web_frontend import configure_web_frontend

load_server_environment()

# Import Routes
from routes.authRoutes import router as authRouter
from routes.userRoutes import router as userRouter
from routes.organizationRoutes import router as organizationRouter
from routes.roleLabelRoutes import router as roleLabelRouter
from routes.activityLogRoutes import router as activityLogRouter
from routes.analyticsRoutes import router as analyticsRouter
from routes.datasetsRoutes import router as datasetsRouter
from routes.analyticsEntryRoutes import router as analyticsEntryRouter
from routes.environmentalDataRoutes import (
    router as environmentalDataRouter,
    mobile_router as mobileEnvironmentalDataRouter,
)
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
from routes.healthRoutes import router as healthRouter
from routes.mobileSurveillanceRoutes import router as mobileSurveillanceRouter
from controllers.regionalAlertsController import (
    ensure_regional_alert_indexes,
    process_due_regional_alerts,
    run_automation_tick,
)

# Initialize FastAPI app
app = FastAPI()

# Initialize FastAPI app for api routes
api_app = FastAPI(
    title="HealthPH+ Shared API",
    description="Shared web and mobile backend. Public mobile environmental GET routes are available to guests; dashboard and personal-data routes retain their own access rules.",
)
regional_alert_scheduler_task = None


async def _regional_alert_scheduler():
    """Small durable-job poller; database claiming makes multi-worker ticks safe."""
    while True:
        try:
            # PyMongo is synchronous. Keep bounded regional reconciliation and
            # recipient preparation off FastAPI's async request loop.
            await asyncio.to_thread(process_due_regional_alerts)
            await asyncio.to_thread(run_automation_tick)
        except Exception as error:
            # Do not bring down the API for a transient delivery/store failure.
            print(f"Regional alert scheduler failed: {error}")
        await asyncio.sleep(30)


@app.on_event("startup")
async def start_regional_alert_scheduler():
    global regional_alert_scheduler_task
    from config.database import self_reports_collection, report_id_counters_collection
    from helpers.selfReportIdHelpers import ensure_report_id_indexes

    ensure_report_id_indexes(self_reports_collection, report_id_counters_collection)
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
    expose_headers=["Accept-Ranges", "Content-Range", "Content-Length", "ETag"],
)

api_app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Accept-Ranges", "Content-Range", "Content-Length", "ETag"],
)


# Include Routes
api_app.include_router(router=authRouter, tags=["Auth"], prefix="/auth")
api_app.include_router(router=userRouter, tags=["Users"], prefix="/users")
api_app.include_router(router=organizationRouter, tags=["Organizations"], prefix="/organizations")
api_app.include_router(router=roleLabelRouter, tags=["Role Labels"], prefix="/role-labels")
api_app.include_router(router=activityLogRouter, tags=["Activity Logs"], prefix="/activity-logs")
api_app.include_router(router=datasetsRouter, tags=["Datasets"], prefix="/datasets")
api_app.include_router(router=analyticsEntryRouter, tags=["Analytics Entries"], prefix="/analytics-entries")
api_app.include_router(router=environmentalDataRouter, tags=["Environmental Data"], prefix="/environmental-data")
api_app.include_router(
    router=mobileEnvironmentalDataRouter,
    tags=["Mobile Environmental Data"],
    prefix="/mobile/environmental-data",
)
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
api_app.include_router(router=healthRouter, tags=["Health"], prefix="/health")
api_app.include_router(
    router=mobileSurveillanceRouter,
    tags=["Mobile Surveillance"],
    prefix="/mobile/surveillance",
)

app.mount("/api", api_app, name="api")

# The API can run without a Vite build. Serve it when present, resolving its
# path from the repository rather than the shell's current directory.
configure_web_frontend(app, web_build_directory())

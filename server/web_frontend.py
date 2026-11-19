"""Optionally serve the web build while keeping API-only deployments usable."""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles


def configure_web_frontend(app: FastAPI, build_directory: Path):
    index = build_directory / "index.html"
    if index.is_file():
        app.mount("/", StaticFiles(directory=str(build_directory), html=True), name="build")
    else:
        @app.get("/", include_in_schema=False)
        def api_home():
            return {"service": "HealthPH+ API", "docs": "/api/docs", "health": "/api/health/live"}

    @app.exception_handler(404)
    async def not_found(request: Request, error):
        path = request.url.path
        if (
            index.is_file()
            and path != "/api"
            and not path.startswith("/api/")
            and request.method in {"GET", "HEAD"}
            and "text/html" in request.headers.get("accept", "")
        ):
            return FileResponse(index)
        return JSONResponse(status_code=404, content={"detail": "Not Found"})

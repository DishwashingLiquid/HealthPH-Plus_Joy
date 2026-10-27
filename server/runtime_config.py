"""Entry-point configuration shared by local development and hosted API runs."""

import os
from pathlib import Path

from dotenv import load_dotenv


SERVER_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = SERVER_ROOT.parent


def load_server_environment():
    # Deployment environment variables win over the local development file.
    load_dotenv(SERVER_ROOT / ".env", override=False)


def server_options():
    port = int(os.getenv("PORT", "8000"))
    if not 1 <= port <= 65535:
        raise ValueError("PORT must be between 1 and 65535")
    options = {
        "host": os.getenv("HOST", "0.0.0.0"),
        "port": port,
        "reload": os.getenv("HEALTHPH_RELOAD", "true").strip().lower() in {"1", "true", "yes"},
        "app_dir": str(SERVER_ROOT),
    }
    if options["reload"]:
        options["reload_dirs"] = [str(SERVER_ROOT)]
    return options


def web_build_directory():
    configured = Path(os.getenv("HEALTHPH_WEB_BUILD_DIR", "build")).expanduser()
    return configured if configured.is_absolute() else PROJECT_ROOT / configured

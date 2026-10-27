import os

import uvicorn

from runtime_config import SERVER_ROOT, load_server_environment, server_options


def main():
    load_server_environment()
    # Legacy upload/chart paths are relative to server/. Keep them correct
    # even when this entry point is launched from the repository root.
    os.chdir(SERVER_ROOT)
    uvicorn.run("api:app", **server_options())


if __name__ == "__main__":
    main()

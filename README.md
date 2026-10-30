# HealthPH (v2.1)

## Prerequisites
1. Python 3.11 (64-bit). Use this version for the server virtual environment so compiled dependencies match the interpreter.
2. MongoDB database connection string

### How to setup
1. In client folder, create an `.env` file and copy the contents of `.env.example` file. Put the required data.
2. In server, create an `.env` file and copy the contents of `.env.example` file. Put the required data.
3. Open terminal on root directory, and go to `client` directory

```bash
cd client
```
4. Type the following commands:
```bash
yarn install
yarn build
```

5. Open another terminal in root directory, and go to `server` folder
```bash
cd server
```

6. Type the following commands in PowerShell on Windows:
```powershell
py -3.11 -m venv .venv

.\.venv\Scripts\Activate.ps1

python -m pip install -r requirements.txt
```

If startup reports `No module named 'pydantic_core._pydantic_core'`, check
`python --version`. The environment must use the same Python version as its
compiled packages. For an existing environment whose packages were installed
for Python 3.11, stop the server and run
`py -3.11 -m venv --upgrade --without-pip .venv` from the `server` folder,
then activate the environment again.

### How to use
1. Open terminal in root directory and go to `server` folder.
```bash
cd server
```
2. Activate the existing environment and run FastAPI. Environment creation is only needed during setup; do not rerun `python -m venv .venv` each time, since your default Python may be a different version.
```powershell
.\.venv\Scripts\Activate.ps1
.\.venv\Scripts\python.exe main.py
```
3. On a browser go to the following URL: `http://localhost:8000/`

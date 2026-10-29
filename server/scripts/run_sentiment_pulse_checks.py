"""Run selected compatibility suites in separate processes with MongoDB blocked.

Use a test-only environment. Never import the application or shared DB config.
"""

import os
from pathlib import Path
import subprocess
import sys

SUITES = (
    "test_sentiment_pulse_mobile_trends.py",
    "test_sentiment_pulse_annotations.py",
    "test_sentiment_pulse_summary.py",
    "test_sentiment_pulse_regional_analysis.py",
    "test_sentiment_pulse_application_ids.py",
    "test_regional_summaries.py",
    "test_dashboard_regions.py",
    "test_mobile_registration_and_analytics.py",
    "test_disease_watch_storage.py",
    "test_disease_watch_alert_processing.py",
)

GUARD = '''
import importlib.abc, sys, runpy, os
class BlockDatabase(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname == "config.database":
            raise AssertionError("Shared database import forbidden in isolated tests")
sys.meta_path.insert(0, BlockDatabase())
import pymongo, pymongo.mongo_client
def forbidden(*args, **kwargs):
    raise AssertionError("Real MongoDB client forbidden in isolated tests")
pymongo.MongoClient = pymongo.mongo_client.MongoClient = forbidden
os.environ.pop("SENTIMENT_PULSE_TEST_MONGO_URI", None)
sys.argv = [sys.argv[1]]
runpy.run_path(sys.argv[0], run_name="__main__")
'''


def main():
    root = Path(__file__).resolve().parents[1]
    failures = []
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    for name in SUITES:
        result = subprocess.run([sys.executable, "-c", GUARD, str(root / "tests" / name)],
                                capture_output=True, text=True, encoding="utf-8", env=env)
        print(f"{name}: {'PASS' if result.returncode == 0 else 'FAIL'}", flush=True)
        print(result.stdout + result.stderr, flush=True)
        if result.returncode:
            failures.append(name)
    return bool(failures)


if __name__ == "__main__":
    sys.exit(main())

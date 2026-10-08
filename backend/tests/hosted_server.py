"""Isolated browser fixture, never a deployment entrypoint."""
import os
from pathlib import Path
import sys
from datetime import datetime, timezone
import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.update(STATIC_DIR=sys.argv[1], ENV="test", APP_MODE="hosted",
                  DATABASE_URL="", CLERK_PUBLISHABLE_KEY="pk_test_browser_fixture")
import test_api_v2
fixture = test_api_v2.TestApiV2("test_v2_health")
fixture.setUp()
# A file-backed fixture gives concurrent HTTP requests separate SQLite connections.
# StaticPool's one shared in-memory connection is unsuitable for a browser's parallel requests.
import sqlite3
from sqlalchemy import create_engine
database = str(Path(sys.argv[1]).parent / "hosted-test.sqlite3")
with fixture.engine.connect() as conn:
    with sqlite3.connect(database) as target:
        conn.connection.driver_connection.backup(target)
browser_engine = create_engine("sqlite:///" + database, connect_args={"check_same_thread": False, "timeout": 2})
fixture.app.state.engine = browser_engine
fixture.app.state.clock = lambda: datetime.now(timezone.utc)
try:
    uvicorn.run(fixture.app, host="127.0.0.1", port=int(sys.argv[2]))
finally:
    fixture.tearDown()

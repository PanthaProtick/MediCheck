"""Optional Chrome smoke test; never uses the demo database or existing browser profile."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import socket
import sys
import tempfile
import time
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[2]
CHROME = Path(os.environ.get('PROGRAMFILES', 'C:/Program Files')) / 'Google/Chrome/Application/chrome.exe'
if not CHROME.exists():
    raise SystemExit('Chrome unavailable; browser validation has not run.')

def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]

def poll(url, process):
    for _ in range(100):
        if process.poll() is not None:
            raise RuntimeError("Isolated test service exited before readiness.")
        try:
            with urlopen(url, timeout=0.5) as response:
                return json.load(response)
        except OSError:
            time.sleep(0.1)
    raise RuntimeError('Isolated test service did not start: ' + url)

with tempfile.TemporaryDirectory(prefix='rxverify-browser-') as directory:
    processes = []
    server_port, debug_port = free_port(), free_port()
    origin = f"http://127.0.0.1:{server_port}/"
    env = os.environ.copy()
    env.update(DEMO_DATABASE_PATH=str(Path(directory) / 'test.sqlite3'),
               DEMO_STAFF_TOKEN='browser-test-only-token', ENV='demo',
               STATIC_DIR=str(ROOT / 'frontend/dist'))
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    try:
        processes.append(subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', str(server_port)],
            cwd=ROOT / 'backend', env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags))
        poll(origin + 'api/v1/health', processes[-1])
        processes.append(subprocess.Popen([str(CHROME), '--headless=new', '--disable-background-networking', '--disable-extensions',
            '--no-first-run', '--no-default-browser-check', '--disable-sync', '--remote-debugging-port=' + str(debug_port),
            '--user-data-dir=' + str(Path(directory) / 'chrome'), 'about:blank'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags))
        debugger = poll(f'http://127.0.0.1:{debug_port}/json/version', processes[-1])['webSocketDebuggerUrl']
        result = subprocess.run([shutil.which('node'), str(ROOT / 'frontend/tests/browser.mjs'), origin, debugger], timeout=60)
        if result.returncode:
            raise SystemExit(result.returncode)
    finally:
        for process in reversed(processes):
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        # Chrome can release its crash-report files shortly after the browser exits.
        profile = (Path(directory) / 'chrome').resolve()
        if not profile.is_relative_to(Path(directory).resolve()):
            raise RuntimeError('Test profile escaped its temporary directory.')
        for attempt in range(30):
            try:
                if profile.exists():
                    shutil.rmtree(profile)
                break
            except PermissionError:
                if attempt == 29:
                    raise
                time.sleep(0.1)

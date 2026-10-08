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
HOSTED = "--hosted" in sys.argv
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
               DEMO_STAFF_TOKEN='browser-test-only-token', ENV='demo', APP_MODE='local',
               STATIC_DIR=str(ROOT / 'frontend/dist'))
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    try:
        if HOSTED:
            output = Path(directory) / "hosted-dist"
            build = subprocess.run([shutil.which("node"), "node_modules/vite/bin/vite.js", "build",
                                    "--config", "tests/hosted.vite.config.js", "--outDir", str(output)],
                                   cwd=ROOT / "frontend", check=True, timeout=30)
            shutil.copyfile(output / "tests/hosted.html", output / "index.html")
            server_args = [sys.executable, str(ROOT / "backend/tests/hosted_server.py"), str(output), str(server_port)]
        else:
            server_args = [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(server_port)]
        processes.append(subprocess.Popen(server_args,
            cwd=ROOT / 'backend', env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags))
        poll(origin + ('api/v2/health' if HOSTED else 'api/v1/health'), processes[-1])
        processes.append(subprocess.Popen([str(CHROME), '--headless=new', '--disable-background-networking', '--disable-extensions',
            '--no-first-run', '--no-default-browser-check', '--disable-sync', '--remote-debugging-port=' + str(debug_port),
            '--user-data-dir=' + str(Path(directory) / 'chrome'), 'about:blank'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=flags))
        debugger = poll(f'http://127.0.0.1:{debug_port}/json/version', processes[-1])['webSocketDebuggerUrl']
        result = subprocess.run([shutil.which('node'), str(ROOT / ('frontend/tests/hosted-browser.mjs' if HOSTED else 'frontend/tests/browser.mjs')), origin, debugger], timeout=60)
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

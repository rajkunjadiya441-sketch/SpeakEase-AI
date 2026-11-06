"""Real production HTTP check, with no dependency overrides or fake model output."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import socket
import sys
from tempfile import TemporaryDirectory
from threading import Thread
from time import perf_counter, sleep
from urllib.request import Request, urlopen

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))
sys.path.insert(0, str(BACKEND / "scripts"))
import uvicorn
from app.main import app
from app.services.alignment import get_aligner
from compare_models import memory_snapshot


def main():
    source = ROOT / "test_audio/recording_2_test.wav"
    audio = source.read_bytes()
    before = hashlib.sha256(audio).hexdigest()
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    base = f"http://127.0.0.1:{port}"
    server = uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning"))
    thread = Thread(target=server.run, daemon=True)
    thread.start()
    with TemporaryDirectory(prefix="speakease-e2e-") as folder:
        get_aligner().temp_dir = folder
        runs = []
        try:
            for _ in range(200):
                if server.started:
                    break
                sleep(0.05)
            else:
                raise RuntimeError("HTTP server did not start")
            def upload():
                boundary = "speakease-real-integration"
                body = f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="recording_2_test.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + audio + f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="expected_text"\r\n\r\nI have three apples.\r\n--{boundary}--\r\n'.encode()
                start = perf_counter()
                with urlopen(Request(base + "/speech/analyze", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}), timeout=180) as response:
                    data = json.load(response)
                    status = response.status
                return {"http_status": status, "total_request_seconds": perf_counter() - start,
                        "response": data, "alignment_worker_diagnostics": get_aligner().last_diagnostics,
                        "backend_process_memory": memory_snapshot()}
            for _ in range(2):
                with ThreadPoolExecutor(1) as pool:
                    future = pool.submit(upload)
                    sleep(0.5)
                    start = perf_counter()
                    with urlopen(base + "/health", timeout=5) as response:
                        health = json.load(response)
                    health_seconds = perf_counter() - start
                    result = future.result()
                result.update(health_during_processing=health, health_seconds=health_seconds)
                if result["response"]["alignment_status"] != "completed":
                    raise RuntimeError(json.dumps(result))
                assert list(Path(folder).iterdir()) == [], "IPC temporary files were not removed"
                runs.append(result)
        finally:
            server.should_exit = True
            thread.join(10)
            get_aligner().temp_dir = None
    after = hashlib.sha256(source.read_bytes()).hexdigest()
    assert before == after
    report = {"source_sha256": before, "source_unchanged": True, "ipc_cleanup_verified": True, "runs": runs}
    output = json.dumps(report, indent=2)
    (ROOT / "test_audio/integrated_http_result.json").write_text(output + "\n", encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()

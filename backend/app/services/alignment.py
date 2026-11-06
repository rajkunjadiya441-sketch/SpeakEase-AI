"""Isolated alignment subprocess adapter. Successful recognition survives failures."""
from collections import Counter
from dataclasses import dataclass, field
import json
import logging
import math
import os
from pathlib import Path
import signal
import subprocess
from tempfile import TemporaryDirectory
from threading import BoundedSemaphore

import numpy as np

from app.config import ALIGNMENT_PYTHON, ALIGNMENT_TIMEOUT_SECONDS, PROJECT_ROOT

logger = logging.getLogger(__name__)


@dataclass
class AlignmentResult:
    alignment_status: str
    words: list[dict] = field(default_factory=list)
    unaligned_words: list[str] = field(default_factory=list)
    alignment_error: str | None = None


class AlignmentService:
    def __init__(self, python=ALIGNMENT_PYTHON, timeout=ALIGNMENT_TIMEOUT_SECONDS,
                 runner=PROJECT_ROOT / "alignment/align_recording.py", temp_dir=None):
        self.python = Path(python).resolve()
        self.runner = Path(runner).resolve()
        self.timeout = timeout
        self.temp_dir = temp_dir
        self._slot = BoundedSemaphore(1)
        self.last_diagnostics = None  # operational measurements; never patient audio/text

    def _run_process(self, payload):
        options = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {"start_new_session": True}
        process = subprocess.Popen([str(self.python), str(self.runner), "--ipc"],
                                   cwd=str(PROJECT_ROOT), stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                   text=True, encoding="utf-8", errors="replace", shell=False, **options)
        try:
            stdout, stderr = process.communicate(json.dumps(payload), timeout=self.timeout)
        except subprocess.TimeoutExpired:
            # On Windows the venv launcher has a child Python process: kill the tree.
            if os.name == "nt":
                killer = Path(os.environ.get("SystemRoot", "C:/Windows")) / "System32/taskkill.exe"
                try:
                    subprocess.run([str(killer), "/PID", str(process.pid), "/T", "/F"],
                                   capture_output=True, timeout=10, creationflags=subprocess.CREATE_NO_WINDOW)
                except (OSError, subprocess.TimeoutExpired):
                    logger.exception("Could not terminate alignment process tree")
                if process.poll() is None:
                    process.kill()
            else:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            process.communicate(timeout=10)
            raise
        return process.returncode, stdout, stderr

    def align(self, waveform, transcript):
        self.last_diagnostics = None
        if not transcript.strip():
            return AlignmentResult("skipped")
        if not self._slot.acquire(blocking=False):
            return AlignmentResult("failed", alignment_error="Alignment is busy. Retry shortly.")
        try:
            if not self.python.is_file() or not self.runner.is_file():
                return AlignmentResult("failed", alignment_error="Alignment environment is unavailable.")
            with TemporaryDirectory(prefix="speakease-alignment-", dir=self.temp_dir) as folder:
                path = Path(folder) / "waveform.npy"
                np.save(path, waveform, allow_pickle=False)
                code, stdout, stderr = self._run_process({"version": 1, "sample_rate": 16000,
                                                        "transcript": transcript, "waveform_path": str(path.resolve())})
                if code != 0:
                    logger.error("Alignment worker exited %s: %s", code, stderr[-4000:])
                    return AlignmentResult("failed", alignment_error="Alignment process failed. Check server logs.")
                result = json.loads(stdout)
                status = result["alignment_status"]
                words = result["words"]
                unaligned = result["unaligned_words"]
                if result.get("version") != 1 or result.get("transcript") != transcript or status not in ("completed", "partial", "failed"):
                    raise ValueError("Invalid alignment result contract")
                if not isinstance(words, list) or not isinstance(unaligned, list) or not all(isinstance(w, str) for w in unaligned):
                    raise ValueError("Invalid word lists")
                duration = len(waveform) / 16000
                previous = -1.0
                for word in words:
                    a, b = word["start"], word["end"]
                    if not isinstance(word["word"], str) or type(a) not in (int, float) or type(b) not in (int, float) or not math.isfinite(a) or not math.isfinite(b) or not (0 <= a <= b <= duration + 0.01) or a < previous:
                        raise ValueError("Invalid word timestamp")
                    previous = a
                if Counter(w["word"] for w in words) + Counter(unaligned) != Counter(transcript.split()):
                    raise ValueError("Aligned words differ from supplied recognized transcript")
                supplied = iter(transcript.split())
                if any(not any(token == word["word"] for token in supplied) for word in words):
                    raise ValueError("Aligned words are out of transcript order")
                expected_status = "completed" if words and not unaligned else "partial" if words else "failed"
                if status != expected_status:
                    raise ValueError("Inconsistent alignment status")
                self.last_diagnostics = result.get("diagnostics")
                clean_words = [{"word": w["word"], "start": w["start"], "end": w["end"]} for w in words]
                return AlignmentResult(status, clean_words, unaligned,
                                       "Some recognized words could not be aligned." if status != "completed" else None)
        except subprocess.TimeoutExpired:
            return AlignmentResult("failed", alignment_error="Alignment timed out. Transcript remains available.")
        except Exception:
            logger.exception("Alignment adapter failed")
            return AlignmentResult("failed", alignment_error="Alignment failed or returned an invalid result. Check server logs.")
        finally:
            self._slot.release()


_service = AlignmentService()


def get_aligner():
    return _service

"""TEST ONLY: explicit dependency overrides; never used by production startup."""
from types import SimpleNamespace
from unittest.mock import Mock

from fastapi import Request

from app.main import app
from app.services.transcription import TranscriptionService, get_transcriber

model = Mock()
model.transcribe.side_effect = lambda *a, **kw: (iter([SimpleNamespace(text="Mock transcript.")]), None)
normal = TranscriptionService(model_factory=Mock(return_value=model))
init_failure = TranscriptionService(model_factory=Mock(side_effect=RuntimeError("test initialization failure")))


def fail_lazily(*args, **kwargs):
    def segments():
        raise RuntimeError("test lazy inference failure")
        yield
    return segments(), None


bad_model = Mock()
bad_model.transcribe.side_effect = fail_lazily
inference_failure = TranscriptionService(model_factory=Mock(return_value=bad_model))


def override(request: Request):
    mode = request.headers.get("x-test-mode")
    return {"init_failure": init_failure, "inference_failure": inference_failure}.get(mode, normal)


app.dependency_overrides[get_transcriber] = override


from app.services.alignment import AlignmentResult, get_aligner
import time


class FakeAligner:
    def __init__(self, fail=False):
        self.fail = fail

    def align(self, waveform, transcript):
        if not transcript:
            return AlignmentResult("skipped")
        if self.fail:
            return AlignmentResult("failed", alignment_error="Alignment process failed. Check server logs.")
        return AlignmentResult("completed", [{"word": "Mock", "start": 0.1, "end": 0.2},
                                             {"word": "transcript.", "start": 0.2, "end": 0.3}])


def alignment_override(request: Request):
    return FakeAligner(request.headers.get("x-test-mode") == "alignment_failure")


class SlowRecognizer:
    def transcribe(self, waveform):
        time.sleep(1)
        return normal.transcribe(waveform)


_original_override = override


def recognition_override(request: Request):
    return SlowRecognizer() if request.headers.get("x-test-mode") == "slow" else _original_override(request)


app.dependency_overrides[get_transcriber] = recognition_override
app.dependency_overrides[get_aligner] = alignment_override

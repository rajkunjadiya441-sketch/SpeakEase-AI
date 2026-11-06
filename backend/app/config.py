"""Environment configuration, with defaults for local Vite development."""
import os
from pathlib import Path


def get_cors_origins() -> list[str]:
    value = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return [origin.strip() for origin in value.split(",") if origin.strip()]


# Fail startup on invalid configuration rather than silently ignoring it.
import math

MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", "10485760"))
MAX_AUDIO_DURATION_SECONDS = float(os.getenv("MAX_AUDIO_DURATION_SECONDS", "30"))
if MAX_UPLOAD_BYTES <= 0 or not math.isfinite(MAX_AUDIO_DURATION_SECONDS) or MAX_AUDIO_DURATION_SECONDS <= 0:
    raise ValueError("Audio size and duration limits must be positive and finite.")


WHISPER_MODEL = os.getenv("WHISPER_MODEL", "tiny")
WHISPER_CPU_THREADS = int(os.getenv("WHISPER_CPU_THREADS", "2"))
_model_dir = Path(os.getenv("WHISPER_MODEL_DIR", "models"))
# Relative cache paths are resolved from the project root, independent of cwd.
WHISPER_MODEL_DIR = str(_model_dir if _model_dir.is_absolute() else Path(__file__).resolve().parents[2] / _model_dir)
if not WHISPER_MODEL.strip() or WHISPER_CPU_THREADS <= 0:
    raise ValueError("WHISPER_MODEL must be nonempty and WHISPER_CPU_THREADS positive.")


PROJECT_ROOT = Path(__file__).resolve().parents[2]
_alignment_python = Path(os.getenv("ALIGNMENT_PYTHON", "alignment/.venv/Scripts/python.exe"))
ALIGNMENT_PYTHON = _alignment_python if _alignment_python.is_absolute() else PROJECT_ROOT / _alignment_python
ALIGNMENT_TIMEOUT_SECONDS = float(os.getenv("ALIGNMENT_TIMEOUT_SECONDS", "120"))
if not math.isfinite(ALIGNMENT_TIMEOUT_SECONDS) or ALIGNMENT_TIMEOUT_SECONDS <= 0:
    raise ValueError("ALIGNMENT_TIMEOUT_SECONDS must be positive and finite.")

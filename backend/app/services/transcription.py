"""CPU-only English recognition. Model outputs are never inferred from target text."""
from dataclasses import dataclass
import logging
from threading import BoundedSemaphore

import numpy as np

from app.config import WHISPER_CPU_THREADS, WHISPER_MODEL, WHISPER_MODEL_DIR

logger = logging.getLogger(__name__)


class TranscriptionError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail


@dataclass
class TranscriptionResult:
    transcript: str
    model: str
    language: str = "en"


class TranscriptionService:
    def __init__(self, model_name=WHISPER_MODEL, cpu_threads=WHISPER_CPU_THREADS,
                 model_dir=WHISPER_MODEL_DIR, model_factory=None):
        self.model_name = model_name
        self.cpu_threads = cpu_threads
        self.model_dir = model_dir
        self._factory = model_factory
        self._model = None
        self._slot = BoundedSemaphore(1)

    def _load_model(self):
        if self._model is None:
            try:
                if self._factory is None:
                    from faster_whisper import WhisperModel
                    factory = WhisperModel
                else:
                    factory = self._factory
                self._model = factory(self.model_name, device="cpu", compute_type="int8",
                                      cpu_threads=self.cpu_threads, num_workers=1,
                                      download_root=self.model_dir)
            except Exception as exc:
                logger.exception("Speech model initialization failed")
                raise TranscriptionError(503, "Speech model could not be loaded. Check model cache, network access and server logs.") from exc
        return self._model

    def prepare(self):
        """Optionally warm/download the model before the first request."""
        if not self._slot.acquire(blocking=False):
            raise TranscriptionError(429, "Speech processing is busy. Retry shortly.")
        try:
            self._load_model()
        finally:
            self._slot.release()

    def transcribe(self, waveform: np.ndarray) -> TranscriptionResult:
        if not self._slot.acquire(blocking=False):
            raise TranscriptionError(429, "Speech processing is busy. Retry shortly.")
        try:
            if waveform.ndim != 1 or not waveform.size or not np.isfinite(waveform).all():
                raise TranscriptionError(422, "A nonempty finite mono waveform is required.")
            # Avoid Whisper hallucinations on digital silence. VAD handles other nonspeech.
            if float(np.sqrt(np.mean(np.square(waveform, dtype=np.float64)))) < 0.0001:
                return TranscriptionResult("", self.model_name)
            model = self._load_model()
            try:
                segments, _ = model.transcribe(waveform, language="en", beam_size=1,
                                               vad_filter=True, word_timestamps=False,
                                               condition_on_previous_text=False)
                # Iteration is essential: faster-whisper inference is lazy.
                transcript = " ".join(segment.text.strip() for segment in segments if segment.text.strip())
                return TranscriptionResult(transcript, self.model_name)
            except Exception as exc:
                logger.exception("Speech inference failed")
                raise TranscriptionError(503, "Speech transcription failed. Retry or check server logs.") from exc
        finally:
            self._slot.release()


_service = TranscriptionService()


def get_transcriber() -> TranscriptionService:
    return _service

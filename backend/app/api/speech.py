from threading import BoundedSemaphore
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.config import MAX_AUDIO_DURATION_SECONDS, MAX_UPLOAD_BYTES
from app.services.audio import AudioValidationError, display_filename, decode_audio

from app.services.transcription import TranscriptionError, TranscriptionService, get_transcriber

from app.services.alignment import AlignmentService, get_aligner

_pipeline_slot = BoundedSemaphore(1)

router = APIRouter(prefix="/speech", tags=["speech"])


class AlignedWord(BaseModel):
    word: str
    start: float = Field(ge=0)
    end: float = Field(ge=0)


class AudioResponse(BaseModel):
    status: Literal["completed", "no_speech"]
    processing_status: Literal["completed"] = "completed"
    filename: str
    duration_seconds: float
    expected_text: str | None
    transcript: str
    words: list[AlignedWord] = Field(default_factory=list)
    model: str
    language: Literal["en"] = "en"
    alignment_status: Literal["completed", "partial", "failed", "skipped"]
    alignment_error: str | None = None
    unaligned_words: list[str] = Field(default_factory=list)


@router.post("/analyze", response_model=AudioResponse)
def analyze(file: Annotated[UploadFile, File(description="WAV or WebM audio")],
            expected_text: Annotated[str | None, Form(max_length=2000)] = None,
            recognizer: TranscriptionService = Depends(get_transcriber),
            aligner: AlignmentService = Depends(get_aligner)) -> AudioResponse:
    if not _pipeline_slot.acquire(blocking=False):
        file.file.close()
        raise HTTPException(429, "Speech processing is busy. Retry shortly.", headers={"Retry-After": "2"})
    try:
        audio = decode_audio(file.file, file.content_type, MAX_UPLOAD_BYTES, MAX_AUDIO_DURATION_SECONDS)
        result = recognizer.transcribe(audio.waveform)
        aligned = aligner.align(audio.waveform, result.transcript)
        return AudioResponse(status="completed" if result.transcript else "no_speech",
                             filename=display_filename(file.filename), duration_seconds=audio.duration_seconds,
                             expected_text=expected_text, transcript=result.transcript, model=result.model,
                             words=aligned.words, alignment_status=aligned.alignment_status,
                             alignment_error=aligned.alignment_error, unaligned_words=aligned.unaligned_words)
    except (AudioValidationError, TranscriptionError) as exc:
        raise HTTPException(exc.status_code, exc.detail, headers={"Retry-After": "2"} if exc.status_code == 429 else None) from exc
    finally:
        file.file.close()
        _pipeline_slot.release()

"""Validate uploaded bytes and decode audio; no recognition or persistence."""
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import BinaryIO

import av
import numpy as np


class AudioValidationError(Exception):
    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail


TYPES = {
    "wav": {"audio/wav", "audio/wave", "audio/x-wav", "audio/vnd.wave"},
    "webm": {"audio/webm", "video/webm"},
}


@dataclass
class DecodedAudio:
    duration_seconds: float
    waveform: np.ndarray | None
    sample_rate: int = 16000


def validate_audio(file: BinaryIO, content_type: str | None, max_bytes: int,
                   max_seconds: float) -> float:
    """Compatibility wrapper for validation-only callers."""
    return _decode_audio(file, content_type, max_bytes, max_seconds, False).duration_seconds


def decode_audio(file: BinaryIO, content_type: str | None, max_bytes: int,
                 max_seconds: float) -> DecodedAudio:
    return _decode_audio(file, content_type, max_bytes, max_seconds, True)


def _decode_audio(file: BinaryIO, content_type: str | None, max_bytes: int,
                  max_seconds: float, collect: bool) -> DecodedAudio:
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if not size:
        raise AudioValidationError(400, "Audio file is empty.")
    if size > max_bytes:
        raise AudioValidationError(413, "Audio file exceeds the upload size limit.")
    mime = (content_type or "").split(";", 1)[0].strip().lower()
    if mime not in TYPES["wav"] | TYPES["webm"]:
        raise AudioValidationError(415, "Use a WAV or WebM audio content type.")
    header = file.read(12)
    file.seek(0)
    if header[:4] == b"RIFF" and header[8:12] == b"WAVE":
        kind = "wav"
        if int.from_bytes(header[4:8], "little") + 8 != size:
            raise AudioValidationError(422, "WAV file is truncated or has an invalid RIFF size.")
    elif header[:4] == b"\x1a\x45\xdf\xa3":
        kind = "webm"
    else:
        raise AudioValidationError(422, "File signature is not WAV or WebM.")
    if mime not in TYPES[kind]:
        raise AudioValidationError(415, "Audio content type does not match the file signature.")
    if kind == "webm":
        # EBML DocType element: WebM uses the four-byte value "webm".
        ebml = file.read(min(size, 4096))
        file.seek(0)
        if b"\x42\x82\x84webm" not in ebml:
            raise AudioValidationError(415, "Only WebM is supported, not other Matroska containers.")
    try:
        # Explicit demuxer restricts format probing; input is a local file object.
        with av.open(file, mode="r", format="wav" if kind == "wav" else "matroska,webm", options={"err_detect": "explode"}) as container:
            if len(container.streams.audio) != 1 or len(container.streams) != 1:
                raise AudioValidationError(422, "Upload exactly one audio stream with no video.")
            stream = container.streams.audio[0]
            stream.codec_context.thread_count = 1
            resampler = av.AudioResampler(format="flt", layout="mono", rate=16000) if collect else None
            chunks = []
            duration = 0.0
            start = None
            end = None
            for frame in container.decode(stream):
                if frame.sample_rate <= 0 or frame.samples <= 0:
                    raise AudioValidationError(422, "Invalid audio sample metadata.")
                seconds = frame.samples / frame.sample_rate
                duration += seconds
                if frame.pts is not None and frame.time_base is not None:
                    timestamp = float(frame.pts * frame.time_base)
                    start = timestamp if start is None else min(start, timestamp)
                    end = timestamp + seconds if end is None else max(end, timestamp + seconds)
                measured = max(duration, (end - start) if start is not None else 0)
                if measured > max_seconds + 1e-6:
                    raise AudioValidationError(422, "Audio exceeds the maximum duration.")
                if resampler is not None:
                    for output in resampler.resample(frame):
                        chunks.append(output.to_ndarray().reshape(-1))
            if resampler is not None:
                for output in resampler.resample(None):
                    chunks.append(output.to_ndarray().reshape(-1))
            if duration <= 0:
                raise AudioValidationError(422, "No decodable audio samples found.")
            waveform = np.concatenate(chunks).astype(np.float32, copy=False) if chunks else None
            if collect and (waveform is None or not waveform.size or not np.isfinite(waveform).all()):
                raise AudioValidationError(422, "Audio could not be converted to a finite mono waveform.")
            return DecodedAudio(round(max(duration, end - start if start is not None else 0), 6), waveform)
    except AudioValidationError:
        raise
    except (av.error.FFmpegError, ValueError, EOFError, OverflowError) as exc:
        raise AudioValidationError(422, "Audio is corrupted or cannot be decoded.") from exc
    finally:
        if not file.closed:
            file.seek(0)


def display_filename(filename: str | None) -> str:
    name = PurePosixPath((filename or "recording").replace("\\", "/")).name
    return "".join(char for char in name if char.isprintable())[:255] or "recording"

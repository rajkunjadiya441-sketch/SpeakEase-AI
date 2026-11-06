"""Explicit real-model check; never modifies the supplied recording."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
from time import perf_counter

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import MAX_AUDIO_DURATION_SECONDS, MAX_UPLOAD_BYTES
from app.services.audio import decode_audio
from app.services.transcription import get_transcriber


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", nargs="?", type=Path)
    parser.add_argument("--download-only", action="store_true")
    args = parser.parse_args()
    if not args.download_only and args.audio is None:
        parser.error("Provide a real WAV/WebM recording or --download-only")
    if args.audio is not None and not args.audio.is_file():
        parser.error(f"Recording does not exist: {args.audio}")
    service = get_transcriber()
    start = perf_counter()
    service.prepare()
    load_seconds = perf_counter() - start
    if args.download_only:
        print(json.dumps({"model": service.model_name, "device": "cpu", "compute_type": "int8", "model_load_seconds": load_seconds}))
        return
    before = hashlib.sha256(args.audio.read_bytes()).hexdigest()
    mime = "audio/webm" if args.audio.suffix.lower() == ".webm" else "audio/wav"
    start = perf_counter()
    with args.audio.open("rb") as file:
        audio = decode_audio(file, mime, MAX_UPLOAD_BYTES, MAX_AUDIO_DURATION_SECONDS)
    decode_seconds = perf_counter() - start
    runs = []
    for _ in range(2):
        start = perf_counter()
        result = service.transcribe(audio.waveform)
        runs.append({"transcript": result.transcript, "inference_seconds": perf_counter() - start})
    after = hashlib.sha256(args.audio.read_bytes()).hexdigest()
    if before != after:
        raise RuntimeError("Source recording changed during test")
    print(json.dumps({"model": service.model_name, "device": "cpu", "compute_type": "int8", "language": "en", "model_load_seconds": load_seconds, "decode_seconds": decode_seconds, "duration_seconds": audio.duration_seconds, "source_sha256": before, "source_unchanged": True, "runs": runs}, indent=2))


if __name__ == "__main__":
    main()

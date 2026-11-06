"""Compare cached tiny vs base.en in separate Windows processes; no defaults changed."""
import argparse
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
from time import perf_counter

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


def memory_snapshot():
    if os.name != "nt":
        return {"unavailable": "Windows process counters only"}
    class Counters(ctypes.Structure):
        _fields_ = [("cb", wintypes.DWORD), ("PageFaultCount", wintypes.DWORD)] + [
            (name, ctypes.c_size_t) for name in (
                "PeakWorkingSetSize", "WorkingSetSize", "QuotaPeakPagedPoolUsage",
                "QuotaPagedPoolUsage", "QuotaPeakNonPagedPoolUsage", "QuotaNonPagedPoolUsage",
                "PagefileUsage", "PeakPagefileUsage", "PrivateUsage")]
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    psapi = ctypes.WinDLL("psapi", use_last_error=True)
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
    psapi.GetProcessMemoryInfo.restype = wintypes.BOOL
    counters = Counters()
    counters.cb = ctypes.sizeof(counters)
    if not psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(counters), counters.cb):
        raise ctypes.WinError(ctypes.get_last_error())
    return {"pid": os.getpid(), "working_set_bytes": counters.WorkingSetSize,
            "peak_working_set_bytes": counters.PeakWorkingSetSize,
            "private_commit_bytes": counters.PrivateUsage}


def worker(audio_path, model_name):
    from app.config import MAX_AUDIO_DURATION_SECONDS, MAX_UPLOAD_BYTES
    from app.services.audio import decode_audio
    from app.services.transcription import TranscriptionService
    before = hashlib.sha256(audio_path.read_bytes()).hexdigest()
    memory_before = memory_snapshot()
    service = TranscriptionService(model_name=model_name, cpu_threads=2)
    start = perf_counter()
    service.prepare()
    load_seconds = perf_counter() - start
    memory_loaded = memory_snapshot()
    start = perf_counter()
    with audio_path.open("rb") as file:
        audio = decode_audio(file, "audio/wav", MAX_UPLOAD_BYTES, MAX_AUDIO_DURATION_SECONDS)
    decode_seconds = perf_counter() - start
    runs = []
    for _ in range(4):
        start = perf_counter()
        result = service.transcribe(audio.waveform)
        runs.append({"transcript": result.transcript, "inference_seconds": perf_counter() - start})
    after = hashlib.sha256(audio_path.read_bytes()).hexdigest()
    if before != after:
        raise RuntimeError("Source recording changed during comparison")
    return {"model": model_name, "device": "cpu", "compute_type": "int8", "cpu_threads": 2,
            "language": "en", "beam_size": 1, "vad_filter": True,
            "source_sha256": before, "source_unchanged": True,
            "duration_seconds": audio.duration_seconds, "model_load_seconds": load_seconds,
            "decode_seconds": decode_seconds, "runs": runs,
            "warm_median_seconds": statistics.median(run["inference_seconds"] for run in runs[1:]),
            "memory_before_model": memory_before, "memory_after_model": memory_loaded,
            "memory_after_inference": memory_snapshot()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path)
    parser.add_argument("--worker", choices=["tiny", "base.en"])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    audio = args.audio.resolve(strict=True)
    if args.worker:
        print(json.dumps(worker(audio, args.worker)))
        return
    # Download only the new model in a separate process; download memory is excluded
    # from measured inference workers. tiny already exists as the working fallback.
    env = os.environ.copy()
    env["WHISPER_MODEL"] = "base.en"
    subprocess.run([sys.executable, str(BACKEND / "scripts/transcribe_recording.py"), "--download-only"], env=env, check=True, stdout=sys.stderr)
    results = []
    for name in ("tiny", "base.en"):
        completed = subprocess.run([sys.executable, str(Path(__file__).resolve()), str(audio), "--worker", name], check=True, text=True, capture_output=True)
        if completed.stderr:
            print(completed.stderr, file=sys.stderr)
        results.append(json.loads(completed.stdout))
    report = {"audio": str(audio), "method": "separate processes; four calls per model; warm median of calls 2-4; identical settings; decoded once per process", "memory_method": "Windows GetProcessMemoryInfo on the inference process itself; peak resident working set includes imports, model initialization and inference; excludes prior download process", "results": results}
    output = json.dumps(report, indent=2)
    if args.output:
        args.output.write_text(output + "\n", encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()

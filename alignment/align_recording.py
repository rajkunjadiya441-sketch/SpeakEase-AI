"""CPU alignment only, with standalone WAV and JSON IPC entry points."""
import argparse
from collections import Counter
from contextlib import redirect_stdout
import ctypes
from ctypes import wintypes
import hashlib
import json
import math
import os
from pathlib import Path
import sys
from time import perf_counter
import wave


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




def run_alignment(audio, transcript, repetitions=1):
    """Reuse the model within this process. No transcription or expected-text input."""
    total_start = perf_counter()
    import torch
    import torchaudio
    import nltk
    from whisperx.alignment import load_align_model, align
    if torch.version.cuda is not None:
        raise RuntimeError("CPU-only PyTorch required")
    torch.set_num_threads(2)
    torch.set_num_interop_threads(1)
    duration = len(audio) / 16000
    cache = Path(__file__).resolve().parents[1] / "models" / "alignment"
    cache.mkdir(parents=True, exist_ok=True)
    nltk_cache = cache / "nltk_data"
    nltk.data.path.insert(0, str(nltk_cache))
    try:
        nltk.data.find("tokenizers/punkt_tab/english/")
    except LookupError:
        if not nltk.download("punkt_tab", download_dir=str(nltk_cache), quiet=True):
            raise RuntimeError("NLTK punkt_tab download failed")
    memory_before = memory_snapshot()
    start = perf_counter()
    model, metadata = load_align_model("en", "cpu", model_name="WAV2VEC2_ASR_BASE_960H", model_dir=str(cache))
    model.eval()
    load_seconds = perf_counter() - start
    runs = []
    for _ in range(repetitions):
        start = perf_counter()
        result = align([{"start": 0.0, "end": duration, "text": transcript}], model, metadata, audio, "cpu", interpolate_method="ignore", return_char_alignments=False, print_progress=False)
        elapsed = perf_counter() - start
        words, unaligned = [], []
        for item in result.get("word_segments", []):
            word = item["word"]
            a, b = item.get("start"), item.get("end")
            if a is None or b is None or not math.isfinite(a) or not math.isfinite(b) or not (0 <= a <= b <= duration + 0.01):
                unaligned.append(word)
            else:
                words.append({"word": word, "start": float(a), "end": float(b)})
        missing = Counter(transcript.split()) - Counter(w["word"] for w in words) - Counter(unaligned)
        unaligned.extend(missing.elements())
        runs.append({"alignment_seconds": elapsed, "words": words, "unaligned_words": unaligned, "alignment_status": "completed" if words and not unaligned else "partial" if words else "failed"})
    return {"transcript": transcript, "model": "WAV2VEC2_ASR_BASE_960H", "device": "cpu", "dtype": "float32", "cpu_threads": 2, "torch": torch.__version__, "torchaudio": torchaudio.__version__, "cuda_runtime": torch.version.cuda, "duration_seconds": duration, "model_load_seconds_including_any_download": load_seconds, "total_seconds_including_imports_setup": perf_counter() - total_start, "interpolate_method": "ignore", "memory_before_model": memory_before, "memory_after_inference": memory_snapshot(), "runs": runs}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", nargs="?", type=Path)
    parser.add_argument("--transcript")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--ipc", action="store_true")
    args = parser.parse_args()
    if args.ipc:
        request = json.load(sys.stdin)
        if request.get("version") != 1 or request.get("sample_rate") != 16000:
            raise ValueError("Unsupported alignment input contract")
        transcript = request["transcript"]
        if not isinstance(transcript, str) or not transcript.strip() or len(transcript) > 10000:
            raise ValueError("Invalid transcript")
        # Keep libraries/model diagnostics out of the successful JSON channel.
        with redirect_stdout(sys.stderr):
            import numpy as np
            source = Path(request["waveform_path"])
            if not source.is_absolute() or source.stat().st_size > 64 * 1024 * 1024:
                raise ValueError("Invalid waveform file")
            audio = np.load(source, allow_pickle=False)
            if audio.dtype != np.float32 or audio.ndim != 1 or not audio.size or not np.isfinite(audio).all():
                raise ValueError("Expected a finite mono float32 waveform")
            report = run_alignment(audio, transcript)
        result = {"version": 1, "transcript": transcript, **report["runs"][0],
                  "diagnostics": {key: report[key] for key in ("model", "model_load_seconds_including_any_download", "total_seconds_including_imports_setup", "memory_after_inference")}}
        print(json.dumps(result, allow_nan=False))
        return
    if args.audio is None or not args.transcript or not args.transcript.strip():
        parser.error("Provide a WAV and --transcript, or use --ipc")
    import numpy as np
    source = args.audio.resolve(strict=True)
    before = hashlib.sha256(source.read_bytes()).hexdigest()
    with wave.open(str(source), "rb") as wav:
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != (1, 2, 16000):
            raise ValueError("Expected mono 16 kHz PCM16 WAV")
        audio = np.frombuffer(wav.readframes(wav.getnframes()), dtype="<i2").astype(np.float32) / 32768.0
    report = run_alignment(audio, args.transcript, repetitions=2)
    after = hashlib.sha256(source.read_bytes()).hexdigest()
    if before != after:
        raise RuntimeError("Source changed during alignment")
    report.update(source_sha256=before, source_unchanged=True)
    output = json.dumps(report, indent=2, allow_nan=False)
    if args.output:
        args.output.write_text(output + "\n", encoding="utf-8")
    print(output)


if __name__ == "__main__":
    main()

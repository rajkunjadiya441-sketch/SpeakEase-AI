# Isolated WhisperX CPU alignment

This environment is separate from backend/.venv. Do not install these requirements in the backend environment. The production FastAPI route now calls this runner through JSON IPC.

## Setup from project root (Windows PowerShell)

Create the environment only on a fresh checkout where it does not already exist:

```powershell
py -3.11 -m venv alignment/.venv
alignment/.venv/Scripts/python.exe -m pip install --only-binary=:all: --extra-index-url https://download.pytorch.org/whl/cpu -r alignment/requirements-lock.txt
alignment/.venv/Scripts/python.exe -m pip check
```

The pinned +cpu builds prevent selecting CUDA builds of torch, torchaudio and torchvision. WhisperX 3.8.6 requires older Hugging Face packages; those are installed only here. Its metadata also installs dependencies used by transcription/diarization, but this runner does not load those models or call those workflows. The installed package snapshot is recorded separately after installation.

## Standalone real test

```powershell
alignment/.venv/Scripts/python.exe alignment/align_recording.py "C:/path/to/your-own-16k-mono-pcm16.wav" --transcript "Actual recognized words here."
```

Optional REAL alignment command, not a lightweight test. Supply your own mono16-kHz PCM16 WAV; private test_audio fixtures are not shipped. It opens the WAV without changing it. The recognized transcript is supplied explicitly. The expected exercise sentence is never used. This script only calls WhisperX load_align_model and align: no WhisperX transcription or faster-whisper inference.

English alignment model: WAV2VEC2_ASR_BASE_960H, CPU float32, two threads. Model weights and NLTK punkt_tab data are downloaded under ignored models/alignment on first use. The same model is reused for two alignment calls. Download/setup and model-loading time are reported separately from the two alignment timings. Windows process memory counters measure the actual inference process, including imports, initialization and inference, not only model weights.

interpolate_method=ignore prevents filling missing timestamps. Returned words must have finite start/end values inside the recording; unalignable or missing words are listed explicitly. No pronunciation scores are returned. Aligning supplied words estimates their positions; it does not establish that those words were spoken correctly.

See PROGRESS.md for historical results and ARCHITECTURE.md for the completed subprocess integration. The root README contains the portable fresh-clone setup. Keep the existing successful transcript available if alignment errors, times out or is unavailable.

## Verified standalone results

Real recognized transcript: "I have three happens." All four words aligned, no missing words. Timestamps: I 0.722-0.822 s; have 0.862-1.002 s; three 1.042-1.243 s; happens. 1.263-1.604 s. These are estimates for the supplied text, not pronunciation judgments.

First process: 33.67 s model loading including initial download, 2.35 s / 0.63 s alignment calls. Cached process: 2.09 s model loading, 1.11 s / 0.77 s alignment calls; 19.61 s whole script including imports/setup and two calls. Peak resident RAM reached 1.12 GiB. Both environments pass pip check and the backend package snapshot is unchanged. Full results are recorded in PROGRESS.md and ignored test_audio/alignment*_result.json.

requirements-lock.txt contains the installed package versions. To reproduce that snapshot in a separate fresh alignment environment, use the same CPU index with -r alignment/requirements-lock.txt. Do not apply either alignment requirements file to backend/.venv. Production integration now uses the IPC mode described below.

## Backend IPC mode

FastAPI invokes this same runner as `alignment/.venv/Scripts/python.exe alignment/align_recording.py --ipc`. stdin is JSON version 1 with sample_rate 16000, actual recognized transcript and an absolute temporary waveform_path. The .npy must contain finite mono float32 samples and is loaded with allow_pickle=False. The runner calls shared run_alignment once, without decoding or transcription. Successful JSON stdout includes version/transcript, alignment_status, actual words, unaligned_words and operational diagnostics. Library/model stdout is redirected to stderr. Missing timestamp interpolation is disabled.

The parent owns temporary files, timeout (120 s default), process-tree termination, serialization, result validation and safe error fallback. Both environments remain isolated and unchanged. No HTTP alignment service exists. Standalone WAV mode continues to run two model-reusing calls for measurements. PROGRESS.md records the completed integrated HTTP results, 43 passing tests and latency limitations.

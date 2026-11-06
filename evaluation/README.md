# SpeakEase AI evaluation

Status: Phase3 benchmarks preserved. Phase4 pilot verified3/3; full25 performance-only PREPARED with47 passing tests, zero full inference. All457 references unchanged/pending; accuracy unavailable. STOP for approval.

Actual data: 100/100 frozen candidates downloaded, decoded and eligible; 0 reserves, 0 audio download/decode failures. Original FLAC payload is 14,230,967 bytes, below the approved 120-file /17,109,200-byte limits. All recordings are 16 kHz mono 16-bit; durations range 2.02-29.14 s, median 6.06 s, total 752.899875 s. Each decoded PCM MD5 matches its embedded FLAC checksum, and corpus ID/reference pairings were rechecked.

Read [PHASE2_DATASET.md](PHASE2_DATASET.md) for actual results, recovery, checks and limitations; [verified manifest](metadata/librispeech_verified_manifest.json) and [aggregate verification](results/dataset_verification.json) for per-file evidence. The historical [metadata preflight](PHASE2_PREFLIGHT.md), frozen candidate manifest and seed-42 inventory remain preserved. [REPORT.md](REPORT.md) now links the saved tiny scores and pending base.en evaluation; [PHASE1_PLAN.md](PHASE1_PLAN.md) and [config/plan.json](config/plan.json) describe later proposed phases.

## Approval workflow

| Phase | Scope | Current status |
| --- | --- | --- |
| 1 | Source/environment audit and protocol | COMPLETE; historical |
| 2 | Metadata preflight, bounded download, full decoding/provenance verification | COMPLETE; 100 verified recordings |
| 3 | Same-sample tiny/base.en ASR numerical evaluation | Both saved 100-record benchmarks COMPLETE; preserved |
| 4 | Independent word-boundary references and alignment evaluation | Pilot3/3 verified; full25 prepared, pending execution approval; zero verified references |
| 5 | Actual single-worker API latency/process-tree memory | PENDING explicit approval |
| 6 | Verified numerical tables, plots and mentor report | PENDING explicit approval |

After each phase, report actual results/files/limitations/next steps and STOP. Completed Phase 2 authorization does not authorize further downloads, installations, runtime repairs, manual annotations or benchmarks. The configuration is an approval history and proposal, not permission to run later work. No unused reserve or full archive/parquet will be fetched automatically.

## Current Phase 4 - pilot verified, full25 prepared

[Full handoff and standalone command](results/phase4_whisperx/FULL_BENCHMARK.md), [pilot verification](results/phase4_whisperx/pilot_verification.json), [47-test evidence](results/phase4_whisperx/full_tests.json), [preparation](results/phase4_whisperx/full_preparation.json). Pilot completed3/3 with63/63 valid word intervals; aggregate alignment7.335569 s, RTF0.284766. No boundary accuracy is available; all457 annotation rows remain unchanged/pending.

Full25 performance-only is PREPARED, not executed. Same frozen order, correct corpus reference text, existing WhisperX CPU float32/two threads/cached model, one cold child at a time. Gates remain2-GiB available RAM/3-GiB commit before launch/import/model load; timeout/critical-pressure cleanup and offline guards remain. Completed pilot attempts passed all admission gates and critical floors, although paging occurred and runtime RAM dipped below2 GiB. Original interruption was a pre-model RAM-gate block; commit shortage/timeout/model failure was not evidenced. Resume kept two completed files and completed only the missing third.

After explicit approval, close VS Code and use standalone PowerShell -NoProfile:

~~~powershell
Set-Location -LiteralPath "C:\Users\RAJ\OneDrive\Desktop\speak-easeAI"
& ".\backend\.venv\Scripts\python.exe" -B ".\evaluation\scripts\phase4_full.py" --performance-only
~~~

The SAME command resumes validated completed files from results/phase4_whisperx/full25/checkpoint.json; each attempt retains separate gate/state/logs. Future result:results/phase4_whisperx/full_result.json. It will measure all25 afresh, never copy pilot results. Automated tests only were executed during preparation; full checkpoint remains0/25. Existing app, environments, data, Phase3 results and original pilot sources/results are unchanged. STOP for approval. Accuracy still requires independent verified human references. Earlier Phase3 handoff entries below are historical.

## Completed Phase 3 baseline

Both saved ASR benchmarks contain100 completed/scored recordings in identical manifest order. Tiny:WER9.3536%, CER4.2584%, total inference59.190561 s. Base.en:WER5.19099%, CER2.50167%, total inference108.0935628 s. These are existing measurements read from the protected JSON files, not rerun during Phase4. Original Phase3 reports retain their historical preparation stages and metadata. ASR predictions and machine word timings are not human alignment ground truth.

## Dataset and verification tools

Audio lives only under evaluation/data/librispeech_test_clean/flac/ and is excluded by the existing evaluation/.gitignore data/ rule. Original FLACs are preserved; no WAV copies or synthetic speech/text/timestamps were created. The frozen manifest and inventory are unchanged; a separate verified manifest records finalized IDs, original references, bytes, SHA256, format and measured duration. Reference verification means fresh source metadata/ID/audio-path pairing, not independent human transcription. Sentence labels do not provide genuine word boundaries.

Five new preparation/check scripts use existing Node and backend PyAV only. acquire_audio.mjs enforces approved IDs/count/byte reservations, checks metadata and HEAD before each GET, streams to temporary .part files, removes failed partials, and invokes a decode-only Python worker. No audio retries are automatic. After a metadata HTTP 429 stopped the first run at 55 successes, explicit checked --resume retained those files and continued at candidate 56 without audio duplication. The final manifest retains this event. Acquisition is now finished.

Safe offline checks, from the project root:

~~~powershell
node evaluation/scripts/test_download_guards.mjs
node evaluation/scripts/check_dataset.mjs
~~~

These passed. The guard suite covers limits and resume safety; the offline checker independently confirms frozen ranking/reference consistency, all 100 file hashes/sizes, recorded decode integrity, caps and unchanged protected application files. Every audio file was fully decoded using existing PyAV 18.1.0 and passed embedded PCM checksum validation. Detailed commands/results are in PHASE2_DATASET.md. Do not rerun acquisition network commands without new approval.

## Runtime and next-phase readiness

Phase 2 preflight corrected the earlier restricted-view Python result: original Python 3.11.9 and both venvs work, and both pip checks passed then. No repair, recreation or dependency change was needed or performed. No new pip check, backend/frontend regression suite or model inference was run during dataset preparation. Existing application sources and environment configuration hashes match the prior audit.

Keep backend/.venv for existing faster-whisper tiny CPU/int8 and alignment/.venv for isolated CPU WhisperX. No default changed. The completed tiny run uses existing dependency-free asr_metrics.py, which base.en reuses unchanged; no JiWER or metrics environment installation is needed for this preparation. The current available-RAM snapshot was 672.56 MiB, volatile; recheck before benchmarking. The earlier generic >=2 GiB physical-RAM suggestion is superseded for approved pilots by the model-specific RAM/commit gates above. Keep sequential models, two threads, one clip at a time and no implicit model downloads. Do not stop the working application or user programs automatically.

Production uploads remain WAV/WebM; these original FLACs are for later approved offline ASR. WAV derivation for future HTTP testing is pending that phase. Model caches present in the prior audit do not establish inference readiness. Only the saved tiny ASR results are available; base.en and alignment comparison results remain pending. No pronunciation or clinical conclusion is claimed. STOP before base.en inference and await explicit approval.

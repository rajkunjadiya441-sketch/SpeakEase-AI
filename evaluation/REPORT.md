# SpeakEase AI - quantitative evaluation report

Status: Phase3 complete/preserved. Phase4 pilot3/3 verified; full25 performance-only prepared with47 passing tests, not executed. No boundary accuracy:457 unchanged pending rows. November6, 2026 (Asia/Calcutta). STOP for approval.

## Objective and systems

Compare deployed multilingual faster-whisper tiny and base.en on identical LibriSpeech samples; evaluate WhisperX boundaries against independent human references; measure the actual API. This evaluates recognition and timestamp positioning, not clinical articulation or pronunciation correctness.

Audited settings: faster-whisper 1.2.1 CPU/int8, two threads, beam 1, English, VAD on; no expected-text prompt. WhisperX 3.8.6 uses WAV2VEC2_ASR_BASE_960H CPU float32/two threads in its isolated environment. Defaults remain unchanged. Exact protocol: [PHASE1_PLAN.md](PHASE1_PLAN.md); planning configuration: [config/plan.json](config/plan.json).

## Historical Phase 1/2 audit observations

| Item | Observed |
| --- | --- |
| CPU | i5-1135G7, 8 logical processors |
| RAM | 8,299,257,856 bytes total (7.73 GiB) |
| Available RAM snapshots, Phase 2 | 763,707,392 and 926,539,776 bytes (728.3-883.6 MiB), volatile |
| Free disk snapshot, Phase 2 | 293,795,368,960 bytes |
| Model caches | tiny/base.en/alignment files present; no load test |
| Python readiness | Phase 2 host checks: Python 3.11.9 and both original venvs work; earlier restricted-view absence was misleading |
| Dependencies | Both existing-environment pip checks passed; no changes; model inference not exercised |

No interpreter repair, venv recreation, installation or model load occurred. No repair is needed based on the Phase 2 read-only verification. [phase1_audit.json](phase1_audit.json) preserves machine, package and download-header observations.

## Dataset and annotation status

Selected exactly 100 seed-42 candidates from LibriSpeech test-clean, pinned revision 71cacbfb7e2354c4226d01e70d77d5fca3d04ba1, CC BY 4.0. All 100 audio downloads and full PyAV decodes succeeded; no reserves, exclusions or audio retries. Actual received/retained FLAC payload: 14,230,967 bytes, below 120 files /17,109,200 bytes. Total duration:752.899875 s; min/median/max:2.02/6.06/29.14 s; 36 speakers. All are 16 kHz mono 16-bit, with embedded PCM MD5 matches and recorded SHA256 values. No archive/parquet or derived WAV was downloaded/created.

Fresh pinned source ID/reference/audio-path pairings matched for every clip. This is corpus metadata verification, not a human listening/transcription audit. A transient metadata HTTP 429 interrupted after 55 successes; checked resume kept these files and completed the remaining 45 without repeated audio GETs. Offline budget and dataset-integrity checks passed; application hashes are unchanged. Evidence: [PHASE2_DATASET.md](PHASE2_DATASET.md), [verified manifest](metadata/librispeech_verified_manifest.json), [verification summary](results/dataset_verification.json) and [offline integrity check](results/dataset_integrity_check.json).

Planned timestamp clips:25; actual independent annotations:none. Sentence references are not word-boundary truth. Annotation or alternate datasets need separate approval. Optional articulation design:45 consented clips, none collected, separate results. No benchmark is authorized by this preparation result.

## Early tiny pilot implementation and gate result (historical)

[Detailed handoff](PHASE3_PILOT.md), [actual attempt](results/phase3_tiny_pilot.json), [20-test evidence](results/phase3_pilot_tests.json).

| Item | Actual result |
| --- | --- |
| Implemented scope | Tiny only; deterministic shortest/middle/longest pilot, maximum three files |
| Selected durations | 2.02 /6.055 /29.14 seconds |
| Required RAM /commit headroom | 1.0 /2.0 GiB |
| Observed RAM /commit headroom | 704,454,656 bytes (671.82 MiB) /6,305,185,792 bytes (5.872 GiB) |
| Gate result | BLOCKED: insufficient physical RAM |
| Model load attempted /completed cases | No /0 |
| Model load time, inference time, peak model RAM, pilot paging | UNAVAILABLE; no worker started |
| Non-inference tests | 20 passed, 0 failures/errors; live native counter and test-child cleanup checks passed |
| Full ASR, base.en pilot, alignment/API benchmarks | NOT RUN; not authorized by current pilot scope |

The new evaluation scripts preserve the application CPU/int8/two-thread configuration and reuse its transcription service through an offline local-model factory. A native monitor observes the actual worker PID; atomic checkpoints retain completed case results on interruption. Base.en/full execution is rejected. The generic 2-GiB available-RAM suggestion is superseded for pilots by the approved model-specific gates; base.en's future 1.25-GiB RAM /2.5-GiB commit gate is defined but its execution is disabled. No dependencies were installed; JiWER/scoring remains pending approval.

Source/requirements/config hashes and existing dataset artifacts remain unchanged. Application regression suites were not rerun for evaluation-only work. Mocked gate/contract tests and native process smoke tests do not establish successful model loading, audio inference or real result resumption; these remain unverified. No WER/CER or model graph is filled from a blocked pilot. Historical single-recording measurements are not substituted for this evaluation.

## Earlier base.en pilot/full preparation handoff (historical)

The existing [base.en pilot](results/phase3_base_en_pilot.json) and raw run20261105T170015Z_e4f41fe4 agree:3/3 completed, matching sources/references/scorer/versions and tiny configuration except model identity. Supervisor/pre-import/pre-load gates all passed 1.25-GiB RAM /2.5-GiB commit requirements; all recorded samples also passed. No recorded error and stderr0 bytes. [Independent verification](results/phase3_base_pilot_verification.json) recomputed scores/times and checked current cached file hashes without inference.

Peak resident329,900,032 bytes (314.617 MiB); peak private commit1,584,185,344 bytes (1.475388 GiB), final private commit1,481,027,584 bytes (1.379314 GiB). These are separate counters, not summed. Inference per recording:1.2092133 /0.8063155 /2.1421476 s; total4.1576764 s, aggregate RTF0.0828801272 over50.1649375 s audio. Model load0.4993356 s; excluded warmup1.4400079 s; supervised wall time8.344 s. Private/process high-water counters include imports/loading/inference.

Sixteen memory samples showed minimum available RAM2.996 GiB and commit headroom12.173 GiB. Maximum system-wide page inputs6832.992/s, reads1461.981/s, sampled outputs/writes0. File-backed reads contribute; these do not establish pagefile-only activity or guarantee no unsampled dips. No full-corpus performance claim follows from three clips.

The resumable full base.en runner now preserves the same 100-file order, scorer, CPU/int8/two-thread/VAD settings, one-record processing, gates, timers and excluded warmup as tiny. Fifty-one automated tests passed, including real saved-pilot checks, native counter/owned-child smoke checks and mocked 100-record interruption/resume/output isolation/final-summary recovery. No model load/inference or full benchmark ran during this preparation. All 165 protected file hashes match, covering tiny/pilot outputs, all original audio and application/environment configuration.

[Full handoff](PHASE3_BASE_FULL.md), [preparation](results/phase3_base_full_preparation.json), [test evidence](results/phase3_base_full_tests.json). Future result:evaluation/results/phase3_base_full.json; checkpoints:evaluation/results/raw/asr_full_base_en/seed42/. Both are reserved for the later approved full invocation. No final full-base result exists yet, and no comparison chart or base full WER/CER is invented.

## Current Phase 4 - pilot verified, full25 prepared

[Full handoff and standalone command](results/phase4_whisperx/FULL_BENCHMARK.md), [pilot verification](results/phase4_whisperx/pilot_verification.json), [47-test evidence](results/phase4_whisperx/full_tests.json), [preparation](results/phase4_whisperx/full_preparation.json). Pilot completed3/3 with63/63 valid word intervals; aggregate alignment7.335569 s, RTF0.284766. No boundary accuracy is available; all457 annotation rows remain unchanged/pending.

Full25 performance-only is PREPARED, not executed. Same frozen order, correct corpus reference text, existing WhisperX CPU float32/two threads/cached model, one cold child at a time. Gates remain2-GiB available RAM/3-GiB commit before launch/import/model load; timeout/critical-pressure cleanup and offline guards remain. Completed pilot attempts passed all admission gates and critical floors, although paging occurred and runtime RAM dipped below2 GiB. Original interruption was a pre-model RAM-gate block; commit shortage/timeout/model failure was not evidenced. Resume kept two completed files and completed only the missing third.

After explicit approval, close VS Code and use standalone PowerShell -NoProfile:

~~~powershell
Set-Location -LiteralPath "C:\Users\RAJ\OneDrive\Desktop\speak-easeAI"
& ".\backend\.venv\Scripts\python.exe" -B ".\evaluation\scripts\phase4_full.py" --performance-only
~~~

The SAME command resumes validated completed files from results/phase4_whisperx/full25/checkpoint.json; each attempt retains separate gate/state/logs. Future result:results/phase4_whisperx/full_result.json. It will measure all25 afresh, never copy pilot results. Automated tests only were executed during preparation; full checkpoint remains0/25. Existing app, environments, data, Phase3 results and original pilot sources/results are unchanged. STOP for approval. Accuracy still requires independent verified human references. Earlier Phase3 handoff entries below are historical.

## Mathematical definitions

- Corpus WER = sum_i(S_i+D_i+I_i)/sum_i(reference word count_i).
- Corpus CER = sum_i(character S+D+I)/sum_i(reference characters_i), after identical declared normalization and removal of whitespace for CER.
- Per-record rates have their own reference denominators; mean per-file WER is not corpus WER.
- Start MAE_ms =1000*sum_matched(abs(pred_start-ref_start))/matched word count; end MAE analogously.
- Median boundary error pools matched start/end errors; threshold percentages <=50/100/200 ms report scorable and all-reference denominators plus missing counts.
- RTF_i = processing_seconds_i/audio_seconds_i; aggregate RTF =sum(processing_seconds)/sum(audio_seconds).
- Nearest-rank P95 uses ceil(0.95*n); publish n. Full pipeline success requires actual recognized speech and completed valid alignment, not HTTP 200 alone.

Propose JiWER for real word/character edits. Preserve raw references/predictions and the Unicode/case/punctuation/apostrophe/digit/whitespace normalization policy. Never fill technical failures with fabricated hypotheses.

## Numerical results and pending evaluation

| Experiment | Proposed sample | Status | Metrics |
| --- | --- | --- | --- |
| tiny ASR | Same 100 clips | COMPLETE; saved result preserved | WER9.3536%; CER4.2584%; inference59.190561 s; aggregate RTF0.0786167762 |
| base.en ASR | Same frozen 100 clips | COMPLETE; saved artifact preserved | WER5.19099%; CER2.50167%; inference108.0935628 s |
| Alignment A: correct reference text | Frozen25;457 word rows | TEMPLATE/PROTOCOL PREPARED; zero verified times; NOT RUN | No real accuracy/coverage/time/RAM measurements |
| Alignment B: tiny text | Same 25 clips | REFERENCES NOT PREPARED; NOT RUN | Boundary error/coverage/time NOT MEASURED |
| API | Proposed 30 warm +3 cold requests | NOT RUN | Success/failures/latency/RTF/RAM NOT MEASURED |
| Optional articulation | Proposed 45 clips | NOT COLLECTED | No clinical score implemented |

No zero error rates, accuracy, F1/precision/recall, pronunciation scores, model ranking or graphs are invented. Historical single-recording smoke checks in PROGRESS.md do not populate this dataset table.

## Limitations and next steps

A duration-filtered 100-clip read-speech sample is not the full test set or a clinical population. Sampling reproducibility is distinct from decoder determinism. Genuine boundaries, lexical matching/ambiguity and failed-word coverage constrain alignment conclusions. The missing-Python report was corrected by Phase 2 host verification; low available RAM still prevents assuming earlier timing conditions are reproducible. Final available-RAM snapshots were 728.3 and 883.6 MiB; see the runtime audit for volatile resource values.

Both Phase3 full ASR artifacts are now complete and preserved. Phase4 preparation is tested, with human references and real pilot/full inference pending. STOP before executing even the readiness pilot. Use the standalone performance-only command in the protocol only after explicit approval; it cannot establish accuracy. No alignment/API benchmark or subsequent phase ran during preparation.

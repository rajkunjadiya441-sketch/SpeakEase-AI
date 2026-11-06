# Milestone 5C Phase 3: manual tiny full evaluation

Authorized scope: existing seed42 verified 100-record LibriSpeech test-clean subset, tiny only. Implementation is ready; the real full run has NOT been executed by the agent. Base.en remains unapproved.

Run from a standalone PowerShell after closing VS Code:

```powershell
powershell.exe -NoProfile -File "C:\Users\RAJ\OneDrive\Desktop\speak-easeAI\evaluation\Run-TinyFull.ps1"
```

The launcher uses the existing backend interpreter with -B. CPU/int8, two threads, one worker and one recording at a time; native FLAC decoding and production transcription settings are retained. All model construction uses a local cached tiny snapshot and local_files_only, with offline environment flags. No packages, environments, backend or frontend are changed.

Start/import/load gates retain >=1 GiB available RAM and >=2 GiB commit headroom. The existing sustained-pressure kill guard, half-second native process/system/paging samples, 300-second inference and 180-second other-stage deadlines remain. Full-run total deadline is 10 hours. Only the owned child tree is stopped. System paging counters include file reads and cannot isolate pagefile faults.

One warmup using the first frozen recording is excluded from measured counts/timing, following the Phase 1 plan. Each resumed process repeats that warmup. All 100 recordings are measured in manifest order. Inference time excludes decoding/model loading/warmup and includes VAD/recognition. Aggregate RTF is total measured inference seconds divided by measured audio duration.

Every completed recording is fsync'd to an atomically replaced checkpoint. Repeating the identical command resumes the completed prefix in results/raw/asr_full_tiny/seed42, retrying only unfinished work. Ctrl+C leaves checkpoints intact. Dataset/source/code/settings/model fingerprints are checked; changes fail closed. A completed run is not rerun. The shared pilot/full OS lock prevents overlap.

Summary: results/phase3_tiny_full.json. Raw job/checkpoint/summary, samples.csv, metrics.csv, memory_samples.jsonl and stdout/stderr logs are under results/raw/asr_full_tiny/seed42. Checkpoint includes raw text, normalized text, word and character S/D/I counts, reference lengths, rates, decode/inference latency and native memory. Summary includes corpus WER/CER, aggregate RTF, peak worker resident memory across attempts, memory minima and paging maxima. Partial results are explicitly marked incomplete. Monitor elapsed times restart per invocation; appended logs retain all attempts. Model load timing in summary describes the latest process; warmup history is retained.

Scoring implementation deviation from the initial plan: JiWER is absent and was not installed. asr_metrics.py uses standard-library unit-cost Levenshtein DP, with deterministic equal/substitution/deletion/insertion tie order. Corpus rates sum edit counts over reference counts; they are not mean per-record rates. Normalization v1: NFKC, lowercase, canonical internal apostrophes, dashes to spaces, other punctuation removed, whitespace collapsed; CER excludes whitespace; digits are not expanded. Empty normalized references fail. Raw text is preserved. This implementation is identified explicitly in reproducibility metadata and must not be reported as JiWER output. Equally optimal alignments can allocate S/D/I differently across implementations.

Validation: 28 unit/mock/native tests passed; no real speech inference was used. Includes fixed-set/scope rejection, known scoring fixtures and weighted rates, interrupted atomic writes, fake worker interruption/resume through all 100 records, warmup exclusion, native RAM/paging checks and owned-child termination. Protected application hashes validated unchanged. No dependency installation or environment repair occurred.

After manual execution, review numerical results before any base.en approval.

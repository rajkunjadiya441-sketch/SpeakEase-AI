# Word-level temporal accuracy methodology

## Ground truth and quality control

Use original 16-kHz mono LibriSpeech test-clean audio and the frozen transcripts already used by Phase 4. Independent annotators listen and inspect waveform/spectrogram boundaries while blinded to model output. Retain independent first passes, adjudicate disagreements by listening again, and preserve a review log. Ground truth uses seconds from original sample zero and includes no synthetic, interpolated or model-seeded timestamps. Reviewers attest with distinct IDs; software can check fields but cannot establish that independent listening occurred.

Every word in a recording must have a verified/adjudicated reference before that recording contributes any errors. First-pass, pending, uncertain, inaudible and transcript-conflict rows remain unscored. Missing rows, duplicate keys, wrong word/index/order, missing verified times, nonfinite/negative/reversed/zero-length/out-of-range times and overlapping reference intervals fail validation. Draft intervals, when present, also require valid chronological intervals. The templates contain all lexical words; no punctuation-only rows occur in this frozen dataset.

The completed full25 prediction sequence is an exact one-to-one match to the frozen original words. The standalone scorer explicitly requires this identity and fails closed on additions/deletions/reordering instead of guessing correspondence. It does not rerun alignment or modify predictions. A valid prediction has finite numeric bounds with 0 <= start < end <= duration + 0.01 s and chronological starts, preserving the Phase 4 prediction-validity convention. Invalid predictions are counted and excluded from paired errors, while coverage-aware denominators retain their reference boundaries.

## Metrics and denominators

For n valid paired words in fully verified recordings, let a_i = |predicted_start_i - reference_start_i| and b_i = |predicted_end_i - reference_end_i|, in seconds.

- Start MAE = sum(a_i)/n; end MAE = sum(b_i)/n.
- Combined boundary MAE = [sum(a_i)+sum(b_i)]/(2n).
- Median absolute boundary error is the median of all 2n pooled start/end errors.
- For each threshold t in {0.050, 0.100, 0.200} seconds, start and end percentages use their respective n errors. The pooled percentage uses 2n boundaries. All comparisons are inclusive with 1e-9-second floating-point tolerance.
- Coverage-aware all-reference percentages divide successful pooled boundaries by 2N, where N is all reference words in fully verified recordings. Invalid/missing predictions cannot count as within tolerance. Report these alongside paired-word counts and valid/invalid prediction counts to expose selective coverage.

Aggregate metrics pool word errors and counts across eligible recordings. They do not average recording-level means. No eligible ground truth means null temporal metrics. Unverified words never enter temporal denominators. A valid reference set with no valid predictions has null paired metrics and zero all-reference success percentages.

Every report identifies supplied, eligible and unverified/incomplete recording counts, eligible reference words, scored pairs, individual recording results and scope. A five-recording result remains partial_verified_subset even when every pilot row is verified. Only all 25 supplied and fully verified recordings can receive full_dataset scope. Alignment coverage measures availability of model timestamps and must never be described as timing accuracy.

## Limitations and reporting

Human boundary decisions have uncertainty from coarticulation, closures, low-energy segments, short words, speech rate and transcript segmentation. Millisecond display precision does not imply millisecond annotation reliability. Publish the boundary conventions and disagreement/adjudication procedure; quantify inter-annotator disagreement from preserved independent passes if that analysis is later performed. Do not invent agreement statistics now.

The duration-stratified five-recording pilot is a workflow check, not a random population estimate. The 25-recording subset is small, uses clean read speech and is not speaker balanced. Results cannot establish clinical, noisy-speech or spontaneous-speech performance. This evaluates forced alignment of supplied text, independently of ASR recognition accuracy. Difficult unresolved recordings must remain visible in annotation-coverage reporting.

An IEEE-style methods statement may read: “Word boundaries were independently annotated on original audio by two annotators blinded to system timestamps and adjudicated before comparison. Accuracy was evaluated only for recordings with complete verified reference intervals. Start and end MAE, pooled boundary MAE and median error, and boundary proportions within 50, 100 and 200 ms were computed from saved forced-alignment predictions. Aggregate estimates pooled word boundaries across eligible recordings.” Use this past tense only after those human actions actually occur.

A future results table should state scope (pilot/partial/full25), eligible/supplied/25 recording counts, verified and scored words, start/end/combined MAE and median in milliseconds, separate start/end and pooled threshold percentages, and all-reference threshold percentages. Include unmatched/invalid prediction counts and annotation coverage. Fill numerical cells only from a genuinely reviewed reference report; no timestamp accuracy results currently exist. Keep the Phase 4 performance results in a separate table.

## Reproducibility

Manifests freeze original Phase 4 CSV, prediction and subset-manifest hashes and audio hashes. Reports include annotation/manifest hashes and evaluation UTC time. Keep the scorer version or its SHA-256 with a published result. New output files are exclusively created; originals are never overwritten. Synthetic tests exercise formulas, eligibility, validation, partial scope and denominators without real model execution. See ANNOTATION_WORKFLOW.md for exact commands.

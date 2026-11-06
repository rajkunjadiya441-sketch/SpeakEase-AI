# Phase 5 independent word-boundary annotation

Prepared November 6, 2026. No manual annotations or real timestamp accuracy measurements have been completed. Phase 4 performance evaluation is complete; its older guides retain preparation-stage statements. Do not rerun their inference commands for this phase.

## Files and pilot selection

The original 457 rows exactly match the word indices and text of the frozen 25 recordings. Their timestamps are blank and all statuses are pending. Original CSV, subset manifest and full prediction result hashes are recorded in input_verification.json and both new manifests. None of these originals is edited. Templates are separate copies, with blank ground-truth fields.

Sort by duration, then word count, then recording ID (ascending); select duration ranks 1, 7, 13, 19 and 25. This deterministic choice uses no model boundaries or annotation outcomes. It spans lengths and word counts but is not a statistically representative random sample.

| Recording | Duration (s) | Words |
|---|---:|---:|
| 1580-141084-0043 | 2.065 | 7 |
| 8455-210777-0020 | 3.155 | 7 |
| 3729-6852-0026 | 4.690 | 12 |
| 1320-122617-0039 | 7.055 | 24 |
| 1188-133604-0028 | 19.005 | 44 |

The pilot has 94 words and 35.970 seconds of audio. pilot_manifest.json gives exact original audio paths and transcripts. full25_manifest.json preserves the original 25-recording order for eventual scoring. This adds manifests; it does not replace the frozen Phase 4 manifest.

## Manual procedure in Audacity

Use an already available Audacity installation or comparable waveform/spectrogram editor. Tool installation is outside this preparation. Give annotators only the original audio, transcripts, blank templates and this guide. Keep full_result.json, model timestamps and accuracy reports hidden until the reference is frozen.

1. From the project root, make separate copies of pilot_annotation_template.csv named pilot_annotator_A.csv and pilot_annotator_B.csv. Keep the delivered template untouched. Each annotator works independently without seeing the other's first pass.
2. In Audacity, use File > Open and select the original FLAC path listed in pilot_manifest.json. Work on one recording at a time. Confirm its ID and duration. Do not trim leading silence, resample, time-stretch the saved source or move the track. Time zero is original sample zero.
3. Listen to the complete recording alongside its exact reference transcript. Zoom into a phrase and switch between waveform and spectrogram views as useful. Replay with surrounding context; slower playback can help, but record positions on the original timeline. Do not infer boundaries by evenly dividing the phrase duration.
4. For each whitespace word, locate its earliest audible phonetic evidence and final audible phonetic evidence. Select that interval. Display the selection start and end in seconds with at least millisecond precision; record both numbers from the selection controls. Display precision is not a claim of millisecond human accuracy. A region label named with word index and exact word can help preserve the work. Save the Audacity project under a new name; keep source FLACs unchanged.
5. Enter decimal seconds in reference_start_seconds and reference_end_seconds for the matching CSV row. Preserve recording_id, one-based word_index, and word exactly, including apostrophes. Use a decimal point, not a locale comma. Mark a completed first pass annotated and fill annotator_id. Leave reviewer_id blank. Record uncertainty and decisions in notes. Do not mark your own pass verified.
6. Repeat for all 94 words, without deleting, adding, sorting or replacing rows. Save UTF-8 CSV with the existing header. Quote notes containing commas/newlines/quotes using normal CSV rules. Keep IDs as text. Audacity project or label files support your work but are not scored directly; the CSV is the import format.
7. Preserve both independent passes. A distinct reviewer compares them and listens to disputed boundaries. Reinspect every uncertainty; do not average two guesses automatically. Save a separate pilot_adjudicated.csv with verified or adjudicated status only after genuine review, nonempty distinct annotator_id and reviewer_id, and final boundaries. Keep a separate review log naming both passes, source IDs/hashes, disagreements, resolutions, conventions and protocol version. A single human cannot supply the independent-review attestation.
8. Validate the new CSV using the commands below. Fix errors only in your working copy. Before scoring, freeze the adjudicated CSV and retain its SHA-256 plus both first passes and review log. Scoring records the CSV and manifest hashes automatically. Do not adjust reference boundaries after viewing model errors; any later independent correction needs a new version and audit reason.

### Boundary conventions and difficult cases

Exclude leading/trailing silence and interword pauses. Contiguous words may share an endpoint; reference intervals must not overlap. For plosives, include an identifiable closure/release belonging to the word under a consistently documented convention; do not mistake a closure for an interword pause. Fricatives, breathy onsets and low-energy endings may require spectrogram inspection. Coarticulation often has no unique physical boundary: choose a defensible transition consistently and document uncertainty.

Short function words must be resolved in context, not stretched to consume silence or assigned zero-length intervals. Replay the phrase and inspect adjacent sounds. If a short word or token division cannot be defended, use uncertain or inaudible and explain why. Keep missing boundaries blank; do not invent them. If a word conflicts with the transcript, use unresolved_transcript and preserve the frozen text.

For overlapping speakers or sounds that prevent a reliable target boundary, record the issue and leave the word unverified. Do not force overlapping reference intervals into the scoring schema. The entire recording stays ineligible until the issue is independently resolved. Never silently drop difficult words or replace a difficult recording.

## Validation and scoring commands

Run PowerShell from C:\Users\RAJ\OneDrive\Desktop\speak-easeAI. Node.js v22.20.0 was available during preparation; only built-in modules are used. The existing Python environments currently point to a missing base interpreter and are not needed.

```powershell
node --test .\evaluation\scripts\test_phase5_accuracy.mjs
node .\evaluation\scripts\phase5_accuracy.mjs validate .\evaluation\phase5\pilot_manifest.json .\evaluation\phase5\pilot_adjudicated.csv
node .\evaluation\scripts\phase5_accuracy.mjs score .\evaluation\phase5\pilot_manifest.json .\evaluation\phase5\pilot_adjudicated.csv .\evaluation\phase5\pilot_accuracy_v1.json
```

The adjudicated file must be created manually first. These commands only read annotations, audio bytes and saved predictions; they never decode audio or launch inference. Validation reports unverified rows and eligible complete recordings. Structural errors return exit code 1. A structurally valid pending template is allowed, but is never accuracy eligible. Scoring pending input returns unavailable with null errors, not zero MAE. Output files use exclusive creation and cannot overwrite an existing file; choose a new version name when needed.

For eventual full25 annotation, copy full25_annotation_template.csv to full25_adjudicated.csv. Transfer reviewed pilot values by exact recording_id + word_index + word, leaving the other original rows pending, then manually annotate/review the rest. Preserve all 457 rows in original order. Never overwrite the Phase 4 reference CSV.

```powershell
node .\evaluation\scripts\phase5_accuracy.mjs validate .\evaluation\phase5\full25_manifest.json .\evaluation\phase5\full25_adjudicated.csv
node .\evaluation\scripts\phase5_accuracy.mjs score .\evaluation\phase5\full25_manifest.json .\evaluation\phase5\full25_adjudicated.csv .\evaluation\phase5\full25_accuracy_v1.json
```

Import consists of passing the separate completed CSV to this offline scorer. Do not resume Phase 4 or replace its frozen inputs. A pilot result is always partial relative to 25. Full-dataset accuracy requires all 25 recordings to be completely verified; incomplete recordings contribute no boundary errors.

# Milestone 5A frontend audit

Date: October 30, 2026. Branch: frontend-completion. Working tree was clean before this work. Scope: ipd_frontend only; no commits or pushes.

## Existing working features

All 16 primary routes already exist: nine therapist screens (dashboard, patients, patient profile, targets, generator, assignments, attempt review, analytics, settings) and seven patient screens (home, practice list, exercise details, practice session, history, progress, profile). Existing cards/buttons/badges/modals, indigo therapist styling, teal patient styling, responsive sidebar/bottom navigation, localStorage services, patient/target CRUD, generation/edit/approval wizard, assignment repetition tracking, portal switching and microphone capture are present. Preserve these rather than recreate them.

## Incomplete or missing behavior found in code

- Practice writes the target as a fabricated transcript and fabricates acoustic observations; no analysis results screen or word seeking exists.
- MediaRecorder supports MP4/OGG fallbacks that the backend rejects; no 30-second/10-MiB cap, Blob export, safe permission/unmount cancellation or complete recorder cleanup.
- Existing AudioPlayer has a visual progress bar, no seeking control, and a fabricated three-second duration fallback. Attempt pages synthesize expected text when patient audio is absent.
- Saved blob URLs cannot survive page reload. Attempt service invents transcript/evidence defaults. Review page has no feedback editor or pending/reviewed workflow.
- History lacks detailed results/review status; progress has no recent-attempt list and labels completion as mastery.
- Patient history lacks a main navigation entry. Same-page patient switching/global search can leave stale state. Notifications button is inert.
- Settings reports success but does not persist. Assignment selection includes drafts and lacks service-level patient/approval/repetition validation.

## Backend-dependent features

Real speech analysis, persisted multi-user data/auth, actual exercise generation, recording uploads/storage and clinical progress need future APIs. All existing services currently use local demo storage. Milestone 5A must not send requests to the speech API or create fake endpoints.

## Contract check

Read the actual backend FastAPI route and response model: POST /speech/analyze uses multipart **file** plus optional expected_text, not audio. Words contain word/start/end; alignment_status is completed/partial/failed/skipped; alignment_error and unaligned_words are separate. Live /openapi.json could not be fetched (no server listening); backend/.venv cannot start because its base Python 3.11 executable is missing and py lists no installations. Do not repair Python or modify the backend within this scope. Final live OpenAPI verification must be repeated before Milestone 5B; frontend types are provisional, source-verified and demo-only.

## Planned modifications

Recorder hook; shared AudioPlayer and new SpeechAnalysisResults; demo analysis fixtures and isolated preview page; practice/results/history/review pages; attempt/local storage services; lightweight speech contract utilities; progress labels/recent attempts; targeted navigation/settings/assignment fixes. Add frontend-only tests/docs. Keep existing styles and working CRUD/generator flows. No runtime dependency additions planned.

## Outcome

Milestone 5A completed. The listed gaps were addressed; existing CRUD/generator flows retained. Final production build passes, lint has 0 errors/86 warnings, and all 36 browser checks pass including reloaded native playback. Live OpenAPI/runtime verification and real microphone hardware remain explicitly outstanding. See MILESTONE_5A.md for full results and file inventory. No live API integration was performed.

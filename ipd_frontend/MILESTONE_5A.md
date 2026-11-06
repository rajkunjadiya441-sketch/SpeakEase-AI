# Milestone 5A handoff

Date: October 30, 2026 (Asia/Calcutta). Branch: frontend-completion. Status: frontend completion and offline demonstration verified; STOP before live integration.

## Audit and retained functionality

All nine therapist and seven patient screens already existed. Existing patient/target CRUD, the configure/generate/edit/approve exercise wizard, assignment dispatch, dashboards, analytics, profiles, responsive portal layouts and design tokens were preserved. Initial build passed. Initial lint exited 0 with warnings; no test script existed. See AUDIT.md for the code-based findings before implementation.

## Completed features

- Patient practice: assigned exercise/target/expected text/instructions; reference TTS explicitly labeled synthetic; MediaRecorder start/stop/timer/meter; permission/unsupported-device errors; final Blob export; record again; 30-second and 10-MiB checks; automatic stop margin; safe cancellation/late permission/reset/unmount cleanup.
- Shared AudioPlayer: native audio playback, pause/replay, range seeking, current time/duration, errors and missing-audio notice; recognized word chips highlight and seek/replay actual media. It never substitutes synthetic reference speech for patient recordings.
- Shared SpeechAnalysisResults: expected and recognized speech kept separate, completed/processing/error/unavailable results, actual-recording not-analyzed state, partial/missing-word messaging and neutral therapist-review guidance. No scoring or generated clinical observations.
- Labeled results preview: separate route with idle, recording, recorded, processing, completed, unavailable and error examples. Processing shows the required around-20-seconds message without fake percentages. Playback fixture is a synthetic tone, clearly labeled; example output is not attached to live captured audio.
- New local recordings persist as data URLs in existing localStorage; failures surface quota errors. Real transcripts are never guessed from expected_text. Old ephemeral blob URLs are shown unavailable. Seed attempts remain explicitly demo data.
- Therapist attempt review: patient/search/status filters, exercise instructions, shared results/playback, feedback editor, pending/reviewed state and persistence. Query-string filters allow patient-profile and notification deep links.
- Patient history/details: review status, recordings, expected text, results and therapist feedback; patient-specific attempt lookup and missing-attempt errors. Added a history navigation entry. Progress includes recordings/tasks finished/targets/recent attempts, without completion-as-mastery labels.
- Targeted fixes: same-route patient switching refreshes patient screens and tears down capture; patient-specific exercise guards; global patient search reacts to URL changes; notification button opens pending reviews; settings persist and populate assignment defaults; unsupported sampling selector is now an honest read-only browser format display; assignments validate patient ownership, approval, repetition bounds and date; completed repetitions are capped.
- Offline interface preparation: source-verified SpeechAnalysisResponse JSDoc typedef, SPEECH_CONTRACT and prepareSpeechForm. Correct multipart key is file, not audio. No fetch-based speech adapter or fake server endpoint added.

## Actual verification

- npm run build: PASS (Vite 8.3.5; final observed 1.07 s, JS bundle about 448.7 kB / 125.4 kB gzip).
- npm run lint: exit 0, 0 errors, 86 warnings. Existing unused imports/variables and effect/dependency warnings remain; no rule suppression or unrelated repository-wide cleanup.
- npm test: 36 PASS, 0 FAIL. Full results below. Browser tests use installed Chrome/CDP, React in a dedicated test page, mocked MediaRecorder/devices and real HTML audio playback. No additional testing or audio library installed.
- Reload persistence: true. The test saved a controlled WAV through the real practice UI, loaded normal attempt-details UI after a full page navigation, and checked native media metadata plus saved review status.
- Visual inspection: desktop results, mobile results at 390x844, desktop practice and therapist review screenshots inspected. Mobile scroll width equals viewport width (390 px). Existing indigo/teal cards/sidebar/typography and responsive navigation retained.
- git diff --check: no whitespace errors. Branch unchanged. No commit, merge or push.

Browser checks:

- Recorder start/stop produces Blob; resource cleanup; record again: PASS
- Denied microphone permission shows recoverable error: PASS
- Permission resolved after cancellation stops tracks: PASS
- Automatic recording duration limit: PASS
- Unmount while recording stops hardware tracks: PASS
- WAV/WebM selection and unsupported-format rejection: PASS
- Offline multipart contract uses file, not audio; no network: PASS
- Local recording persists without fake recognition and therapist feedback updates: PASS
- Local quota errors are surfaced rather than fake saves: PASS
- Assignment rejects drafts, wrong patients and fractional repetitions: PASS
- Existing patient/target CRUD and generator approval flow: PASS
- Route renders /therapist/dashboard: PASS
- Route renders /therapist/patients: PASS
- Route renders /therapist/patients/p-1: PASS
- Route renders /therapist/targets: PASS
- Route renders /therapist/exercise-generator: PASS
- Route renders /therapist/assignments: PASS
- Route renders /therapist/attempts: PASS
- Route renders /therapist/progress: PASS
- Route renders /therapist/settings: PASS
- Route renders /patient/home: PASS
- Route renders /patient/practice: PASS
- Route renders /patient/practice/details/ex-2: PASS
- Route renders /patient/practice/session/ex-2?assignmentId=as-2: PASS
- Route renders /patient/history: PASS
- Route renders /patient/history/att-1: PASS
- Route renders /patient/progress: PASS
- Route renders /patient/profile: PASS
- Route renders /patient/results-preview: PASS
- Practice UI record, retry, submit and attempt details without fake analysis: PASS
- Settings form persists local defaults and exposes actual format limits: PASS
- Therapist review saves via form UI: PASS
- History empty state and invalid attempt details: PASS
- Results processing/unavailable/error states: PASS
- Shared word click highlights and seeks actual audio element: PASS
- No uncaught browser errors: PASS

Initial browser attempt had 32/34 checks pass: the draft test accidentally selected approved ex-3 instead of draft ex-4, and virtual-time playback did not load metadata. Corrected the seed selection and used a real-time headless browser connection. The later practice UI test exposed async readiness assumptions in the test (fixed by waiting for loaded controls). The settings test caught an unapplied edit to the inert quality selector; that actual control was corrected. Final 36/36 pass.

The browser plugin itself could not start (missing temporary kernel.js); installed Chrome in an isolated qa/ profile provided the executed fallback. No real microphone was granted or captured in automated tests. A manual hardware/permission check is still required before a live voice demo.

## Demo data and outstanding backend work

All account/clinical workflow data is still local demo data: patients, targets, generation, exercises, assignments, attempts, review notes, progress counts and settings. New recordings are genuine browser capture when a person uses the UI, but this milestone deliberately does not analyze them. Seed transcripts and results-preview examples are labeled demo; no actual ASR/alignment request is sent.

Backend OpenAPI could not be inspected live: no server listening at 127.0.0.1:8000, missing Python executable referenced by backend/.venv and py reports no installed Pythons. The actual FastAPI request/response source was inspected read-only. Types remain provisional until Python is restored and /openapi.json is available. This is outside the authorized frontend-only scope; no Python/environment/backend files changed.

LocalStorage is intentionally a demo mechanism, not a new database or server storage. Its quota can reject recordings smaller than 10 MiB after base64 expansion; the save then reports an error. Actual browser audio encoding and microphone hardware still require a manual test. No new authentication, cloud persistence, API keys, models, database or speech dependencies added.

## Files created or modified

- .gitignore
- package.json
- src/App.jsx
- src/components/layout/PatientLayout.jsx
- src/components/layout/TherapistLayout.jsx
- src/components/ui/AudioPlayer.jsx
- src/hooks/useAudioRecorder.js
- src/mocks/storage.js
- src/pages/patient/AssignedPracticePage.jsx
- src/pages/patient/ExerciseDetailPage.jsx
- src/pages/patient/PatientHomePage.jsx
- src/pages/patient/PatientProfileSettingsPage.jsx
- src/pages/patient/PatientProgressPage.jsx
- src/pages/patient/PracticeHistoryPage.jsx
- src/pages/patient/PracticeSessionPage.jsx
- src/pages/therapist/AttemptReviewPage.jsx
- src/pages/therapist/ExerciseAssignmentPage.jsx
- src/pages/therapist/PatientProfilePage.jsx
- src/pages/therapist/PatientsPage.jsx
- src/pages/therapist/SettingsPage.jsx
- src/pages/therapist/TherapistDashboard.jsx
- src/services/assignmentService.js
- src/services/attemptService.js
- src/services/progressService.js
- src/services/targetService.js
- AUDIT.md
- public/demo-tone.wav
- src/components/ui/SpeechAnalysisResults.jsx
- src/hooks/useActivePatient.js
- src/mocks/speechFixtures.js
- src/pages/patient/AttemptDetailsPage.jsx
- src/pages/patient/SpeechResultsPreviewPage.jsx
- src/services/speechService.js
- src/utils/speech.js
- tests/browser.html
- tests/browser.jsx
- tests/run-browser.mjs
- README.md (updated documentation)
- MILESTONE_5A.md (this handoff)

Generated ignored qa/ contains browser-results.json, lint reports, screenshots and isolated browser profiles; dist and Vite caches are existing ignored build outputs. No changes were made outside ipd_frontend. package-lock.json and runtime dependencies are unchanged; package.json only adds the browser test command.

## Review and resume

Use npm run dev on port 5173. Patient practice is /patient/practice; labeled preview is /patient/results-preview; review is /therapist/attempts; history/details are /patient/history and /patient/history/:id. Existing navigation/portal switcher remains available. The dev server was left running for review.

Next recommended milestone: Milestone 5B, with explicit approval, restore/verify the existing backend runtime, fetch actual OpenAPI, implement a real multipart file + expected_text adapter with an HTTP timeout longer than backend processing, and test real recording-to-results/failure paths. Do not automatically proceed. Persistent alignment performance improvements also require separate approval.

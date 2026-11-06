import { recordingStore } from './recordingStore';
import { storage } from '../mocks/storage';
import { apiClient } from './apiClient';
import { validateSpeechResponse } from './speechService';
import { validateRecording } from '../utils/speech';
const normalize = a => ({ ...a, audioBlobUrl: a.audioBlobUrl?.startsWith('blob:') ? null : a.audioBlobUrl, source: a.source || 'demo_fixture', reviewStatus: a.reviewStatus || (a.notes ? 'REVIEWED' : 'PENDING'), transcript: a.transcript || '', recognitionEvidence: '', analysis: a.analysis || null });
const sorted = () => storage.getAttempts().map(normalize).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
const join = a => ({ ...a, patient: storage.getPatients().find(p => p.id === a.patientId), exercise: storage.getExercises().find(e => e.id === a.exerciseId), target: storage.getTargets().find(t => t.id === a.targetId) });
export const attemptService = {
  async getAttemptsByPatient(patientId) { await apiClient.mockDelay(140); return sorted().filter(a => a.patientId === patientId).map(join); },
  async getAllAttempts() { await apiClient.mockDelay(140); return sorted().map(join); },
  async getAttemptById(id) { const attempt = sorted().find(a => a.id === id); if (!attempt) throw new Error('Attempt not found.'); return join(attempt); },
  async createAttempt(payload) {
    validateRecording(payload.audioBlob, payload.recordingDuration);
    const id = payload.id || 'att-' + crypto.randomUUID();
    const existing = storage.getAttempts().find(attempt => attempt.id === id);
    if (existing) return join(normalize(existing));
    const analysis = payload.analysis == null ? null : validateSpeechResponse(payload.analysis);
    if (payload.signal?.aborted) throw new DOMException('Save cancelled', 'AbortError');
    await recordingStore.put(id, payload.audioBlob);
    const attempt = { id, assignmentId: payload.assignmentId || null, submittedAt: payload.submittedAt || new Date().toISOString(), patientId: payload.patientId, exerciseId: payload.exerciseId, targetId: payload.targetId, audioId: id, audioBlobUrl: null, audioMimeType: payload.audioBlob.type, audioSize: payload.audioBlob.size, recordingDuration: analysis?.duration_seconds ?? payload.recordingDuration, targetText: payload.targetText || '', transcript: analysis?.transcript ?? '', analysis, recognitionEvidence: '', notes: '', reviewStatus: 'PENDING', source: analysis ? 'real_analysis' : 'local_recording', createdAt: new Date().toISOString() };
    // Publish metadata only after the binary transaction commits. Roll back audio on metadata failure.
    try {
      if (payload.signal?.aborted) throw new DOMException('Save cancelled', 'AbortError');
      storage.setAttempts([attempt, ...storage.getAttempts()]);
    } catch (error) {
      try { await recordingStore.remove(id); } catch { /* A failed rollback may leave an orphan Blob, but never a successful save. */ }
      throw error;
    }
    try { storage.setPatients(storage.getPatients().map(p => p.id === payload.patientId ? { ...p, lastPracticeDate: attempt.createdAt } : p)); } catch { /* The recording was saved; a metadata quota error does not discard it. */ }
    return join(attempt);
  },
  async reviewAttempt(id, notes, reviewStatus = 'REVIEWED') {
    if (!['PENDING','REVIEWED'].includes(reviewStatus)) throw new Error('Invalid review status.');
    if (notes.length > 4000) throw new Error('Feedback must be 4,000 characters or fewer.');
    let found;
    const attempts = storage.getAttempts().map(a => { if (a.id !== id) return a; found = { ...a, notes: notes.trim(), reviewStatus, reviewedAt: reviewStatus === 'REVIEWED' ? new Date().toISOString() : null }; return found; });
    if (!found) throw new Error('Attempt not found.');
    storage.setAttempts(attempts); return join(normalize(found));
  },
};

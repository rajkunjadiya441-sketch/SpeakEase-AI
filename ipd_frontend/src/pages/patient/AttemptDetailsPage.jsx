import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { SpeechAnalysisResults } from '../../components/ui/SpeechAnalysisResults';
import { attemptService } from '../../services/attemptService';
import { useActivePatient } from '../../hooks/useActivePatient';
import { formatDateTime } from '../../utils/formatters';
export function AttemptDetailsPage() {
  const { id } = useParams(), patientId = useActivePatient();
  const [attempt,setAttempt] = useState(null), [error,setError] = useState('');
  useEffect(() => { let active = true; attemptService.getAttemptById(id).then(a => { if (a.patientId !== patientId) throw new Error('Attempt not available for the selected patient.'); if (active) setAttempt(a); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [id,patientId]);
  return <div className="space-y-5"><Link to="/patient/history" className="text-sm text-[#5865E8]">Back to Practice History</Link><h1 className="text-2xl font-bold">Attempt Details</h1>{error ? <p role="alert">{error}</p> : !attempt ? <p role="status">Loading attempt...</p> : <><Card className="space-y-3"><h2 className="font-semibold">{attempt.exercise?.title || 'Practice attempt'}</h2><p className="text-xs text-[#687386]">{formatDateTime(attempt.createdAt)}</p><Badge variant={attempt.reviewStatus === 'REVIEWED' ? 'success' : 'warning'}>{attempt.reviewStatus === 'REVIEWED' ? 'Reviewed' : 'Pending review'}</Badge><h3 className="text-sm font-semibold">Therapist feedback</h3><p className="text-sm text-[#687386] whitespace-pre-wrap">{attempt.notes || 'No feedback yet. Your therapist can review this attempt.'}</p></Card><SpeechAnalysisResults expectedText={attempt.targetText} analysis={attempt.analysis || (attempt.source === 'demo_fixture' ? { transcript: attempt.transcript, words: [], alignment_status: 'failed', alignment_error: 'Seed demo attempt: no real analysis or recording attached.' } : null)} audioSrc={attempt.audioBlobUrl} recordingId={attempt.audioId} duration={attempt.recordingDuration} demo={attempt.source === 'demo_fixture'} /></>}</div>;
}

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Mic, Square, RotateCcw, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { AudioPlayer } from '../../components/ui/AudioPlayer';
import { SpeechAnalysisResults } from '../../components/ui/SpeechAnalysisResults';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useActivePatient } from '../../hooks/useActivePatient';
import { exerciseService } from '../../services/exerciseService';
import { targetService } from '../../services/targetService';
import { assignmentService } from '../../services/assignmentService';
import { attemptService } from '../../services/attemptService';
import { analyzeRecording } from '../../services/speechService';
import { mediaTime, recordingBrowserNotice } from '../../utils/speech';

export function PracticeSessionPage() {
  const { id } = useParams(), [params] = useSearchParams(), navigate = useNavigate();
  const patientId = useActivePatient(), assignmentId = params.get('assignmentId');
  const [exercise,setExercise] = useState(null), [target,setTarget] = useState(null), [assignment,setAssignment] = useState(null), [loading,setLoading] = useState(true), [error,setError] = useState(''), [saving,setSaving] = useState(false), [saved,setSaved] = useState(null);
  const recorder = useAudioRecorder();
  const [analysis,setAnalysis] = useState(null), [phase,setPhase] = useState('idle'), [elapsed,setElapsed] = useState(0);
  const submission = useRef(null), request = useRef(null), busy = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current?.abort(); }; }, []);
  useEffect(() => {
    if (phase !== 'processing') return;
    const started = performance.now();
    const timer = setInterval(() => setElapsed(Math.floor((performance.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try { const ex = await exerciseService.getExerciseById(id); if (ex.patientId !== patientId) throw new Error('This exercise is not available for the selected patient.'); const t = ex.targetId ? await targetService.getTargetById(ex.targetId) : null; const assignments = await assignmentService.getAssignmentsByPatient(patientId); const assigned = assignments.find(a => a.id === assignmentId && a.exerciseId === id); if (assignmentId && !assigned) throw new Error('This assignment is not available for the selected patient.'); if (!cancelled) { setExercise(ex); setTarget(t); setAssignment(assigned || null); } }
      catch (e) { if (!cancelled) setError(e.message); }
      finally { if (!cancelled) setLoading(false); }
    } load(); return () => { cancelled = true; };
  }, [id, patientId, assignmentId]);
  const prompt = exercise?.content?.prompt || target?.value || '';
  async function submit() {
    if (busy.current || saved) return;
    busy.current = true;
    const controller = new AbortController(); request.current = controller;
    setSaving(true); setError('');
    try {
      if (!submission.current) {
        setElapsed(0); setPhase('processing');
        const submittedAt = new Date().toISOString();
        const response = await analyzeRecording({ file: recorder.audioBlob, expectedText: prompt, duration: recorder.recordingDuration, signal: controller.signal });
        if (!mounted.current || controller.signal.aborted) return;
        submission.current = { id: 'att-' + crypto.randomUUID(), analysis: response, submittedAt };
        setAnalysis(response);
      }
      setPhase('saving');
      const attempt = await attemptService.createAttempt({ ...submission.current, assignmentId, patientId, exerciseId: id, targetId: target?.id, audioBlob: recorder.audioBlob, recordingDuration: recorder.recordingDuration, targetText: prompt, signal: controller.signal });
      if (!mounted.current) return;
      setSaved(attempt); setPhase('completed');
      if (assignmentId && assignment?.status !== 'COMPLETED') {
        try { const updated = await assignmentService.recordPracticeAttempt(assignmentId); if (mounted.current) setAssignment(updated); }
        catch { if (mounted.current) setError('Analysis and recording were saved, but repetition progress could not be updated.'); }
      }
    } catch (e) {
      if (mounted.current) {
        setPhase('error');
        setError(submission.current ? 'Analysis completed, but local storage could not save this attempt. ' + e.message + ' Your results remain visible; retry saving without sending another analysis request.' : e.message);
      }
    } finally {
      busy.current = false; request.current = null;
      if (mounted.current) setSaving(false);
    }
  }
  function again() {
    if (busy.current) return;
    recorder.resetRecording(); submission.current = null; setAnalysis(null); setSaved(null); setError(''); setPhase('idle'); setElapsed(0);
  }
  if (loading) return <p role="status" className="text-sm text-[#687386] py-12">Setting up practice room...</p>;
  if (!exercise) return <Card><p role="alert">{error || 'Exercise not found.'}</p><Button className="mt-4" onClick={() => navigate('/patient/practice')}>Back to My Practice</Button></Card>;
  return <div className="space-y-6 max-w-2xl mx-auto">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link to="/patient/practice" className="flex items-center gap-2 text-xs font-semibold text-[#687386]"><ArrowLeft className="w-4 h-4" />Exit Session</Link><Badge variant="teal">{assignment ? Math.min(assignment.completedRepetitions, assignment.repetitions) + ' / ' + assignment.repetitions + ' repetitions finished' : 'Practice repetition'}</Badge></div>
    {recordingBrowserNotice() && <p role="note" className="p-3 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl">{recordingBrowserNotice()} History is local to each browser and origin; existing attempts do not automatically move between them.</p>}
    <Card className="p-6 sm:p-10 space-y-6 text-center">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{exercise.title}</p><Badge variant="teal">{target?.type || exercise.level}</Badge><p className="text-sm text-[#687386] mt-3">{exercise.instructions || 'Follow your therapist practice instructions.'}</p></div>
      <div className="py-6 px-4 bg-gradient-to-br from-[#F7F8FC] to-white rounded-2xl border border-[#E5E9F2]"><p className="text-xs text-[#687386] mb-2">Expected practice text</p><h1 className="text-3xl sm:text-4xl font-black break-words">{prompt}</h1>{target && <p className="text-sm text-[#5865E8] mt-2">Target: {target.value}</p>}</div>
      <AudioPlayer speechText={prompt} title="Reference voice (synthetic)" />
      <p className="text-xs text-[#687386]">Maximum 30 seconds / 10 MiB. Recording stops just before the time limit. Submission sends your recording to the speech backend. Results and audio are saved in this browser for therapist review.</p>
      {(error || recorder.errorMessage) && <p role="alert" className="p-4 text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-xl">{error || recorder.errorMessage}</p>}
      {!saved && <div className="space-y-4">
        {['ready','error'].includes(recorder.recordingState) && <Button variant="secondary" size="xl" leftIcon={Mic} onClick={recorder.startRecording}>Start Recording</Button>}
        {recorder.recordingState === 'requesting' && <p role="status">Waiting for microphone permission... <button type="button" className="text-[#5865E8] underline" onClick={recorder.resetRecording}>Cancel</button></p>}
        {recorder.recordingState === 'recording' && <><div aria-hidden="true" className="h-10 flex items-center justify-center gap-1">{Array.from({length:9},(_,i) => <span key={i} className="w-2 bg-[#DC5A65] rounded-full" style={{height: Math.max(10, recorder.audioLevel*(0.5+i%3/4))+'%'}} />)}</div><p role="status" className="font-mono text-[#DC5A65]">Recording {mediaTime(recorder.recordingDuration)} / 0:30</p><Button variant="danger" leftIcon={Square} onClick={recorder.stopRecording}>Stop Recording</Button></>}
        {recorder.recordingState === 'stopping' && <p role="status">Finishing recording...</p>}
        {recorder.recordingState === 'stopped' && <><AudioPlayer src={recorder.audioUrl} durationSeconds={recorder.recordingDuration} title="Your recording" /><div className="flex flex-wrap justify-center gap-3"><Button variant="outline" disabled={saving} leftIcon={RotateCcw} onClick={again}>Record Again</Button><Button variant="secondary" isLoading={saving} onClick={submit}>{analysis ? 'Retry Save' : 'Submit for Analysis'}</Button></div><p className="text-xs text-[#687386]">Only the backend response is used for transcripts and timings. No demo result is substituted.</p></>}
        {phase === 'processing' && <div className="space-y-2"><p role="status" className="font-mono text-sm text-[#687386]">Elapsed: {mediaTime(elapsed)}</p>{elapsed >= 20 && <p className="text-xs text-[#687386]">Some recordings take longer. You can keep waiting or cancel; your recording remains available.</p>}<Button variant="outline" onClick={() => request.current?.abort()}>Cancel Analysis</Button></div>}
        {phase === 'saving' && <p role="status" className="text-sm text-[#687386]">Saving your actual analysis and recording locally...</p>}
      </div>}
      {saved && <div className="space-y-4"><CheckCircle2 className="mx-auto text-[#2BAE9B] w-10 h-10" /><p className="font-semibold">Analysis and recording saved for therapist review.</p>{assignment?.status === 'COMPLETED' && <p>Practice tasks finished. Completion does not indicate mastery.</p>}<div className="flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={again}>Practise Again</Button><Button variant="secondary" onClick={() => navigate('/patient/history/' + saved.id)}>View Attempt Details</Button></div></div>}
    </Card>
    <p className="text-xs text-[#687386]">History and feedback are stored locally for this demonstration. Browser storage is not secure clinical record storage.</p>
    {(phase === 'processing' || analysis || phase === 'error') && <SpeechAnalysisResults expectedText={prompt} analysis={analysis} audioSrc={saved ? saved.audioBlobUrl : recorder.audioUrl} recordingId={saved?.audioId} duration={analysis?.duration_seconds || recorder.recordingDuration} state={phase === 'processing' ? 'processing' : !analysis && phase === 'error' ? 'error' : 'completed'} errorMessage={error} />}
    <Link className="text-xs text-[#5865E8] underline" to="/patient/results-preview">Preview labeled demo analysis results</Link>
  </div>;
}

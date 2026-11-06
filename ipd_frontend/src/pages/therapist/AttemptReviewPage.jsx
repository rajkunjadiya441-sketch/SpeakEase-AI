import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Headphones, Search } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { SpeechAnalysisResults } from '../../components/ui/SpeechAnalysisResults';
import { attemptService } from '../../services/attemptService';
import { patientService } from '../../services/patientService';
import { formatDateTime } from '../../utils/formatters';

function ReviewCard({ attempt, onSaved }) {
  const [notes,setNotes] = useState(attempt.notes || ''), [saving,setSaving] = useState(false), [error,setError] = useState('');
  async function save(status) { setSaving(true); setError(''); try { onSaved(await attemptService.reviewAttempt(attempt.id,notes,status)); } catch(e) { setError(e.message); } finally { setSaving(false); } }
  return <Card className="space-y-4">
    <div className="flex flex-wrap justify-between gap-3 border-b border-[#E5E9F2] pb-3"><div><h2 className="font-bold">{attempt.patient?.name || 'Patient'}</h2><p className="text-xs text-[#687386]">{attempt.exercise?.title || 'Practice attempt'} | {formatDateTime(attempt.createdAt)}</p><p className="text-xs text-[#687386] mt-2">{attempt.exercise?.instructions || 'No additional exercise instructions.'}</p></div><div className="space-x-2"><Badge variant={attempt.reviewStatus === 'REVIEWED' ? 'success' : 'warning'}>{attempt.reviewStatus === 'REVIEWED' ? 'Reviewed' : 'Pending review'}</Badge><Link className="text-xs text-[#5865E8]" to={'/therapist/patients/' + attempt.patientId}>Patient Profile</Link></div></div>
    <SpeechAnalysisResults expectedText={attempt.targetText} analysis={attempt.analysis || (attempt.source === 'demo_fixture' ? { transcript: attempt.transcript, words: [], alignment_status: 'failed', alignment_error: 'Seed demo data: no real analysis or recording attached.' } : null)} audioSrc={attempt.audioBlobUrl} recordingId={attempt.audioId} duration={attempt.recordingDuration} demo={attempt.source === 'demo_fixture'} />
    <form onSubmit={event => { event.preventDefault(); save('REVIEWED'); }} className="space-y-3"><label className="block text-sm font-semibold">Therapist feedback<textarea maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} className="block w-full text-sm font-normal mt-2 p-3 rounded-lg border border-[#E5E9F2] focus:outline-none focus:ring-2 focus:ring-[#5865E8]" rows={3} placeholder="Add neutral observations and practice guidance..." /></label>{error && <p role="alert" className="text-xs text-red-700">{error}</p>}<div className="flex flex-wrap gap-2"><Button type="submit" isLoading={saving}>Save Feedback & Mark Reviewed</Button><Button variant="outline" disabled={saving} onClick={() => save('PENDING')}>Mark Pending</Button></div></form>
  </Card>;
}
export function AttemptReviewPage() {
  const [params,setParams] = useSearchParams();
  const [attempts,setAttempts] = useState([]), [patients,setPatients] = useState([]), [search,setSearch] = useState(''), [loading,setLoading] = useState(true), [error,setError] = useState('');
  useEffect(() => { let active=true; Promise.all([attemptService.getAllAttempts(),patientService.getPatients()]).then(([a,p]) => { if(active){setAttempts(a);setPatients(p);} }).catch(e => {if(active)setError(e.message);}).finally(() => {if(active)setLoading(false);}); return () => {active=false;}; }, []);
  const patient = params.get('patientId') || 'ALL', status = params.get('status') || 'ALL';
  const setPatient = value => { const next = new URLSearchParams(params); next.set('patientId',value); setParams(next); };
  const setStatus = value => { const next = new URLSearchParams(params); next.set('status',value); setParams(next); };
  const filtered=attempts.filter(a => (patient==='ALL'||a.patientId===patient) && (status==='ALL'||a.reviewStatus===status) && [a.patient?.name,a.targetText,a.transcript,a.exercise?.title].some(value => value?.toLowerCase().includes(search.toLowerCase().trim())));
  return <div className="space-y-6"><div><h1 className="text-2xl sm:text-3xl font-bold flex gap-2 items-center"><Headphones className="text-purple-700" />Attempt Review & Clinical Listening</h1><p className="text-sm text-[#687386] mt-2">Review practice recordings and save therapist feedback. Recognition and timing are not pronunciation scores.</p></div><Card className="grid md:grid-cols-3 gap-3 p-4"><label className="relative"><span className="sr-only">Search attempts</span><Search className="absolute top-3 left-3 w-4 h-4 text-slate-400" /><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search patients or practice text" className="w-full border border-[#E5E9F2] rounded-lg p-2 pl-9 text-sm" /></label><Select label="Patient" value={patient} onChange={e=>setPatient(e.target.value)} options={[{value:'ALL',label:'All Patients'},...patients.map(p=>({value:p.id,label:p.name}))]} /><Select label="Review status" value={status} onChange={e=>setStatus(e.target.value)} options={[{value:'ALL',label:'All statuses'},{value:'PENDING',label:'Pending review'},{value:'REVIEWED',label:'Reviewed'}]} /></Card>{error && <p role="alert">{error}</p>}{loading ? <p role="status">Loading attempts...</p> : filtered.length ? filtered.map(a=><ReviewCard key={a.id} attempt={a} onSaved={updated=>setAttempts(prev=>prev.map(item=>item.id===updated.id?updated:item))} />) : <Card className="text-center text-sm text-[#687386] py-12">No attempts match these filters.</Card>}</div>;
}

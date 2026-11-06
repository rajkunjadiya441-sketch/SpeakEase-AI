import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { AudioPlayer } from '../../components/ui/AudioPlayer';
import { availableTimingWords } from '../../services/speechService';
import { attemptService } from '../../services/attemptService';
import { useActivePatient } from '../../hooks/useActivePatient';
import { formatDateTime } from '../../utils/formatters';
export function PracticeHistoryPage() {
  const patientId=useActivePatient();
  const [attempts,setAttempts]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let active=true;attemptService.getAttemptsByPatient(patientId).then(a=>{if(active)setAttempts(a);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[patientId]);
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">My Practice History</h1><p className="text-sm text-[#687386] mt-2">{attempts.length} recordings | {attempts.filter(a=>a.reviewStatus==='REVIEWED').length} reviewed. Open an attempt for results and therapist feedback.</p></div>{error&&<p role="alert">{error}</p>}{loading?<p role="status">Loading history...</p>:attempts.length?attempts.map(a=><Card key={a.id} className="space-y-3"><div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-bold">{a.exercise?.title || a.targetText}</h2><p className="text-xs text-[#687386]">{formatDateTime(a.createdAt)}</p></div><Badge variant={a.reviewStatus==='REVIEWED'?'success':'warning'}>{a.reviewStatus==='REVIEWED'?'Reviewed':'Pending review'}</Badge></div><p className="text-sm">Expected text: {a.targetText}</p><Badge variant="default">{a.source==='demo_fixture'?'Demo seed attempt':'Local recording'}</Badge><AudioPlayer src={a.audioBlobUrl} recordingId={a.audioId} words={availableTimingWords(a.analysis)} durationSeconds={a.recordingDuration} title="Attempt recording" /><Link className="inline-block text-sm font-semibold text-[#5865E8]" to={'/patient/history/'+a.id}>View Attempt Details</Link></Card>):<Card className="text-center py-12"><p>No practice attempts yet.</p><Link className="text-[#2BAE9B]" to="/patient/practice">Choose a practice exercise</Link></Card>}</div>;
}

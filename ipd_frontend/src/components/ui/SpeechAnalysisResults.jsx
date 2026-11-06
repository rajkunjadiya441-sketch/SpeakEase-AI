import React from 'react';
import { Loader2 } from 'lucide-react';
import { Card } from './Card';
import { Badge } from './Badge';
import { AudioPlayer } from './AudioPlayer';
import { availableTimingWords } from '../../services/speechService';

export function SpeechAnalysisResults({ expectedText, analysis, audioSrc, recordingId, duration, state = 'completed', demo = false, errorMessage }) {
  const timedWords = availableTimingWords(analysis);
  const missingTiming = (analysis?.words || []).filter(word => !timedWords.includes(word)).map(word => word.word);
  const unavailable = !!analysis && (analysis.alignment_status !== 'completed' || !timedWords.length || missingTiming.length > 0);
  return <Card className="space-y-4" aria-label="Speech analysis results">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-bold">Speech Analysis Results</h2>
      <Badge variant={demo ? 'warning' : 'teal'}>{demo ? 'Demo fixture - not your analysis' : analysis ? 'Analysis results' : 'Recording - not analyzed'}</Badge>
    </div>
    {demo && <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">UI preview only. Example text and timings are not analysis of your recording. No pronunciation assessment is implied.</p>}
    {state === 'processing' ? <p role="status" className="flex items-center gap-2 text-sm text-[#687386]"><Loader2 className="w-5 h-5 animate-spin" />Analyzing your speech. This may take around 20 seconds.</p> : <>
      {state === 'error' && <p role="alert" className="text-sm text-red-700">{errorMessage || analysis?.alignment_error || 'Analysis could not be completed. Your recording remains available. Please retry.'}</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-slate-50 border border-[#E5E9F2] rounded-xl p-4"><h3 className="text-xs font-semibold text-[#687386] mb-2">Expected Text</h3><p className="font-semibold break-words">{expectedText || 'No expected text supplied'}</p></div>
        <div className="bg-slate-50 border border-[#E5E9F2] rounded-xl p-4"><h3 className="text-xs font-semibold text-[#687386] mb-2">Recognized Speech</h3><p className="font-semibold break-words">{analysis ? analysis.transcript || 'No speech recognized' : 'Not analyzed - no analysis response has been received.'}</p></div>
      </div>
      <AudioPlayer key={audioSrc || 'missing'} src={audioSrc} recordingId={recordingId} title="Recording playback" durationSeconds={analysis?.duration_seconds || duration} words={timedWords} />
      {unavailable && <div role="status" className="text-xs text-amber-800 space-y-1">
        <p>{timedWords.length ? 'Some word-level timing is unavailable. Only supplied, usable timestamps are shown.' : 'Word-level timing is unavailable. You can still review the transcript and recording.'}</p>
        {analysis.alignment_error && <p>{analysis.alignment_error}</p>}
        {missingTiming.length > 0 && <p>Words without usable timestamps: {missingTiming.join(', ')}</p>}
        {analysis.unaligned_words?.length > 0 && <p>Unaligned words: {analysis.unaligned_words.join(', ')}</p>}
      </div>}
    </>}
    <p className="text-xs text-[#687386] border-t border-[#E5E9F2] pt-3">Word timings estimate positions in audio. Transcription differences do not establish pronunciation errors. Your therapist can review your practice.</p>
  </Card>;
}

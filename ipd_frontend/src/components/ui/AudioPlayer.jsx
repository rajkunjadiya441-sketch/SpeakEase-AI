import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2 } from 'lucide-react';
import { mediaTime, validAlignedWords, recordingBrowserNotice } from '../../utils/speech';
import { useRecordingAudio } from '../../hooks/useRecordingAudio';

export function AudioPlayer({ recordingId, src, ...props }) {
  const resource = useRecordingAudio(recordingId, src);
  return <AudioPlayerMedia key={resource.src || (resource.loading ? 'loading' : 'missing')} {...props} recordingId={recordingId} src={resource.src} sourceError={resource.error} sourceLoading={resource.loading} recordingMetadata={resource.metadata} />;
}
function AudioPlayerMedia({ src, speechText, title = 'Audio Playback', className = '', autoPlay = false, durationSeconds = 0, words = [], recordingId, sourceError, sourceLoading, recordingMetadata }) {
  const audioRef = useRef(null), activity = useRef({ speech: null, operation: 0, pendingSeek: null });
  const [playing, setPlaying] = useState(false), [current, setCurrent] = useState(0), [duration, setDuration] = useState(0), [selected, setSelected] = useState(null), [error, setError] = useState(''), [playError, setPlayError] = useState(''), [decoderMessage, setDecoderMessage] = useState(''), [browserSupport, setBrowserSupport] = useState(''), [ready, setReady] = useState(false);
  useEffect(() => { const audio = audioRef.current, state = activity.current; return () => { state.operation++; state.pendingSeek?.abort(); audio?.pause(); if (state.speech) { state.speech.onend = null; window.speechSynthesis?.cancel(); } }; }, []);
  const total = Number.isFinite(duration) && duration > 0 ? duration : Number.isFinite(durationSeconds) ? durationSeconds : 0;
  const aligned = validAlignedWords(words, total > 0 ? total + 0.01 : Infinity);
  const problem = sourceError || error || playError;
  const blocked = !src || !ready || !!(sourceError || error);
  function playbackError(error) {
    setSelected(null); setPlaying(false);
    setPlayError(error?.name === 'NotAllowedError' ? 'Playback was blocked by the browser. Allow audio playback and try again.' : 'The recording could not be played. It may be damaged or unsupported by this browser.');
  }
  async function play() {
    const audio = audioRef.current, token = ++activity.current.operation;
    if (!audio || blocked) return;
    setPlayError('');
    try { await audio.play(); }
    catch (error) { if (activity.current.operation === token) playbackError(error); }
  }
  const toggle = () => {
    if (src && audioRef.current) { if (audioRef.current.paused) play(); else { activity.current.operation++; activity.current.pendingSeek?.abort(); audioRef.current.pause(); } }
    else if (speechText && !sourceLoading && !problem && window.speechSynthesis) {
      if (playing) { window.speechSynthesis.cancel(); setPlaying(false); }
      else { const utterance = new SpeechSynthesisUtterance(speechText); activity.current.speech = utterance; utterance.rate = 0.85; utterance.onstart = () => setPlaying(true); utterance.onend = utterance.onerror = () => setPlaying(false); window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); }
    }
  };
  async function seek(value, index = null, replay = false) {
    const audio = audioRef.current;
    if (!audio || blocked) return;
    const token = ++activity.current.operation;
    activity.current.pendingSeek?.abort(); const controller = new AbortController(); activity.current.pendingSeek = controller;
    setSelected(null); setPlayError('');
    const position = Math.max(0, Math.min(value, total || value));
    try {
      await new Promise((resolve, reject) => {
        const finish = error => { clearTimeout(timer); audio.removeEventListener('seeked', done); audio.removeEventListener('error', failed); controller.signal.removeEventListener('abort', cancelled); if (error) reject(error); else resolve(); };
        const done = () => finish(Math.abs(audio.currentTime - position) > 0.2 ? new Error('Seek did not reach the selected word.') : null);
        const failed = () => finish(new Error('Recording unavailable.'));
        const cancelled = () => finish(new DOMException('Cancelled', 'AbortError'));
        const timer = setTimeout(() => finish(new Error('Recording did not finish seeking.')), 5000);
        audio.addEventListener('seeked', done); audio.addEventListener('error', failed); controller.signal.addEventListener('abort', cancelled, { once: true });
        try { audio.currentTime = position; if (!audio.seeking && Math.abs(audio.currentTime - position) < 0.05) finish(); } catch (error) { finish(error); }
      });
      if (activity.current.operation !== token) return;
      if (replay) await audio.play();
      if (activity.current.operation === token && !audio.error) { setCurrent(audio.currentTime); setSelected(index); }
    } catch (error) { if (activity.current.operation === token && error.name !== 'AbortError') playbackError(error); }
  }
  return <div className={'space-y-3 ' + className}>
    <div className="flex items-center gap-3 p-3 bg-slate-50 border border-[#E5E9F2] rounded-xl">
      {src && <audio data-recording-id={recordingId} ref={audioRef} src={src} preload="auto" autoPlay={autoPlay} onTimeUpdate={event => setCurrent(event.currentTarget.currentTime)} onLoadedMetadata={event => { setDuration(event.currentTarget.duration); setCurrent(0); setSelected(null); setReady(true); }} onDurationChange={event => setDuration(event.currentTarget.duration)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onError={event => { activity.current.operation++; activity.current.pendingSeek?.abort(); setSelected(null); setReady(false); setPlaying(false); const code = event.currentTarget.error?.code; setDecoderMessage(event.currentTarget.error?.message || ''); setBrowserSupport(event.currentTarget.canPlayType(recordingMetadata?.mime || '') || 'Not advertised'); setError('This recording could not be loaded or decoded by this browser' + (code ? ' (media error ' + code + ')' : '') + '. Your transcript and timestamps are still available.' + (recordingMetadata?.mime?.includes('webm') && recordingBrowserNotice() ? ' ' + recordingBrowserNotice() : '')); }} />}
      <button type="button" disabled={speechText && !src ? sourceLoading || !!problem : blocked} onClick={toggle} aria-label={playing ? 'Pause audio' : 'Play audio'} className="w-10 h-10 rounded-full flex items-center justify-center bg-[#5865E8] text-white disabled:opacity-40 shrink-0">{playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}</button>
      <div className="flex-1 min-w-0"><div className="flex justify-between gap-2 text-xs font-medium mb-2"><span className="truncate flex gap-1 items-center"><Volume2 className="w-3 h-3" />{title}</span><span className="font-mono whitespace-nowrap">{src ? mediaTime(current) + ' / ' + mediaTime(total) : speechText ? 'Reference voice' : sourceLoading ? 'Loading recording' : 'No recording'}</span></div>
        {src && <input aria-label="Seek audio" type="range" min="0" max={total || 0} step="0.01" value={Math.min(current, total || 0)} disabled={blocked || !total} onChange={event => seek(Number(event.target.value))} className="w-full accent-[#5865E8]" />}
      </div>
      <button type="button" disabled={blocked} aria-label="Replay recording" onClick={() => seek(0, null, true)} className="p-2 text-slate-500 disabled:opacity-40"><RotateCcw className="w-4 h-4" /></button>
    </div>
    {sourceLoading && <p role="status" className="text-xs text-[#687386]">Loading saved recording...</p>}
    {problem && <p role="alert" className="text-xs text-amber-800">{problem}</p>}
    {src && recordingMetadata && <div className="space-y-2 text-xs text-[#687386]">
      <a className="text-[#5865E8] underline" href={src} download={recordingMetadata.mime.includes('webm') ? 'recording.webm' : recordingMetadata.mime.includes('wav') ? 'recording.wav' : 'recording.bin'}>Save original recording</a>
      {problem && <details><summary className="cursor-pointer">Recording format and playback details</summary><pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify({ ...recordingMetadata, browserSupport, decoderMessage, browser: navigator.userAgent, origin: location.origin }, null, 2)}</pre></details>}
    </div>}
    {!src && !speechText && !sourceLoading && !problem && <p className="text-xs text-[#687386]">No audio is attached to this attempt. Reference speech is never substituted for a patient recording.</p>}
    {aligned.length > 0 && <div className="space-y-2"><p className="text-xs font-semibold text-[#687386]">Word-level alignment <span className="font-normal">- select a word to replay from its start.</span></p><div className="flex flex-wrap gap-2">{aligned.map((word, index) => <button type="button" key={index} aria-pressed={selected === index} disabled={blocked} onClick={() => seek(word.start, index, true)} className={'rounded-lg border px-3 py-2 text-left disabled:opacity-50 transition-colors ' + (selected === index ? 'bg-[#EEF0FD] border-[#5865E8] text-[#5865E8]' : 'bg-white border-[#E5E9F2] text-[#172033] hover:bg-slate-50')}><span className="block text-sm font-semibold">{word.word}</span><span className="block text-[11px] font-mono">{word.start.toFixed(3)} - {word.end.toFixed(3)} s</span></button>)}</div></div>}
  </div>;
}

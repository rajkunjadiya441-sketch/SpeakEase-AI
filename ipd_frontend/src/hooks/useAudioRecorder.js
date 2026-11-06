import { useState, useRef, useEffect, useCallback } from 'react';
import { supportedRecordingType, MAX_RECORDING_BYTES, MAX_RECORDING_SECONDS } from '../utils/speech';

export function useAudioRecorder({ maxSeconds = MAX_RECORDING_SECONDS } = {}) {
  const [recordingState, setRecordingState] = useState('ready');
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const ref = useRef({ generation: 0, mounted: true });
  const cleanup = useCallback(() => {
    const r = ref.current;
    clearInterval(r.timer); clearTimeout(r.limit);
    cancelAnimationFrame(r.frame || 0);
    r.stream?.getTracks().forEach(track => track.stop()); r.stream = null;
    r.context?.close().catch(() => {}); r.context = null;
  }, []);
  const resetRecording = useCallback(() => {
    const r = ref.current;
    r.generation++;
    if (r.recorder) { r.recorder.onstop = null; r.recorder.ondataavailable = null; r.recorder.onerror = null; if (r.recorder.state !== 'inactive') r.recorder.stop(); }
    r.recorder = null; cleanup();
    if (r.url) URL.revokeObjectURL(r.url); r.url = null;
    if (r.mounted) { setAudioUrl(null); setAudioBlob(null); setRecordingDuration(0); setAudioLevel(0); setErrorMessage(null); setRecordingState('ready'); }
  }, [cleanup]);
  useEffect(() => {
    const r = ref.current; r.mounted = true;
    return () => { r.mounted = false; resetRecording(); };
  }, [resetRecording]);
  const stopRecording = useCallback(() => {
    const r = ref.current;
    clearInterval(r.timer); clearTimeout(r.limit);
    if (r.recorder?.state === 'recording') { setRecordingState('stopping'); r.recorder.stop(); }
  }, []);
  const startRecording = useCallback(async () => {
    resetRecording();
    const r = ref.current, token = r.generation;
    const mimeType = supportedRecordingType();
    if (!navigator.mediaDevices?.getUserMedia || !mimeType) { setRecordingState('error'); setErrorMessage('WAV/WebM recording is unavailable. Try a current Chrome or Edge browser.'); return; }
    setRecordingState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!r.mounted || token !== r.generation) { stream.getTracks().forEach(t => t.stop()); return; }
      r.stream = stream;
      const recorder = new MediaRecorder(stream, { mimeType }); r.recorder = recorder;
      const chunks = []; let size = 0, discard = false;
      const fail = message => { discard = true; cleanup(); if (r.mounted && token === r.generation) { setErrorMessage(message); setAudioLevel(0); setRecordingState('error'); } };
      recorder.ondataavailable = event => { if (event.data.size) { size += event.data.size; chunks.push(event.data); if (size > MAX_RECORDING_BYTES) { fail('Recording exceeds 10 MiB. Please try a shorter recording.'); if (recorder.state === 'recording') recorder.stop(); } } };
      recorder.onerror = () => { fail('Recording failed. Check your microphone and try again.'); if (recorder.state === 'recording') recorder.stop(); };
      recorder.onstop = () => {
        const elapsed = (performance.now() - r.started) / 1000;
        cleanup(); if (!r.mounted || token !== r.generation || discard) return;
        if (!size || elapsed > maxSeconds + 0.01) { fail(!size ? 'No audio captured. Please try again.' : 'Recording exceeded the time limit. Please try a shorter attempt.'); return; }
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
        r.url = URL.createObjectURL(blob);
        setAudioBlob(blob); setAudioUrl(r.url); setRecordingDuration(elapsed); setAudioLevel(0); setRecordingState('stopped');
      };
      recorder.start(100); r.started = performance.now(); setRecordingState('recording');
      r.timer = setInterval(() => setRecordingDuration((performance.now() - r.started) / 1000), 100);
      // Leave a short margin for final MediaRecorder chunks before the backend's 30s cap.
      r.limit = setTimeout(stopRecording, Math.max(0.05, maxSeconds - 0.5) * 1000);
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) { const context = new AudioCtx(); r.context = context; const analyser = context.createAnalyser(); analyser.fftSize = 64; context.createMediaStreamSource(stream).connect(analyser); const data = new Uint8Array(analyser.frequencyBinCount);
          const meter = () => { if (!r.mounted || token !== r.generation || recorder.state !== 'recording') return; analyser.getByteFrequencyData(data); setAudioLevel(Math.round(data.reduce((a, b) => a + b, 0) / data.length / 255 * 100)); r.frame = requestAnimationFrame(meter); }; meter(); }
      } catch { /* Visualizer is optional; capture remains available. */ }
    } catch (error) {
      cleanup(); if (!r.mounted || token !== r.generation) return;
      setRecordingState('error');
      setErrorMessage(error.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow it in your browser, then try again.' : error.name === 'NotFoundError' ? 'No microphone found. Connect one and try again.' : 'Could not start recording. Check your microphone and browser.');
    }
  }, [cleanup, maxSeconds, resetRecording, stopRecording]);
  return { recordingState, audioUrl, audioBlob, recordingDuration, audioLevel, errorMessage, startRecording, stopRecording, resetRecording };
}

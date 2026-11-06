export const MAX_RECORDING_BYTES = 10 * 1024 * 1024;
export const MAX_RECORDING_SECONDS = 30;
export function supportedRecordingType(recorder = globalThis.MediaRecorder) {
  if (!recorder?.isTypeSupported) return null;
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/wav;codecs=1', 'audio/wav'].find(type => recorder.isTypeSupported(type)) || null;
}
export function validateRecording(blob, duration) {
  if (!blob?.size) throw new Error('The recording is empty. Please record again.');
  if (blob.size > MAX_RECORDING_BYTES) throw new Error('Recording exceeds 10 MiB. Please record a shorter attempt.');
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_RECORDING_SECONDS) throw new Error('Record between 0 and 30 seconds.');
  if (!['audio/webm','audio/wav','audio/wave','audio/x-wav'].includes(blob.type.split(';')[0].toLowerCase())) throw new Error('Use WAV or WebM audio. This browser format is not supported.');
}
export function validAlignedWords(words = [], duration = Infinity) {
  return (Array.isArray(words) ? words : []).filter(w => w && typeof w.word === 'string' && Number.isFinite(w.start) && Number.isFinite(w.end) && w.start >= 0 && w.end >= w.start && w.end <= duration);
}
export function mediaTime(value) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  return Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0');
}

export function recordingBrowserNotice(userAgent = globalThis.navigator?.userAgent || '') {
  return /\bCode\/[\d.]+/.test(userAgent) && /\bElectron\/[\d.]+/.test(userAgent)
    ? "For recording and playback, open this page in standalone Chrome or Edge. VS Code's embedded browser may capture WebM that it cannot play."
    : '';
}

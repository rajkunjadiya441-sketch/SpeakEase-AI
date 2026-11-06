import { validateRecording, validAlignedWords } from '../utils/speech';

export const SPEECH_CONTRACT = Object.freeze({ endpoint: '/speech/analyze', method: 'POST', fileField: 'file', expectedTextField: 'expected_text' });
export const SPEECH_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '');
const configuredTimeout = Number(import.meta.env.VITE_SPEECH_TIMEOUT_MS || 150000);
const DEFAULT_TIMEOUT = Number.isFinite(configuredTimeout) && configuredTimeout > 0 ? configuredTimeout : 150000;
/** @typedef {{word:string,start:number,end:number}} AlignedWord */
/** @typedef {{status:'completed'|'no_speech',processing_status?:'completed',transcript:string,expected_text:string|null,words?:AlignedWord[],alignment_status:'completed'|'partial'|'failed'|'skipped',alignment_error?:string|null,unaligned_words?:string[],filename:string,duration_seconds:number,model:string,language?:'en'}} SpeechAnalysisResponse */

export class SpeechApiError extends Error {
  constructor(message, kind, status = null) {
    super(message);
    this.name = 'SpeechApiError';
    this.kind = kind;
    this.status = status;
  }
}

export function prepareSpeechForm(file, expectedText, duration) {
  validateRecording(file, duration);
  if (expectedText != null && (typeof expectedText !== 'string' || expectedText.length > 2000)) throw new Error('Expected text must be 2,000 characters or fewer.');
  const form = new FormData();
  form.append('file', file, file.type.includes('webm') ? 'recording.webm' : 'recording.wav');
  if (expectedText != null && expectedText !== '') form.append('expected_text', expectedText);
  return form;
}

// Required/defaulted fields follow the live OpenAPI snapshot in docs/backend-openapi.json.
// No missing properties or timestamps are synthesized. Missing timing values are displayed as unavailable.
export function validateSpeechResponse(data) {
  const invalid = () => { throw new SpeechApiError('The speech backend returned an invalid analysis response. Your recording remains available.', 'response'); };
  if (!data || typeof data !== 'object' || Array.isArray(data)) invalid();
  if (!['completed', 'no_speech'].includes(data.status) || !['completed', 'partial', 'failed', 'skipped'].includes(data.alignment_status)) invalid();
  for (const field of ['filename', 'transcript', 'model']) if (typeof data[field] !== 'string') invalid();
  if (!Object.hasOwn(data, 'expected_text') || data.expected_text !== null && typeof data.expected_text !== 'string') invalid();
  if (typeof data.duration_seconds !== 'number' || !Number.isFinite(data.duration_seconds) || data.duration_seconds <= 0 || data.duration_seconds > 30.01) invalid();
  if (Object.hasOwn(data, 'processing_status') && data.processing_status !== 'completed') invalid();
  if (Object.hasOwn(data, 'language') && data.language !== 'en') invalid();
  if (Object.hasOwn(data, 'alignment_error') && data.alignment_error !== null && typeof data.alignment_error !== 'string') invalid();
  if (Object.hasOwn(data, 'unaligned_words') && (!Array.isArray(data.unaligned_words) || data.unaligned_words.some(word => typeof word !== 'string'))) invalid();
  if (Object.hasOwn(data, 'words') && (!Array.isArray(data.words) || data.words.some(word => !word || typeof word !== 'object' || typeof word.word !== 'string'))) invalid();
  return data;
}

export function availableTimingWords(analysis) {
  return validAlignedWords(analysis?.words || [], Number.isFinite(analysis?.duration_seconds) ? analysis.duration_seconds + 0.01 : Infinity);
}

function httpMessage(status, body) {
  const detail = typeof body?.detail === 'string' ? body.detail : Array.isArray(body?.detail) ? body.detail.slice(0, 3).map(item => item.msg).filter(Boolean).join('; ') : '';
  const label = ({ 413: 'Recording exceeds the backend upload limit.', 415: 'The backend does not support this recording format.', 422: 'The backend could not validate this recording.', 429: 'Speech processing is busy. Wait before trying again.', 503: 'Speech recognition is unavailable. Your recording remains available.' })[status] || 'Speech analysis request failed.';
  return label + ' (HTTP ' + status + ')' + (detail ? ' ' + detail.slice(0, 500) : '');
}

let inFlight = false;
export async function analyzeRecording({ file, expectedText, duration, signal, timeoutMs = DEFAULT_TIMEOUT }) {
  const form = prepareSpeechForm(file, expectedText, duration);
  if (inFlight) throw new SpeechApiError('An analysis request is already running. Please wait.', 'busy');
  if (signal?.aborted) throw new SpeechApiError('Analysis request cancelled. Your recording remains available.', 'cancelled');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new SpeechApiError('Invalid speech request timeout.', 'configuration');
  inFlight = true;
  const controller = new AbortController();
  let timedOut = false;
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(SPEECH_API_BASE_URL + SPEECH_CONTRACT.endpoint, {
      method: 'POST', body: form, headers: { Accept: 'application/json' }, signal: controller.signal,
    });
    let data;
    try { data = await response.json(); }
    catch {
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!response.ok) throw new SpeechApiError(httpMessage(response.status), 'http', response.status);
      throw new SpeechApiError('The speech backend returned malformed JSON. Your recording remains available.', 'response');
    }
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!response.ok) throw new SpeechApiError(httpMessage(response.status, data), 'http', response.status);
    return validateSpeechResponse(data);
  } catch (error) {
    if (controller.signal.aborted) throw new SpeechApiError(timedOut ? 'Analysis timed out. Your recording remains available. The server may still be processing it; wait before retrying.' : 'Analysis request cancelled. Your recording remains available. The server may still be processing it.', timedOut ? 'timeout' : 'cancelled');
    if (error instanceof SpeechApiError) throw error;
    throw new SpeechApiError('Could not reach the speech backend. Check that it is running and permits this frontend origin (CORS). Your recording remains available.', 'network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    inFlight = false;
  }
}

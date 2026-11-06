import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Select } from '../../components/ui/Select';
import { SpeechAnalysisResults } from '../../components/ui/SpeechAnalysisResults';
import { DEMO_ANALYSIS } from '../../mocks/speechFixtures';
export function SpeechResultsPreviewPage() {
  const [state, setState] = useState('completed');
  const analysis = { ...DEMO_ANALYSIS, ...(state === 'unavailable' ? { words: [], alignment_status: 'failed', alignment_error: 'Example: alignment worker unavailable.' } : state === 'error' ? { words: [], transcript: '', alignment_status: 'failed', alignment_error: 'Example: analysis request failed. Retry remains available.' } : {}) };
  return <div className="space-y-5"><Link className="text-sm text-[#5865E8]" to="/patient/practice">Back to My Practice</Link><h1 className="text-2xl font-bold">Speech Results Preview</h1><p className="text-sm text-[#687386]">Clearly labeled demo fixtures for interface review. No API calls or saved patient attempts. Playback uses a synthetic tone, not a patient recording.</p><Select label="Preview state" value={state} onChange={e => setState(e.target.value)} options={['idle', 'recording', 'recorded', 'processing', 'completed', 'unavailable', 'error'].map(value => ({value, label:value}))} />{['idle','recording','recorded'].includes(state) ? <p role="status" className="text-sm text-[#687386]">Demo state: {state}. Use the practice session for recording controls.</p> : <SpeechAnalysisResults expectedText={analysis.expected_text} analysis={analysis} audioSrc="/demo-tone.wav" duration={3} state={state === 'unavailable' ? 'completed' : state} demo />}</div>;
}

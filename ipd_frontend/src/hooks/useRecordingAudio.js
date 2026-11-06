import { useEffect, useState } from 'react';
import { recordingStore } from '../services/recordingStore';

export function useRecordingAudio(recordingId, legacySrc) {
  const key = JSON.stringify([recordingId || null, legacySrc || null]);
  const [resource, setResource] = useState(null);
  const stored = !!recordingId || !!legacySrc?.startsWith('data:') || !!legacySrc?.startsWith('blob:');
  useEffect(() => {
    if (!stored) return;
    let active = true, ownedUrl;
    async function load() {
      try {
        let blob;
        if (recordingId) {
          blob = await recordingStore.get(recordingId);
          if (!blob) throw new Error('The saved recording is missing from this browser. The transcript and timestamps remain available.');
        } else {
          if (!legacySrc.startsWith('blob:') && !/^data:audio\/(webm|wav|wave|x-wav)(;|,)/i.test(legacySrc)) throw new Error('The saved recording has an unsupported audio format.');
          blob = await (await fetch(legacySrc)).blob();
          if (!blob.size) throw new Error('The saved recording is empty.');
        }
        const header = Array.from(new Uint8Array(await blob.slice(0, 16).arrayBuffer())).map(byte => byte.toString(16).padStart(2, '0')).join(' ');
        if (!active) return;
        ownedUrl = URL.createObjectURL(blob);
        setResource({ key, src: ownedUrl, error: '', metadata: { mime: blob.type, bytes: blob.size, first16Bytes: header, source: recordingId ? 'IndexedDB Blob' : legacySrc.startsWith('data:') ? 'Legacy data URL' : 'Capture Blob URL' } });
      } catch (error) {
        if (active) setResource({ key, src: null, error: error.message || 'Could not retrieve the saved recording.' });
      }
    }
    load();
    return () => { active = false; if (ownedUrl) URL.revokeObjectURL(ownedUrl); };
  }, [key, recordingId, legacySrc, stored]);
  if (!stored) return { src: legacySrc || null, loading: false, error: '' };
  if (resource?.key !== key) return { src: null, loading: true, error: '' };
  return { ...resource, loading: false };
}

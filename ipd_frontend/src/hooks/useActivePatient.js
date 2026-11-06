import { useSyncExternalStore } from 'react';
import { storage } from '../mocks/storage';
const subscribe = callback => { window.addEventListener('adaptsynthetix:change', callback); window.addEventListener('storage', callback); return () => { window.removeEventListener('adaptsynthetix:change', callback); window.removeEventListener('storage', callback); }; };
export function useActivePatient() { return useSyncExternalStore(subscribe, storage.getActivePatientId); }

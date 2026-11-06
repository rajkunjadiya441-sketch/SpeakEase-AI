import {
  INITIAL_PATIENTS,
  INITIAL_TARGETS,
  INITIAL_EXERCISES,
  INITIAL_ASSIGNMENTS,
  INITIAL_ATTEMPTS,
} from './mockData';

const KEYS = {
  PATIENTS: 'adaptsynthetix_patients_v1',
  TARGETS: 'adaptsynthetix_targets_v1',
  EXERCISES: 'adaptsynthetix_exercises_v1',
  ASSIGNMENTS: 'adaptsynthetix_assignments_v1',
  ATTEMPTS: 'adaptsynthetix_attempts_v1',
  SETTINGS: 'adaptsynthetix_settings_v1',
  CURRENT_PATIENT_ID: 'adaptsynthetix_active_patient_id',
};

function getItem(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    return JSON.parse(raw);
  } catch (err) {
    if (key === KEYS.ATTEMPTS) throw new Error('Saved attempt metadata could not be read from this browser.');
    console.warn(`LocalStorage read failed for ${key}:`, err);
    return defaultValue;
  }
}

function setItem(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event('adaptsynthetix:change'));
  } catch (err) {
    throw new Error('Local demo storage is full or unavailable. Save a shorter recording or reset demo data in Settings.');
  }
}

export const storage = {
  getSettings: () => getItem(KEYS.SETTINGS, { therapistName: 'Dr. Rachel Hayes', clinicName: 'Metropolitan Speech & Language Clinic', defaultRepetitions: '5' }),
  setSettings: data => setItem(KEYS.SETTINGS, data),
  getPatients: () => getItem(KEYS.PATIENTS, INITIAL_PATIENTS),
  setPatients: (data) => setItem(KEYS.PATIENTS, data),

  getTargets: () => getItem(KEYS.TARGETS, INITIAL_TARGETS),
  setTargets: (data) => setItem(KEYS.TARGETS, data),

  getExercises: () => getItem(KEYS.EXERCISES, INITIAL_EXERCISES),
  setExercises: (data) => setItem(KEYS.EXERCISES, data),

  getAssignments: () => getItem(KEYS.ASSIGNMENTS, INITIAL_ASSIGNMENTS),
  setAssignments: (data) => setItem(KEYS.ASSIGNMENTS, data),

  getAttempts: () => getItem(KEYS.ATTEMPTS, INITIAL_ATTEMPTS),
  setAttempts: (data) => setItem(KEYS.ATTEMPTS, data),

  getActivePatientId: () => {
    try {
      return localStorage.getItem(KEYS.CURRENT_PATIENT_ID) || 'p-1';
    } catch {
      return 'p-1';
    }
  },
  setActivePatientId: (id) => {
    try {
      localStorage.setItem(KEYS.CURRENT_PATIENT_ID, id);
      window.dispatchEvent(new Event('adaptsynthetix:change'));
    } catch {}
  },

  resetDefaults: () => {
    try {
      localStorage.setItem(KEYS.PATIENTS, JSON.stringify(INITIAL_PATIENTS));
      localStorage.setItem(KEYS.TARGETS, JSON.stringify(INITIAL_TARGETS));
      localStorage.setItem(KEYS.EXERCISES, JSON.stringify(INITIAL_EXERCISES));
      localStorage.setItem(KEYS.ASSIGNMENTS, JSON.stringify(INITIAL_ASSIGNMENTS));
      localStorage.setItem(KEYS.ATTEMPTS, JSON.stringify(INITIAL_ATTEMPTS));
      localStorage.setItem(KEYS.CURRENT_PATIENT_ID, 'p-1');
      localStorage.removeItem(KEYS.SETTINGS);
      window.dispatchEvent(new Event('adaptsynthetix:change'));
    } catch (err) {
      console.warn('Failed resetting storage:', err);
    }
  },
};

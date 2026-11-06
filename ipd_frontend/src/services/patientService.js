import { storage } from '../mocks/storage';
import { apiClient } from './apiClient';

export const patientService = {
  async getPatients() {
    await apiClient.mockDelay(150);
    const patients = storage.getPatients();
    const targets = storage.getTargets();
    const assignments = storage.getAssignments();

    // Enrich with computed counters
    return patients.map((patient) => {
      const patientTargets = targets.filter((t) => t.patientId === patient.id);
      const patientAssignments = assignments.filter((a) => a.patientId === patient.id && a.status !== 'COMPLETED');
      return {
        ...patient,
        assignedTargetsCount: patientTargets.length,
        activeExercisesCount: patientAssignments.length,
      };
    });
  },

  async getPatientById(id) {
    await apiClient.mockDelay(120);
    const patients = storage.getPatients();
    const found = patients.find((p) => p.id === id);
    if (!found) throw new Error(`Patient with ID "${id}" not found`);
    return found;
  },

  async createPatient(payload) {
    await apiClient.mockDelay(200);
    const patients = storage.getPatients();
    const newPatient = {
      id: `p-${Date.now()}`,
      name: payload.name.trim(),
      email: payload.email.trim(),
      phone: payload.phone || '',
      status: payload.status || 'Active',
      notes: payload.notes || '',
      createdAt: new Date().toISOString(),
      lastPracticeDate: null,
    };
    const updated = [newPatient, ...patients];
    storage.setPatients(updated);
    return newPatient;
  },

  async updatePatient(id, payload) {
    await apiClient.mockDelay(180);
    const patients = storage.getPatients();
    let updatedPatient = null;
    const updated = patients.map((p) => {
      if (p.id === id) {
        updatedPatient = {
          ...p,
          ...payload,
          id: p.id, // prevent id overwrite
          updatedAt: new Date().toISOString(),
        };
        return updatedPatient;
      }
      return p;
    });
    if (!updatedPatient) throw new Error('Patient not found');
    storage.setPatients(updated);
    return updatedPatient;
  },

  async deletePatient(id) {
    await apiClient.mockDelay(150);
    const patients = storage.getPatients();
    const updated = patients.filter((p) => p.id !== id);
    storage.setPatients(updated);
    return { success: true, id };
  },
};

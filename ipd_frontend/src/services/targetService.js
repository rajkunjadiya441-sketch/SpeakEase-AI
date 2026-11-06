import { storage } from '../mocks/storage';
import { apiClient } from './apiClient';

export const targetService = {
  async getTargetsByPatient(patientId) {
    await apiClient.mockDelay(140);
    const targets = storage.getTargets();
    return targets.filter((t) => t.patientId === patientId);
  },

  async getAllTargets() {
    await apiClient.mockDelay(140);
    return storage.getTargets();
  },

  async getTargetById(id) {
    await apiClient.mockDelay(100);
    const targets = storage.getTargets();
    const found = targets.find((t) => t.id === id);
    if (!found) throw new Error(`Target ${id} not found`);
    return found;
  },

  async createTarget(payload) {
    await apiClient.mockDelay(180);
    const targets = storage.getTargets();
    if (!payload.value?.trim() || !storage.getPatients().some(p => p.id === payload.patientId)) throw new Error('Select a patient and enter a target value.');
    const newTarget = {
      id: `t-${Date.now()}`,
      patientId: payload.patientId,
      type: payload.type,
      value: payload.value.trim(),
      language: payload.language || 'English (US)',
      difficulty: payload.difficulty || 'Beginner',
      examples: Array.isArray(payload.examples)
        ? payload.examples
        : (payload.examples || '').split(',').map((s) => s.trim()).filter(Boolean),
      soundDescription: payload.soundDescription || '',
      relatedPhrases: payload.relatedPhrases || '',
      context: payload.context || '',
      notes: payload.notes || '',
      createdAt: new Date().toISOString(),
    };
    const updated = [newTarget, ...targets];
    storage.setTargets(updated);
    return newTarget;
  },

  async updateTarget(id, payload) {
    await apiClient.mockDelay(150);
    const targets = storage.getTargets();
    let updatedTarget = null;
    const updated = targets.map((t) => {
      if (t.id === id) {
        updatedTarget = {
          ...t,
          ...payload,
          id: t.id,
          examples: Array.isArray(payload.examples)
            ? payload.examples
            : (payload.examples || '').split(',').map((s) => s.trim()).filter(Boolean),
          updatedAt: new Date().toISOString(),
        };
        return updatedTarget;
      }
      return t;
    });
    if (!updatedTarget) throw new Error('Target not found');
    storage.setTargets(updated);
    return updatedTarget;
  },

  async deleteTarget(id) {
    await apiClient.mockDelay(150);
    const targets = storage.getTargets();
    const updated = targets.filter((t) => t.id !== id);
    storage.setTargets(updated);
    return { success: true, id };
  },
};

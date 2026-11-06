import { storage } from '../mocks/storage';
import { apiClient } from './apiClient';

export const exerciseService = {
  async getExercisesByPatient(patientId) {
    await apiClient.mockDelay(140);
    const exercises = storage.getExercises();
    return exercises.filter((e) => e.patientId === patientId);
  },

  async getAllExercises() {
    await apiClient.mockDelay(140);
    return storage.getExercises();
  },

  async getExerciseById(id) {
    await apiClient.mockDelay(100);
    const exercises = storage.getExercises();
    const found = exercises.find((e) => e.id === id);
    if (!found) throw new Error(`Exercise ${id} not found`);
    return found;
  },

  async createExercise(payload) {
    await apiClient.mockDelay(180);
    const exercises = storage.getExercises();
    const newEx = {
      id: `ex-${Date.now()}`,
      patientId: payload.patientId,
      targetId: payload.targetId,
      title: payload.title,
      instructions: payload.instructions,
      type: payload.type || 'REPETITION',
      difficulty: payload.difficulty || 'Beginner',
      level: payload.level || 'Single Word Practice',
      content: payload.content || {},
      status: payload.status || 'DRAFT',
      createdAt: new Date().toISOString(),
    };
    const updated = [newEx, ...exercises];
    storage.setExercises(updated);
    return newEx;
  },

  /**
   * Mock generation logic preparing UI for future LLM API integration.
   * Generates tailored exercises according to target type, level, and parameters.
   */
  async generateMockExercises(config) {
    await apiClient.mockDelay(600); // simulate thoughtful generation delay
    const { target, practiceLevel, difficulty, exerciseType, exampleWords } = config;
    const targetVal = target?.value || 'Target';
    const targetType = target?.type || 'WORD';

    const cleanExamples = Array.isArray(exampleWords)
      ? exampleWords
      : (exampleWords || '').split(',').map((w) => w.trim()).filter(Boolean);

    const firstEx = cleanExamples[0] || (targetType === 'SOUND' ? 'ship' : targetVal);
    const secondEx = cleanExamples[1] || 'shore';

    const generated = [
      {
        id: `gen-${Date.now()}-1`,
        patientId: target?.patientId || '',
        targetId: target?.id || '',
        title: `${practiceLevel || 'Target Practice'}: ${targetVal}`,
        instructions: `Listen carefully to the reference articulation. Breathe comfortably, align your speech articulators, and speak clearly.`,
        type: exerciseType || 'REPETITION',
        difficulty: difficulty || 'Beginner',
        level: practiceLevel || 'Single Word Practice',
        content: {
          prompt: targetType === 'SOUND' ? `${targetVal} ... ${firstEx}` : targetVal,
          phonetic: targetType === 'SOUND' ? targetVal : `/${targetVal.toLowerCase()}/`,
          exampleWords: cleanExamples.length > 0 ? cleanExamples : [firstEx, secondEx, 'sample'],
          referenceSentence: `Focus on clarity and steady breath while saying "${firstEx}".`,
        },
        status: 'DRAFT',
      },
      {
        id: `gen-${Date.now()}-2`,
        patientId: target?.patientId || '',
        targetId: target?.id || '',
        title: `Contrast & Fluency: "${firstEx}" in Context`,
        instructions: `Maintain consistent vocal pace. Contrast the focus sound with surrounding vowel transitions.`,
        type: 'REPETITION',
        difficulty: difficulty || 'Beginner',
        level: practiceLevel || 'Short Phrase Context',
        content: {
          prompt: `The ${firstEx} is ready`,
          phonetic: `/ðə ${firstEx.toLowerCase()} ɪz ˈrɛdi/`,
          exampleWords: [firstEx, 'ready', 'steady'],
          referenceSentence: `Say the entire phrase naturally without pausing before "${firstEx}".`,
        },
        status: 'DRAFT',
      },
    ];

    // If everyday use or sentence level, add conversational scenario
    if (targetType === 'EVERYDAY_USE' || practiceLevel?.includes('Sentence') || practiceLevel?.includes('Everyday')) {
      generated.push({
        id: `gen-${Date.now()}-3`,
        patientId: target?.patientId || '',
        targetId: target?.id || '',
        title: `Everyday Application: ${targetVal}`,
        instructions: `Imagine a friendly daily interaction. Use clear voice projection and supportive cadence.`,
        type: 'ROLE_PLAY',
        difficulty: difficulty || 'Intermediate',
        level: 'Everyday Conversation',
        content: {
          prompt: `Excuse me, could you help me with ${firstEx}? Thank you!`,
          phonetic: 'Conversational cadence',
          exampleWords: [firstEx, 'please', 'thank you'],
          referenceSentence: `Speak in a pleasant, natural tone as if talking to a friendly clerk.`,
        },
        status: 'DRAFT',
      });
    }

    return generated;
  },

  async updateExercise(id, payload) {
    await apiClient.mockDelay(150);
    const exercises = storage.getExercises();
    let updatedEx = null;
    const updated = exercises.map((e) => {
      if (e.id === id) {
        updatedEx = {
          ...e,
          ...payload,
          id: e.id,
          updatedAt: new Date().toISOString(),
        };
        return updatedEx;
      }
      return e;
    });
    if (!updatedEx) throw new Error('Exercise not found');
    storage.setExercises(updated);
    return updatedEx;
  },

  async approveExercise(id) {
    return this.updateExercise(id, { status: 'APPROVED' });
  },

  async deleteExercise(id) {
    await apiClient.mockDelay(150);
    const exercises = storage.getExercises();
    const updated = exercises.filter((e) => e.id !== id);
    storage.setExercises(updated);
    return { success: true, id };
  },
};

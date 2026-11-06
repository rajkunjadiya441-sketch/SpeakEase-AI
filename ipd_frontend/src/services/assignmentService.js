import { storage } from '../mocks/storage';
import { apiClient } from './apiClient';

export const assignmentService = {
  async getAssignmentsByPatient(patientId) {
    await apiClient.mockDelay(140);
    const assignments = storage.getAssignments();
    const exercises = storage.getExercises();
    const targets = storage.getTargets();

    const patientAssignments = assignments.filter((a) => a.patientId === patientId);

    // Join with exercise and target data for rich display
    return patientAssignments.map((assignment) => {
      const exercise = exercises.find((e) => e.id === assignment.exerciseId);
      const target = exercise ? targets.find((t) => t.id === exercise.targetId) : null;
      return {
        ...assignment,
        exercise,
        target,
      };
    });
  },

  async getAllAssignments() {
    await apiClient.mockDelay(140);
    return storage.getAssignments();
  },

  async assignExercises({ patientId, exerciseIds, dueDate, repetitions = 3 }) {
    await apiClient.mockDelay(200);
    const assignments = storage.getAssignments();
    const exercises = storage.getExercises();

    if (!storage.getPatients().some(p => p.id === patientId)) throw new Error('Select a valid patient.');
    if (!Array.isArray(exerciseIds) || !exerciseIds.length) throw new Error('Select at least one approved exercise.');
    if (!Number.isInteger(Number(repetitions)) || Number(repetitions) < 1 || Number(repetitions) > 50) throw new Error('Repetitions must be a whole number from 1 to 50.');
    if (dueDate && (!Number.isFinite(Date.parse(dueDate)) || new Date(dueDate).getTime() < new Date().setHours(0,0,0,0))) throw new Error('Choose a valid due date today or later.');
    if (exerciseIds.some(id => !exercises.some(ex => ex.id === id && ex.patientId === patientId && ['APPROVED','ASSIGNED'].includes(ex.status)))) throw new Error('Only this patient approved exercises can be assigned.');
    const newAssignments = [];
    const now = new Date().toISOString();

    for (const exerciseId of exerciseIds) {
      const newAssignment = {
        id: `as-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        patientId,
        exerciseId,
        assignedAt: now,
        dueDate: dueDate || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        repetitions: Number(repetitions) || 3,
        completedRepetitions: 0,
        status: 'PENDING',
      };
      newAssignments.push(newAssignment);
    }

    // Update status of assigned exercises to ASSIGNED if they were APPROVED
    const updatedExercises = exercises.map((ex) => {
      if (exerciseIds.includes(ex.id)) {
        return { ...ex, status: 'ASSIGNED' };
      }
      return ex;
    });

    storage.setExercises(updatedExercises);
    storage.setAssignments([...newAssignments, ...assignments]);

    return newAssignments;
  },

  async recordPracticeAttempt(assignmentId) {
    await apiClient.mockDelay(120);
    const assignments = storage.getAssignments();
    let updatedAssignment = null;

    const updated = assignments.map((a) => {
      if (a.id === assignmentId) {
        const nextCompleted = Math.min(a.repetitions || 1, (a.completedRepetitions || 0) + 1);
        const isComplete = nextCompleted >= (a.repetitions || 1);
        updatedAssignment = {
          ...a,
          completedRepetitions: nextCompleted,
          status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
        };
        return updatedAssignment;
      }
      return a;
    });

    storage.setAssignments(updated);
    return updatedAssignment;
  },
};

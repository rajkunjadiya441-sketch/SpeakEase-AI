import { storage } from '../mocks/storage';
import { apiClient } from './apiClient';

export const progressService = {
  async getTherapistDashboardData() {
    await apiClient.mockDelay(160);
    const patients = storage.getPatients();
    const targets = storage.getTargets();
    const exercises = storage.getExercises();
    const assignments = storage.getAssignments();
    const attempts = storage.getAttempts().map(a => ({ ...a, recognitionEvidence: '', audioBlobUrl: a.audioBlobUrl?.startsWith('blob:') ? null : a.audioBlobUrl })).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));

    const pendingApprovals = exercises.filter((e) => e.status === 'DRAFT');
    const activeAssignments = assignments.filter((a) => a.status !== 'COMPLETED');
    const patientsNeedingAttention = patients.filter((p) => p.status === 'Needs Attention');

    // Recent attempts with patient details
    const recentActivity = attempts.slice(0, 5).map((att) => {
      const patient = patients.find((p) => p.id === att.patientId);
      const target = targets.find((t) => t.id === att.targetId);
      const exercise = exercises.find((e) => e.id === att.exerciseId);
      return {
        ...att,
        patientName: patient?.name || 'Unknown Patient',
        targetValue: target?.value || 'Target',
        exerciseTitle: exercise?.title || 'Practice Exercise',
      };
    });

    return {
      metrics: {
        totalPatients: patients.length,
        activeAssignments: activeAssignments.length,
        pendingApprovals: pendingApprovals.length,
        totalAttempts: attempts.length,
      },
      patientsNeedingAttention,
      pendingApprovals: pendingApprovals.slice(0, 4).map((ex) => {
        const patient = patients.find((p) => p.id === ex.patientId);
        return { ...ex, patientName: patient?.name || 'Patient' };
      }),
      recentActivity,
      patientOverview: patients.map((p) => {
        const pAttempts = attempts.filter((a) => a.patientId === p.id);
        const pAssignments = assignments.filter((a) => a.patientId === p.id);
        const completedAssignments = pAssignments.filter((a) => a.status === 'COMPLETED');
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          totalAttempts: pAttempts.length,
          activeAssignmentsCount: pAssignments.length - completedAssignments.length,
          completedAssignmentsCount: completedAssignments.length,
          lastPracticeDate: p.lastPracticeDate,
        };
      }),
    };
  },

  async getPatientProgress(patientId) {
    await apiClient.mockDelay(140);
    const attempts = storage.getAttempts().map(a => ({ ...a, recognitionEvidence: '', audioBlobUrl: a.audioBlobUrl?.startsWith('blob:') ? null : a.audioBlobUrl })).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).filter((a) => a.patientId === patientId);
    const assignments = storage.getAssignments().filter((a) => a.patientId === patientId);
    const targets = storage.getTargets().filter((t) => t.patientId === patientId);
    const exercises = storage.getExercises().filter((e) => e.patientId === patientId);

    const completedAssignments = assignments.filter((a) => a.status === 'COMPLETED');

    // Target breakdown
    const targetBreakdown = targets.map((target) => {
      const targetAttempts = attempts.filter((a) => a.targetId === target.id);
      const first = targetAttempts[targetAttempts.length - 1]; // oldest
      const latest = targetAttempts[0]; // newest
      return {
        target,
        attemptCount: targetAttempts.length,
        firstAttempt: first || null,
        latestAttempt: latest || null,
      };
    });

    return {
      totalAttempts: attempts.length,
      completedAssignmentsCount: completedAssignments.length,
      activeAssignmentsCount: assignments.length - completedAssignments.length,
      targetsPracticedCount: targets.filter((t) => attempts.some((a) => a.targetId === t.id)).length,
      totalTargetsCount: targets.length,
      targetBreakdown,
      recentAttempts: attempts.slice(0, 10).map((att) => ({
        ...att,
        exercise: exercises.find((e) => e.id === att.exerciseId),
        target: targets.find((t) => t.id === att.targetId),
      })),
    };
  },
};

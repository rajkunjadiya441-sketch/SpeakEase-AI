import { SpeechResultsPreviewPage } from './pages/patient/SpeechResultsPreviewPage';
import { AttemptDetailsPage } from './pages/patient/AttemptDetailsPage';
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import { TherapistLayout } from './components/layout/TherapistLayout';
import { PatientLayout } from './components/layout/PatientLayout';

// Therapist Pages
import { TherapistDashboard } from './pages/therapist/TherapistDashboard';
import { PatientsPage } from './pages/therapist/PatientsPage';
import { PatientProfilePage } from './pages/therapist/PatientProfilePage';
import { TargetsPage } from './pages/therapist/TargetsPage';
import { ExerciseGeneratorPage } from './pages/therapist/ExerciseGeneratorPage';
import { ExerciseAssignmentPage } from './pages/therapist/ExerciseAssignmentPage';
import { AttemptReviewPage } from './pages/therapist/AttemptReviewPage';
import { ProgressDashboardPage } from './pages/therapist/ProgressDashboardPage';
import { SettingsPage } from './pages/therapist/SettingsPage';

// Patient Pages
import { PatientHomePage } from './pages/patient/PatientHomePage';
import { AssignedPracticePage } from './pages/patient/AssignedPracticePage';
import { ExerciseDetailPage } from './pages/patient/ExerciseDetailPage';
import { PracticeSessionPage } from './pages/patient/PracticeSessionPage';
import { PracticeHistoryPage } from './pages/patient/PracticeHistoryPage';
import { PatientProgressPage } from './pages/patient/PatientProgressPage';
import { PatientProfileSettingsPage } from './pages/patient/PatientProfileSettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default Redirect to Therapist Dashboard */}
        <Route path="/" element={<Navigate to="/therapist/dashboard" replace />} />

        {/* Therapist Portal Routes */}
        <Route path="/therapist" element={<TherapistLayout />}>
          <Route index element={<Navigate to="/therapist/dashboard" replace />} />
          <Route path="dashboard" element={<TherapistDashboard />} />
          <Route path="patients" element={<PatientsPage />} />
          <Route path="patients/:id" element={<PatientProfilePage />} />
          <Route path="targets" element={<TargetsPage />} />
          <Route path="exercise-generator" element={<ExerciseGeneratorPage />} />
          <Route path="assignments" element={<ExerciseAssignmentPage />} />
          <Route path="attempts" element={<AttemptReviewPage />} />
          <Route path="progress" element={<ProgressDashboardPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Patient Portal Routes */}
        <Route path="/patient" element={<PatientLayout />}>
          <Route index element={<Navigate to="/patient/home" replace />} />
          <Route path="home" element={<PatientHomePage />} />
          <Route path="practice" element={<AssignedPracticePage />} />
          <Route path="practice/details/:id" element={<ExerciseDetailPage />} />
          <Route path="practice/session/:id" element={<PracticeSessionPage />} />
          <Route path="history" element={<PracticeHistoryPage />} />
          <Route path="history/:id" element={<AttemptDetailsPage />} />
          <Route path="results-preview" element={<SpeechResultsPreviewPage />} />
          <Route path="progress" element={<PatientProgressPage />} />
          <Route path="profile" element={<PatientProfileSettingsPage />} />
        </Route>

        {/* Fallback Catch-all */}
        <Route path="*" element={<Navigate to="/therapist/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}


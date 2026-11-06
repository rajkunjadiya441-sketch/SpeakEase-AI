import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User,
  ArrowLeft,
  Edit,
  Sparkles,
  ClipboardList,
  Target,
  FileCheck,
  Mic,
  TrendingUp,
  Plus,
  Trash2,
  Calendar,
  Clock,
  CheckCircle,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Link } from 'react-router-dom';
import { AudioPlayer } from '../../components/ui/AudioPlayer';
import { patientService } from '../../services/patientService';
import { targetService } from '../../services/targetService';
import { exerciseService } from '../../services/exerciseService';
import { assignmentService } from '../../services/assignmentService';
import { attemptService } from '../../services/attemptService';
import { progressService } from '../../services/progressService';
import { TARGET_TYPES, TARGET_TYPE_DETAILS, DIFFICULTY_LEVELS } from '../../constants/targets';
import { formatDate, formatTimeAgo, formatDuration } from '../../utils/formatters';

export function PatientProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview'); // overview, targets, exercises, attempts, progress
  const [patient, setPatient] = useState(null);
  const [targets, setTargets] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Add/Edit Target Modal state
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [targetForm, setTargetForm] = useState({
    type: TARGET_TYPES.SOUND,
    value: '',
    language: 'English (US)',
    difficulty: 'Beginner',
    examples: '',
    soundDescription: '',
    relatedPhrases: '',
    context: '',
    notes: '',
  });

  // Edit Patient Modal state
  const [editPatientModal, setEditPatientModal] = useState(false);
  const [patientForm, setPatientForm] = useState({ name: '', email: '', phone: '', status: 'Active', notes: '' });

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [p, t, ex, as, att, prog] = await Promise.all([
        patientService.getPatientById(id),
        targetService.getTargetsByPatient(id),
        exerciseService.getExercisesByPatient(id),
        assignmentService.getAssignmentsByPatient(id),
        attemptService.getAttemptsByPatient(id),
        progressService.getPatientProgress(id),
      ]);
      setPatient(p);
      setTargets(t);
      setExercises(ex);
      setAssignments(as);
      setAttempts(att);
      setProgressData(prog);
      setPatientForm({
        name: p.name,
        email: p.email,
        phone: p.phone || '',
        status: p.status || 'Active',
        notes: p.notes || '',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [id]);

  const handleUpdatePatient = async (e) => {
    e.preventDefault();
    try {
      const updated = await patientService.updatePatient(id, patientForm);
      setPatient(updated);
      setEditPatientModal(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const openAddTargetModal = () => {
    setEditingTarget(null);
    setTargetForm({
      type: TARGET_TYPES.SOUND,
      value: '',
      language: 'English (US)',
      difficulty: 'Beginner',
      examples: '',
      soundDescription: '',
      relatedPhrases: '',
      context: '',
      notes: '',
    });
    setTargetModalOpen(true);
  };

  const openEditTargetModal = (target) => {
    setEditingTarget(target);
    setTargetForm({
      type: target.type,
      value: target.value,
      language: target.language || 'English (US)',
      difficulty: target.difficulty || 'Beginner',
      examples: Array.isArray(target.examples) ? target.examples.join(', ') : target.examples || '',
      soundDescription: target.soundDescription || '',
      relatedPhrases: target.relatedPhrases || '',
      context: target.context || '',
      notes: target.notes || '',
    });
    setTargetModalOpen(true);
  };

  const handleSaveTarget = async (e) => {
    e.preventDefault();
    if (!targetForm.value.trim()) {
      alert('Target value is required');
      return;
    }
    try {
      if (editingTarget) {
        await targetService.updateTarget(editingTarget.id, targetForm);
      } else {
        await targetService.createTarget({ ...targetForm, patientId: id });
      }
      setTargetModalOpen(false);
      await loadAllData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteTarget = async (targetId) => {
    if (window.confirm('Delete this speech target?')) {
      try {
        await targetService.deleteTarget(targetId);
        await loadAllData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleApproveExercise = async (exerciseId) => {
    try {
      await exerciseService.approveExercise(exerciseId);
      await loadAllData();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading && !patient) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-xs text-[#687386]">
        Loading patient profile...
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[#687386]">Patient not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/therapist/patients')}>
          Back to Patients
        </Button>
      </div>
    );
  }

  const activeAssignments = assignments.filter((a) => a.status !== 'COMPLETED');
  const completedAssignments = assignments.filter((a) => a.status === 'COMPLETED');

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <button
          onClick={() => navigate('/therapist/patients')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#687386] hover:text-[#172033] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Patients
        </button>
      </div>

      {/* Patient Header Card */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-[#5865E8] font-bold text-xl flex items-center justify-center shrink-0">
              {patient.name.charAt(0)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[#172033]">{patient.name}</h1>
                <StatusBadge status={patient.status} />
              </div>
              <p className="text-xs text-[#687386] mt-1 font-mono">
                ID: {patient.id} • Enrolled {formatDate(patient.createdAt)}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2">
                <span>{patient.email}</span>
                {patient.phone && <span>• {patient.phone}</span>}
                <span>• Last practice: {formatTimeAgo(patient.lastPracticeDate)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditPatientModal(true)}
              leftIcon={Edit}
            >
              Edit Patient
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/therapist/assignments?patientId=${patient.id}`)}
              leftIcon={ClipboardList}
            >
              Assign Exercise
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/therapist/exercise-generator?patientId=${patient.id}`)}
              leftIcon={Sparkles}
            >
              Generate AI Exercise
            </Button>
          </div>
        </div>

        {patient.notes && (
          <div className="mt-4 pt-4 border-t border-[#E5E9F2] text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
            <span className="font-semibold text-[#172033]">Clinical Therapy Notes: </span>
            {patient.notes}
          </div>
        )}
      </Card>

      {/* Profile Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5E9F2] overflow-x-auto pb-1 text-sm">
        {[
          { key: 'overview', label: 'Overview', icon: User },
          { key: 'targets', label: `Targets (${targets.length})`, icon: Target },
          { key: 'exercises', label: `Exercises (${exercises.length})`, icon: FileCheck },
          { key: 'attempts', label: `Attempts (${attempts.length})`, icon: Mic },
          { key: 'progress', label: 'Progress & Adherence', icon: TrendingUp },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'border-[#5865E8] text-[#5865E8]'
                  : 'border-transparent text-[#687386] hover:text-[#172033]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Active Assignments */}
            <Card>
              <CardHeader
                title="Current Practice Assignments"
                description="Exercises actively assigned to this patient"
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/therapist/assignments?patientId=${patient.id}`)}
                    rightIcon={ArrowRight}
                  >
                    Manage
                  </Button>
                }
              />

              {activeAssignments.length > 0 ? (
                <div className="space-y-3">
                  {activeAssignments.map((a) => (
                    <div
                      key={a.id}
                      className="p-3.5 bg-slate-50 border border-[#E5E9F2] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#172033]">{a.exercise?.title}</span>
                          <StatusBadge status={a.status} />
                        </div>
                        <p className="text-xs text-[#687386] mt-0.5">
                          Target: <span className="font-medium text-[#172033]">{a.target?.value || 'Target'}</span> • Repetitions:{' '}
                          <span className="font-medium text-[#172033]">
                            {a.completedRepetitions} / {a.repetitions}
                          </span>
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">Due: {formatDate(a.dueDate)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#687386] text-center py-6">
                  No active assignments. Click "Assign Exercise" to set practice.
                </p>
              )}
            </Card>

            {/* Recent Practice Attempts */}
            <Card>
              <CardHeader
                title="Recent Practice Attempts"
                description="Audio recordings submitted by the patient"
              />

              {attempts.length > 0 ? (
                <div className="space-y-3">
                  {attempts.slice(0, 3).map((att) => (
                    <div key={att.id} className="p-3 bg-slate-50 border border-[#E5E9F2] rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#172033]">Target: {att.target?.value}</span>
                        <span className="text-slate-400">{formatTimeAgo(att.createdAt)}</span>
                      </div>
                      <AudioPlayer
                        src={att.audioBlobUrl} recordingId={att.audioId}
                        title={`Spoken: "${att.transcript || att.targetText}"`}
                      />
                      {att.recognitionEvidence && (
                        <p className="text-[11px] text-slate-500 italic bg-white p-2 rounded border border-slate-100">
                          {att.recognitionEvidence}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#687386] text-center py-6">No practice attempts recorded yet.</p>
              )}
            </Card>
          </div>

          {/* Right Column: Targets quick list & Practice summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Assigned Targets"
                action={
                  <Button variant="ghost" size="sm" onClick={openAddTargetModal} leftIcon={Plus}>
                    Add
                  </Button>
                }
              />
              <div className="space-y-2.5">
                {targets.map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-lg border border-[#E5E9F2] bg-slate-50/50 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-[#172033]">{t.value}</span>
                        <Badge variant="teal">{t.type}</Badge>
                      </div>
                      <p className="text-[11px] text-[#687386] mt-0.5 line-clamp-1">
                        {t.soundDescription || t.context || t.examples?.join(', ')}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">{t.difficulty}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-[#172033] mb-3">Practice Activity Summary</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-[#687386]">Total Practice Attempts:</span>
                  <span className="font-bold text-[#172033]">{attempts.length}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-[#687386]">Completed Assignments:</span>
                  <span className="font-bold text-emerald-600">{completedAssignments.length}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-[#687386]">Active Tasks:</span>
                  <span className="font-bold text-[#5865E8]">{activeAssignments.length}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-[#687386]">Target Count:</span>
                  <span className="font-bold text-[#172033]">{targets.length}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: TARGETS */}
      {activeTab === 'targets' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-[#172033]">Patient Articulation Targets</h3>
              <p className="text-xs text-[#687386]">
                Configure target sounds, syllables, words, phrases, sentences, or everyday use scenarios
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={openAddTargetModal} leftIcon={Plus}>
              Add Target
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {targets.map((t) => {
              const details = TARGET_TYPE_DETAILS[t.type] || {};
              return (
                <Card key={t.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-[#172033]">{t.value}</span>
                        <Badge variant="primary">{t.type}</Badge>
                        <Badge variant="default">{t.difficulty}</Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{details.label}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditTargetModal(t)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Edit target"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTarget(t.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete target"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {t.soundDescription && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
                      <span className="font-semibold text-slate-700">Articulation Guide: </span>
                      {t.soundDescription}
                    </div>
                  )}

                  {t.context && (
                    <div className="text-xs text-slate-600 bg-purple-50 p-2.5 rounded-lg">
                      <span className="font-semibold text-purple-800">Conversational Context: </span>
                      {t.context}
                    </div>
                  )}

                  {t.examples && t.examples.length > 0 && (
                    <div className="text-xs">
                      <span className="font-semibold text-[#687386]">Examples: </span>
                      <span className="text-[#172033]">{t.examples.join(', ')}</span>
                    </div>
                  )}

                  {t.notes && (
                    <div className="text-xs text-slate-500 italic">
                      Note: {t.notes}
                    </div>
                  )}

                  {/* Target progression preview */}
                  <div className="pt-2 border-t border-[#E5E9F2]">
                    <div className="text-[11px] font-semibold text-slate-400 mb-1">Recommended Progression:</div>
                    <div className="flex flex-wrap items-center gap-1">
                      {(details.defaultProgression || ['Practice']).map((step, idx) => (
                        <React.Fragment key={step}>
                          <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                            {step}
                          </span>
                          {idx < details.defaultProgression.length - 1 && (
                            <span className="text-slate-300 text-[10px]">→</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="tealSubtle"
                      size="sm"
                      onClick={() => navigate(`/therapist/exercise-generator?patientId=${patient.id}&targetId=${t.id}`)}
                      rightIcon={Sparkles}
                    >
                      Generate Exercises for Target
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: EXERCISES */}
      {activeTab === 'exercises' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-semibold text-[#172033]">Patient Exercises</h3>
              <p className="text-xs text-[#687386]">Manage generated, approved, and assigned speech exercises</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate(`/therapist/exercise-generator?patientId=${patient.id}`)}
              leftIcon={Sparkles}
            >
              Generate New Exercise
            </Button>
          </div>

          <div className="space-y-3">
            {exercises.map((ex) => (
              <Card key={ex.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#172033]">{ex.title}</span>
                    <StatusBadge status={ex.status} />
                    <Badge variant="default">{ex.level}</Badge>
                  </div>
                  <p className="text-xs text-[#687386]">{ex.instructions}</p>
                  <p className="text-xs text-slate-500 font-mono mt-1">
                    Prompt: "{ex.content?.prompt || 'Target prompt'}"
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {ex.status === 'DRAFT' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleApproveExercise(ex.id)}
                      leftIcon={CheckCircle}
                    >
                      Approve
                    </Button>
                  )}
                  {ex.status === 'APPROVED' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/therapist/assignments?patientId=${patient.id}&exerciseId=${ex.id}`)}
                      leftIcon={ClipboardList}
                    >
                      Assign
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: ATTEMPTS */}
      {activeTab === 'attempts' && (
        <div className="space-y-4">
          <h3 className="text-base font-semibold text-[#172033]">Recorded Practice Attempts</h3>
          <p className="text-xs text-[#687386]">
            Review audio recordings, acoustic speech recognition waveforms, and progress notes
          </p>

          {attempts.length > 0 ? (
            <div className="space-y-4">
              {attempts.map((att) => (
                <Card key={att.id} className="p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#172033]">Target: {att.target?.value || att.targetText}</span>
                        <Badge variant="teal">{att.exercise?.title || 'Practice'}</Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(att.createdAt)}</p>
                    </div>

                    <span className="text-xs text-[#687386] font-mono">
                      Duration: {att.recordingDuration ? `${att.recordingDuration}s` : '3s'}
                    </span>
                  </div>

                  {/* Audio Playback Player */}
                  <AudioPlayer
                    src={att.audioBlobUrl} recordingId={att.audioId}
                    title={`Recording: "${att.transcript || att.targetText}"`}
                  />

                  <Link className="text-xs font-semibold text-[#5865E8]" to={'/therapist/attempts?patientId=' + patient.id}>Review feedback and word alignment</Link>
                  {/* Recognition comparison and evidence */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="font-semibold text-[#687386] block mb-1">Target Articulation:</span>
                      <span className="font-mono text-sm text-[#172033] bg-white px-2 py-1 rounded border border-slate-200 inline-block">
                        {att.targetText || att.target?.value}
                      </span>
                    </div>

                    <div>
                      <span className="font-semibold text-[#687386] block mb-1">Recognized Transcript:</span>
                      <span className="font-mono text-sm text-emerald-700 bg-white px-2 py-1 rounded border border-slate-200 inline-block">
                        {att.transcript || 'Not analyzed'}
                      </span>
                    </div>

                    {att.recognitionEvidence && (
                      <div className="sm:col-span-2 pt-2 border-t border-slate-200">
                        <span className="font-semibold text-slate-600 block mb-0.5">
                          Demo observation:
                        </span>
                        <p className="text-slate-600 italic">{att.recognitionEvidence}</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <p className="text-xs text-[#687386]">No practice attempts recorded for this patient yet.</p>
            </Card>
          )}
        </div>
      )}

      {/* Tab 5: PROGRESS */}
      {activeTab === 'progress' && (
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Practice Adherence & Target Progress"
              description="Clinical practice volume, attempt history, and initial vs latest attempt milestones"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
                <span className="text-xs text-[#5865E8] font-semibold uppercase">Total Attempts</span>
                <p className="text-2xl font-bold text-[#172033] mt-1">{progressData?.totalAttempts || 0}</p>
              </div>

              <div className="p-4 bg-teal-50/60 rounded-xl border border-teal-100">
                <span className="text-xs text-[#2BAE9B] font-semibold uppercase">Completed Exercises</span>
                <p className="text-2xl font-bold text-[#172033] mt-1">{progressData?.completedAssignmentsCount || 0}</p>
              </div>

              <div className="p-4 bg-purple-50/60 rounded-xl border border-purple-100">
                <span className="text-xs text-purple-700 font-semibold uppercase">Targets Practised</span>
                <p className="text-2xl font-bold text-[#172033] mt-1">
                  {progressData?.targetsPracticedCount || 0} / {progressData?.totalTargetsCount || 0}
                </p>
              </div>
            </div>

            {/* Target Breakdown & First vs Latest Attempt comparison */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-[#172033]">Target Milestone Comparison</h4>
              {progressData?.targetBreakdown && progressData.targetBreakdown.length > 0 ? (
                progressData.targetBreakdown.map((item) => (
                  <div key={item.target.id} className="p-4 border border-[#E5E9F2] rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base text-[#172033]">{item.target.value}</span>
                        <Badge variant="primary">{item.target.type}</Badge>
                      </div>
                      <span className="text-xs font-semibold text-[#5865E8]">
                        {item.attemptCount} recorded practice attempt{item.attemptCount === 1 ? '' : 's'}
                      </span>
                    </div>

                    {item.firstAttempt && item.latestAttempt ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <span className="text-slate-400 block font-semibold mb-1">
                            First Attempt ({formatDate(item.firstAttempt.createdAt)}):
                          </span>
                          <p className="font-mono text-slate-700">Target: {item.firstAttempt.targetText}</p>
                          <p className="text-slate-500 mt-1 italic text-[11px]">{item.firstAttempt.recognitionEvidence}</p>
                        </div>

                        <div className="p-3 bg-emerald-50/70 rounded-lg border border-emerald-200">
                          <span className="text-emerald-700 block font-semibold mb-1">
                            Latest Attempt ({formatDate(item.latestAttempt.createdAt)}):
                          </span>
                          <p className="font-mono text-emerald-900">Target: {item.latestAttempt.targetText}</p>
                          <p className="text-emerald-800 mt-1 italic text-[11px]">{item.latestAttempt.recognitionEvidence}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No attempts recorded for this target yet.</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#687386]">No targets configured.</p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Add / Edit Target Modal (Dynamic fields per target type!) */}
      <Modal
        isOpen={targetModalOpen}
        onClose={() => setTargetModalOpen(false)}
        title={editingTarget ? `Edit Speech Target: ${editingTarget.value}` : 'Add New Speech Target'}
        description="Configure phoneme, syllable, word, phrase, sentence, or everyday functional communication goals."
      >
        <form onSubmit={handleSaveTarget} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Target Type"
              value={targetForm.type}
              onChange={(e) => setTargetForm({ ...targetForm, type: e.target.value })}
              options={Object.values(TARGET_TYPES).map((type) => ({
                value: type,
                label: TARGET_TYPE_DETAILS[type]?.label || type,
              }))}
            />

            <Select
              label="Difficulty Level"
              value={targetForm.difficulty}
              onChange={(e) => setTargetForm({ ...targetForm, difficulty: e.target.value })}
              options={DIFFICULTY_LEVELS}
            />
          </div>

          {/* Dynamic field 1: Target Value */}
          <Input
            label={
              targetForm.type === TARGET_TYPES.SOUND
                ? 'Target Phoneme Sound (e.g. /ʃ/, /θ/, /r/, /s/)'
                : targetForm.type === TARGET_TYPES.SYLLABLE
                ? 'Target Syllable (e.g. sha, she, sho)'
                : targetForm.type === TARGET_TYPES.WORD
                ? 'Target Word (e.g. ship, three, rabbit)'
                : targetForm.type === TARGET_TYPES.PHRASE
                ? 'Target Phrase (e.g. three apples, red ribbon)'
                : targetForm.type === TARGET_TYPES.SENTENCE
                ? 'Target Sentence (e.g. I have three red apples.)'
                : 'Everyday Scenario / Functional Topic (e.g. Ordering at a café)'
            }
            placeholder={TARGET_TYPE_DETAILS[targetForm.type]?.examplePrompt || 'Enter target...'}
            required
            value={targetForm.value}
            onChange={(e) => setTargetForm({ ...targetForm, value: e.target.value })}
          />

          {/* Dynamic field 2: Articulation / Sound Description for SOUND & SYLLABLE */}
          {(targetForm.type === TARGET_TYPES.SOUND || targetForm.type === TARGET_TYPES.SYLLABLE) && (
            <Textarea
              label="Articulatory Placement & Movement Guidance"
              placeholder="e.g. Voiceless palato-alveolar fricative. Soft lip rounding, light airflow without dental tongue contact."
              value={targetForm.soundDescription}
              onChange={(e) => setTargetForm({ ...targetForm, soundDescription: e.target.value })}
            />
          )}

          {/* Dynamic field 3: Conversational context for EVERYDAY USE */}
          {targetForm.type === TARGET_TYPES.EVERYDAY_USE && (
            <Textarea
              label="Functional Communication Context"
              placeholder="e.g. Ordering food at a counter, asking directions politely, introducing oneself..."
              value={targetForm.context}
              onChange={(e) => setTargetForm({ ...targetForm, context: e.target.value })}
            />
          )}

          {/* Dynamic field 4: Related phrases / words */}
          {(targetForm.type === TARGET_TYPES.WORD ||
            targetForm.type === TARGET_TYPES.PHRASE ||
            targetForm.type === TARGET_TYPES.SENTENCE) && (
            <Input
              label="Related Target Words / Phrases"
              placeholder="e.g. blue ship, red ship, sailing"
              value={targetForm.relatedPhrases}
              onChange={(e) => setTargetForm({ ...targetForm, relatedPhrases: e.target.value })}
            />
          )}

          {/* Example Words */}
          <Input
            label="Example Practice Words / Expressions (comma separated)"
            placeholder="e.g. ship, shoe, ocean, wash"
            value={targetForm.examples}
            onChange={(e) => setTargetForm({ ...targetForm, examples: e.target.value })}
          />

          <Textarea
            label="Therapist Notes (Optional)"
            placeholder="Specific cues, reminders, or auditory discrimination prompts..."
            value={targetForm.notes}
            onChange={(e) => setTargetForm({ ...targetForm, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E9F2]">
            <Button variant="outline" onClick={() => setTargetModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingTarget ? 'Save Target' : 'Create Target'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Patient Info Modal */}
      <Modal
        isOpen={editPatientModal}
        onClose={() => setEditPatientModal(false)}
        title="Edit Patient Information"
      >
        <form onSubmit={handleUpdatePatient} className="space-y-4">
          <Input
            label="Patient Name"
            required
            value={patientForm.name}
            onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })}
          />

          <Input
            label="Email Address"
            type="email"
            required
            value={patientForm.email}
            onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Phone"
              value={patientForm.phone}
              onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
            />
            <Select
              label="Status"
              value={patientForm.status}
              onChange={(e) => setPatientForm({ ...patientForm, status: e.target.value })}
              options={['Active', 'Needs Attention', 'New', 'Inactive']}
            />
          </div>

          <Textarea
            label="Clinical Therapy Notes"
            value={patientForm.notes}
            onChange={(e) => setPatientForm({ ...patientForm, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E9F2]">
            <Button variant="outline" onClick={() => setEditPatientModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

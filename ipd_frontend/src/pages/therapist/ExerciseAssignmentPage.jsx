import { storage } from '../../mocks/storage';
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ClipboardList,
  CheckCircle2,
  Calendar,
  Repeat,
  Sparkles,
  ArrowRight,
  User,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { patientService } from '../../services/patientService';
import { exerciseService } from '../../services/exerciseService';
import { assignmentService } from '../../services/assignmentService';
import { formatDate } from '../../utils/formatters';

export function ExerciseAssignmentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [patients, setPatients] = useState([]);
  const [availableExercises, setAvailableExercises] = useState([]);
  const [patientAssignments, setPatientAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedPatientId, setSelectedPatientId] = useState(searchParams.get('patientId') || '');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState(
    searchParams.get('exerciseId') ? [searchParams.get('exerciseId')] : []
  );

  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0]
  );
  const [repetitions, setRepetitions] = useState(() => Number(storage.getSettings().defaultRepetitions));
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const loadData = async (patientId) => {
    try {
      setLoading(true);
      const pList = await patientService.getPatients();
      setPatients(pList);

      const activePid = patientId || selectedPatientId || pList[0]?.id;
      if (activePid) {
        setSelectedPatientId(activePid);
        const [exList, asList] = await Promise.all([
          exerciseService.getExercisesByPatient(activePid),
          assignmentService.getAssignmentsByPatient(activePid),
        ]);
        // All approved or draft exercises that can be assigned
        setAvailableExercises(exList.filter(ex => ['APPROVED','ASSIGNED'].includes(ex.status)));
        setPatientAssignments(asList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePatientChange = async (pid) => {
    setSelectedPatientId(pid);
    setSelectedExerciseIds([]);
    setSuccessMessage('');
    await loadData(pid);
  };

  const toggleSelectExercise = (id) => {
    setSelectedExerciseIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (selectedExerciseIds.length === 0) {
      alert('Please select at least one exercise to assign.');
      return;
    }

    try {
      setSubmitting(true);
      setSuccessMessage('');

      await assignmentService.assignExercises({
        patientId: selectedPatientId,
        exerciseIds: selectedExerciseIds,
        dueDate: new Date(dueDate).toISOString(),
        repetitions: Number(repetitions),
      });

      setSuccessMessage(
        `Successfully assigned ${selectedExerciseIds.length} exercise(s) with ${repetitions} required repetitions.`
      );
      setSelectedExerciseIds([]);
      await loadData(selectedPatientId);
    } catch (err) {
      alert('Assignment failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const activePatient = patients.find((p) => p.id === selectedPatientId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-50 text-[#2BAE9B]">
              <ClipboardList className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172033]">
              Assign Speech Practice
            </h1>
          </div>
          <p className="text-sm text-[#687386] mt-1">
            Dispatch approved exercises and set repetition goals for home practice sessions
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/therapist/exercise-generator?patientId=${selectedPatientId}`)}
          leftIcon={Sparkles}
        >
          Create New Exercise First
        </Button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/therapist/patients/${selectedPatientId}`)}
            rightIcon={ArrowRight}
          >
            View Patient Profile
          </Button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Patient & Config (1 Col) */}
        <div className="space-y-6">
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[#172033]">1. Select Patient</h3>
            <Select
              label="Recipient Patient"
              value={selectedPatientId}
              onChange={(e) => handlePatientChange(e.target.value)}
              options={patients.map((p) => ({ value: p.id, label: p.name }))}
            />

            {activePatient && (
              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg space-y-1">
                <div>
                  <span className="font-semibold text-slate-700">Email: </span>
                  {activePatient.email}
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Clinical Status: </span>
                  <StatusBadge status={activePatient.status} />
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[#172033]">2. Schedule Parameters</h3>

            <div>
              <label className="block text-xs font-semibold text-[#172033] tracking-wide mb-1.5">
                Target Repetitions per Exercise
              </label>
              <div className="flex items-center gap-2">
                {[3, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setRepetitions(num)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                      repetitions === num
                        ? 'border-[#5865E8] bg-[#EEF0FD] text-[#5865E8]'
                        : 'border-[#E5E9F2] bg-white hover:bg-slate-50 text-[#172033]'
                    }`}
                  >
                    {num} times
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Assignment Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />

            <Button
              variant="primary"
              className="w-full mt-4"
              onClick={handleAssign}
              isLoading={submitting}
              disabled={selectedExerciseIds.length === 0}
            >
              Assign {selectedExerciseIds.length} Selected Task(s)
            </Button>
          </Card>
        </div>

        {/* Right Area: Exercises Selection & Current Assignments (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <CardHeader
              title={`Available Exercises for ${activePatient?.name || 'Patient'}`}
              description="Check the exercises you wish to assign for home practice"
            />

            {availableExercises.length > 0 ? (
              <div className="space-y-3">
                {availableExercises.map((ex) => {
                  const isSelected = selectedExerciseIds.includes(ex.id);
                  const isAlreadyAssigned = patientAssignments.some(
                    (a) => a.exerciseId === ex.id && a.status !== 'COMPLETED'
                  );

                  return (
                    <div
                      key={ex.id}
                      onClick={() => toggleSelectExercise(ex.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'border-[#5865E8] bg-indigo-50/40 shadow-xs'
                          : 'border-[#E5E9F2] bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 border ${
                          isSelected
                            ? 'bg-[#5865E8] border-[#5865E8] text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-[#172033]">{ex.title}</span>
                          <StatusBadge status={ex.status} />
                          <Badge variant="default">{ex.level}</Badge>
                          {isAlreadyAssigned && (
                            <Badge variant="warning">Already Active</Badge>
                          )}
                        </div>
                        <p className="text-xs text-[#687386] mt-1">{ex.instructions}</p>
                        <p className="text-xs text-indigo-700 font-mono mt-1">
                          Prompt: "{ex.content?.prompt}"
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-[#687386] space-y-3">
                <p>No exercises created for this patient yet.</p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(`/therapist/exercise-generator?patientId=${selectedPatientId}`)}
                  leftIcon={Sparkles}
                >
                  Generate First Exercise
                </Button>
              </div>
            )}
          </Card>

          {/* Current Active Assignments for Reference */}
          <Card className="p-6">
            <CardHeader
              title="Active Assignments in Progress"
              description="Current status and practice repetition counts for this patient"
            />

            {patientAssignments.length > 0 ? (
              <div className="space-y-3">
                {patientAssignments.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 bg-slate-50 border border-[#E5E9F2] rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#172033] block">{a.exercise?.title}</span>
                      <span className="text-[#687386]">
                        Progress: {a.completedRepetitions} / {a.repetitions} repetitions completed
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <StatusBadge status={a.status} />
                      <span className="text-slate-400">Due {formatDate(a.dueDate)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#687386] text-center py-4">No assignments currently on file.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

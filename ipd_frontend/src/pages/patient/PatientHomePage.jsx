import { useActivePatient } from '../../hooks/useActivePatient';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mic,
  CheckCircle2,
  Clock,
  ArrowRight,
  Flame,
  Volume2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { AudioPlayer } from '../../components/ui/AudioPlayer';
import { storage } from '../../mocks/storage';
import { assignmentService } from '../../services/assignmentService';
import { attemptService } from '../../services/attemptService';
import { patientService } from '../../services/patientService';
import { formatTimeAgo, formatDate } from '../../utils/formatters';

export function PatientHomePage() {
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  const activePatientId = useActivePatient();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [p, asList, attList] = await Promise.all([
          patientService.getPatientById(activePatientId),
          assignmentService.getAssignmentsByPatient(activePatientId),
          attemptService.getAttemptsByPatient(activePatientId),
        ]);
        setPatient(p);
        setAssignments(asList);
        setRecentAttempts(attList.slice(0, 3));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activePatientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-xs text-[#687386]">
        Loading your practice...
      </div>
    );
  }

  const activeAssignments = assignments.filter((a) => a.status !== 'COMPLETED');
  const completedAssignments = assignments.filter((a) => a.status === 'COMPLETED');
  const nextAssignment = activeAssignments[0] || assignments[0];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E5E9F2] shadow-xs relative overflow-hidden">
        <div className="max-w-md space-y-2">
          <span className="text-xs font-semibold text-[#2BAE9B] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" /> Daily Speech Practice
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#172033] tracking-tight">
            Hello, {patient?.name?.split(' ')[0] || 'Friend'}!
          </h1>
          <p className="text-sm text-[#687386] leading-relaxed">
            Ready to practise speaking today? Consistent, relaxed practice helps build confidence.
          </p>

          <div className="pt-3">
            {nextAssignment ? (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate(`/patient/practice/session/${nextAssignment.exerciseId}?assignmentId=${nextAssignment.id}`)}
                leftIcon={Mic}
                className="w-full sm:w-auto shadow-md"
              >
                Start Today's Practice
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate('/patient/practice')}
                rightIcon={ArrowRight}
              >
                View Practice List
              </Button>
            )}
          </div>
        </div>

        {/* Ambient decorative badge */}
        <div className="hidden sm:flex absolute right-6 top-6 bottom-6 w-44 bg-gradient-to-br from-teal-50 to-indigo-50/40 rounded-2xl border border-teal-100 flex-col items-center justify-center text-center p-4">
          <div className="w-12 h-12 rounded-full bg-white shadow-xs flex items-center justify-center text-[#2BAE9B] mb-2">
            <Mic className="w-6 h-6" />
          </div>
          <span className="text-xs font-semibold text-slate-700">Practice Goal</span>
          <span className="text-lg font-bold text-[#2BAE9B] mt-0.5">
            {completedAssignments.length} / {assignments.length || 1}
          </span>
          <span className="text-[11px] text-slate-400">tasks completed</span>
        </div>
      </div>

      {/* Today's Tasks Overview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#172033]">Assigned For You</h2>
          <button
            onClick={() => navigate('/patient/practice')}
            className="text-xs font-semibold text-[#2BAE9B] hover:underline flex items-center gap-1 cursor-pointer"
          >
            See all ({assignments.length}) <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeAssignments.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {activeAssignments.map((a) => (
              <Card
                key={a.id}
                hover
                onClick={() =>
                  navigate(`/patient/practice/session/${a.exerciseId}?assignmentId=${a.id}`)
                }
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-[#172033]">{a.exercise?.title}</span>
                    <Badge variant="teal">{a.target?.value || 'Target'}</Badge>
                  </div>
                  <p className="text-xs text-[#687386] line-clamp-1">{a.exercise?.instructions}</p>
                  <p className="text-xs text-slate-400">
                    Repetitions: <span className="font-semibold text-slate-700">{a.completedRepetitions} of {a.repetitions} completed</span>
                  </p>
                </div>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/patient/practice/session/${a.exerciseId}?assignmentId=${a.id}`);
                  }}
                  leftIcon={Mic}
                  className="shrink-0"
                >
                  Practise Now
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-10 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-[#172033]">You're All Caught Up!</h3>
            <p className="text-xs text-[#687386]">
              Great job! You have completed all assigned exercises for today.
            </p>
          </Card>
        )}
      </div>

      {/* Recent Practice History */}
      {recentAttempts.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="text-base font-bold text-[#172033]">Your Recent Recordings</h2>
          <div className="space-y-3">
            {recentAttempts.map((att) => (
              <Card key={att.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#172033]">
                    Target: "{att.targetText || att.target?.value}"
                  </span>
                  <span className="text-slate-400">{formatTimeAgo(att.createdAt)}</span>
                </div>
                <AudioPlayer
                  src={att.audioBlobUrl} recordingId={att.audioId}
                  title={`Your recording: ${att.targetText}`}
                />
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

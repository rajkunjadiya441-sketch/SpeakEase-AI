import { useActivePatient } from '../../hooks/useActivePatient';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, CheckCircle, Clock, Volume2, ArrowRight } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { storage } from '../../mocks/storage';
import { assignmentService } from '../../services/assignmentService';
import { formatDate } from '../../utils/formatters';

export function AssignedPracticePage() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState([]);
  const [filter, setFilter] = useState('ALL'); // ALL, IN_PROGRESS, COMPLETED
  const [loading, setLoading] = useState(true);

  const activePatientId = useActivePatient();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await assignmentService.getAssignmentsByPatient(activePatientId);
        setAssignments(data);
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
        Loading your assigned exercises...
      </div>
    );
  }

  const filtered = assignments.filter((a) => {
    if (filter === 'IN_PROGRESS') return a.status !== 'COMPLETED';
    if (filter === 'COMPLETED') return a.status === 'COMPLETED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#172033]">My Practice Exercises</h1>
        <p className="text-sm text-[#687386] mt-1">
          Exercises curated and prescribed by your speech therapist
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5E9F2] pb-2">
        {[
          { key: 'ALL', label: `All (${assignments.length})` },
          { key: 'IN_PROGRESS', label: `To Do (${assignments.filter((a) => a.status !== 'COMPLETED').length})` },
          { key: 'COMPLETED', label: `Completed (${assignments.filter((a) => a.status === 'COMPLETED').length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              filter === tab.key
                ? 'bg-[#2BAE9B] text-white shadow-xs'
                : 'bg-white text-[#687386] hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Exercises List */}
      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map((a) => {
            const isCompleted = a.status === 'COMPLETED';
            return (
              <Card key={a.id} className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg text-[#172033]">{a.exercise?.title}</span>
                      <StatusBadge status={a.status} />
                    </div>
                    <p className="text-xs text-[#687386]">{a.exercise?.instructions}</p>
                  </div>

                  <Badge variant="teal" size="md">
                    {a.target?.type || 'Target'}
                  </Badge>
                </div>

                {/* Target prompt preview */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block text-[11px]">Focus Prompt:</span>
                    <span className="font-mono text-base font-bold text-[#172033]">
                      "{a.exercise?.content?.prompt}"
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">Progress:</span>
                    <span className="font-bold text-[#2BAE9B] text-sm">
                      {a.completedRepetitions} / {a.repetitions} repetitions
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-400">Due {formatDate(a.dueDate)}</span>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        navigate(`/patient/practice/details/${a.exerciseId}?assignmentId=${a.id}`)
                      }
                    >
                      Instructions
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        navigate(`/patient/practice/session/${a.exerciseId}?assignmentId=${a.id}`)
                      }
                      leftIcon={Mic}
                    >
                      {isCompleted ? 'Practise Again' : 'Start Practice'}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="text-center py-12 text-xs text-[#687386]">
            No exercises found for this category.
          </Card>
        )}
      </div>
    </div>
  );
}

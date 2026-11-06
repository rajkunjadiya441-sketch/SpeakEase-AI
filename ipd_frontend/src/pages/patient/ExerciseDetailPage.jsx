import { useActivePatient } from '../../hooks/useActivePatient';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Mic, Volume2, BookOpen, Sparkles, CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { AudioPlayer } from '../../components/ui/AudioPlayer';
import { exerciseService } from '../../services/exerciseService';
import { targetService } from '../../services/targetService';

export function ExerciseDetailPage() {
  const { id } = useParams();
  const patientId = useActivePatient();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignmentId');
  const navigate = useNavigate();

  const [exercise, setExercise] = useState(null);
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const ex = await exerciseService.getExerciseById(id);
        if (ex.patientId !== patientId) throw new Error('Exercise is not available for this patient.');
        setExercise(ex);
        if (ex.targetId) {
          const t = await targetService.getTargetById(ex.targetId);
          setTarget(t);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, patientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-xs text-[#687386]">
        Loading exercise details...
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="text-center py-12">
        <p className="text-xs text-[#687386]">Exercise not found.</p>
        <Button variant="outline" className="mt-3" onClick={() => navigate('/patient/practice')}>
          Back to Practice
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/patient/practice')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#687386] hover:text-[#172033] transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to My Practice
      </button>

      <Card className="p-6 sm:p-8 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="teal">{exercise.level}</Badge>
            <Badge variant="default">{exercise.difficulty}</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#172033] mt-2 tracking-tight">
            {exercise.title}
          </h1>
          <p className="text-sm text-[#687386] mt-1">{exercise.instructions}</p>
        </div>

        {/* Large Target Prompt Callout */}
        <div className="p-6 bg-gradient-to-br from-teal-50/50 to-indigo-50/30 border border-teal-100 rounded-2xl text-center space-y-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Practice Target Prompt
          </span>
          <div className="text-3xl sm:text-4xl font-extrabold text-[#172033] font-mono">
            {exercise.content?.prompt || target?.value}
          </div>
          {exercise.content?.phonetic && (
            <p className="text-sm text-indigo-700 font-mono font-medium">
              IPA: {exercise.content.phonetic}
            </p>
          )}
        </div>

        {/* Reference Audio Player */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#172033] block">
            Listen to Model Reference Pronunciation:
          </label>
          <AudioPlayer
            speechText={exercise.content?.prompt || target?.value}
            title={`Model Audio: "${exercise.content?.prompt || target?.value}"`}
          />
        </div>

        {/* Articulation Guidance */}
        {target?.soundDescription && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#2BAE9B]" /> Therapist Articulation Tips
            </span>
            <p className="text-xs text-slate-600 leading-relaxed">{target.soundDescription}</p>
          </div>
        )}

        {/* Example Words */}
        {exercise.content?.exampleWords && exercise.content.exampleWords.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#687386]">Related Practice Words:</span>
            <div className="flex flex-wrap gap-2">
              {exercise.content.exampleWords.map((word) => (
                <span
                  key={word}
                  className="px-3 py-1 bg-white border border-[#E5E9F2] rounded-lg text-xs font-medium text-[#172033]"
                >
                  {word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Start Button */}
        <div className="pt-4 border-t border-[#E5E9F2] flex justify-end">
          <Button
            variant="secondary"
            size="lg"
            onClick={() =>
              navigate(
                `/patient/practice/session/${exercise.id}${
                  assignmentId ? `?assignmentId=${assignmentId}` : ''
                }`
              )
            }
            leftIcon={Mic}
          >
            Start Practice Session
          </Button>
        </div>
      </Card>
    </div>
  );
}

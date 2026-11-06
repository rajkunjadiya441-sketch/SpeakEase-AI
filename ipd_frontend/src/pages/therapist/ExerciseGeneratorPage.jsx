import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Edit3,
  RotateCw,
  ClipboardList,
  Target,
  User,
  Sliders,
  Check,
  Brain,
  Info,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { patientService } from '../../services/patientService';
import { targetService } from '../../services/targetService';
import { exerciseService } from '../../services/exerciseService';
import {
  TARGET_TYPES,
  TARGET_TYPE_DETAILS,
  PRACTICE_LEVELS,
  DIFFICULTY_LEVELS,
  EXERCISE_TYPES,
} from '../../constants/targets';

export function ExerciseGeneratorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Wizard state: 1 = Configure, 2 = Generate (transition animation), 3 = Review & Approve
  const [step, setStep] = useState(1);

  const [patients, setPatients] = useState([]);
  const [patientTargets, setPatientTargets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Configuration Form State
  const [config, setConfig] = useState({
    patientId: searchParams.get('patientId') || '',
    targetId: searchParams.get('targetId') || '',
    practiceLevel: PRACTICE_LEVELS[2], // Single Word Practice
    difficulty: 'Beginner',
    exerciseType: 'REPETITION',
    exampleWords: '',
    customNotes: '',
  });

  // Generated Exercises in Step 3
  const [generatedExercises, setGeneratedExercises] = useState([]);
  const [editingCardId, setEditingCardId] = useState(null);
  const [approvedIds, setApprovedIds] = useState(new Set());
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        const pList = await patientService.getPatients();
        setPatients(pList);

        const initialPatientId = config.patientId || pList[0]?.id;
        if (initialPatientId) {
          setConfig((prev) => ({ ...prev, patientId: initialPatientId }));
          const tList = await targetService.getTargetsByPatient(initialPatientId);
          setPatientTargets(tList);

          const initialTargetId = config.targetId || tList[0]?.id;
          if (initialTargetId) {
            const selectedT = tList.find((t) => t.id === initialTargetId) || tList[0];
            setConfig((prev) => ({
              ...prev,
              targetId: selectedT?.id || '',
              exampleWords: Array.isArray(selectedT?.examples) ? selectedT.examples.join(', ') : '',
              difficulty: selectedT?.difficulty || 'Beginner',
            }));
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handlePatientChange = async (patientId) => {
    setConfig((prev) => ({ ...prev, patientId, targetId: '' }));
    try {
      const tList = await targetService.getTargetsByPatient(patientId);
      setPatientTargets(tList);
      if (tList.length > 0) {
        setConfig((prev) => ({
          ...prev,
          targetId: tList[0].id,
          exampleWords: Array.isArray(tList[0].examples) ? tList[0].examples.join(', ') : '',
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTargetChange = (targetId) => {
    const selected = patientTargets.find((t) => t.id === targetId);
    if (selected) {
      setConfig((prev) => ({
        ...prev,
        targetId,
        difficulty: selected.difficulty || prev.difficulty,
        exampleWords: Array.isArray(selected.examples) ? selected.examples.join(', ') : '',
      }));
    } else {
      setConfig((prev) => ({ ...prev, targetId }));
    }
  };

  const handleTriggerGenerate = async () => {
    const selectedTarget = patientTargets.find((t) => t.id === config.targetId);
    if (!selectedTarget) {
      alert('Please select or create a speech target first.');
      return;
    }

    setStep(2);
    setGenerating(true);

    try {
      const results = await exerciseService.generateMockExercises({
        target: selectedTarget,
        practiceLevel: config.practiceLevel,
        difficulty: config.difficulty,
        exerciseType: config.exerciseType,
        exampleWords: config.exampleWords,
      });

      setGeneratedExercises(results);
      setStep(3);
    } catch (err) {
      alert('Generation failed: ' + err.message);
      setStep(1);
    } finally {
      setGenerating(false);
    }
  };

  const handleCardContentChange = (id, field, value) => {
    setGeneratedExercises((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (field.startsWith('content.')) {
            const sub = field.split('.')[1];
            return { ...item, content: { ...item.content, [sub]: value } };
          }
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleApproveExercise = async (exercise) => {
    try {
      // Save exercise to storage as APPROVED
      await exerciseService.createExercise({
        patientId: config.patientId,
        targetId: config.targetId,
        title: exercise.title,
        instructions: exercise.instructions,
        type: exercise.type,
        difficulty: exercise.difficulty,
        level: exercise.level,
        content: exercise.content,
        status: 'APPROVED',
      });
      setApprovedIds((prev) => new Set([...prev, exercise.id]));
    } catch (err) {
      alert(err.message);
    }
  };

  const selectedTarget = patientTargets.find((t) => t.id === config.targetId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#EEF0FD] text-[#5865E8]">
              <Sparkles className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172033]">
              AI Exercise Generator
            </h1>
          </div>
          <p className="text-sm text-[#687386] mt-1">
            Generate, customize, and approve evidence-informed speech articulation exercises
          </p>
        </div>

        {/* Wizard Step Indicator */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-[#E5E9F2] shadow-2xs">
          {[
            { num: 1, label: 'Configure' },
            { num: 2, label: 'Generate' },
            { num: 3, label: 'Review & Approve' },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-1.5">
              <span
                className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                  step === s.num
                    ? 'bg-[#5865E8] text-white'
                    : step > s.num
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {step > s.num ? '✓' : s.num}
              </span>
              <span
                className={`text-xs font-medium hidden sm:inline ${
                  step === s.num ? 'text-[#172033] font-semibold' : 'text-slate-400'
                }`}
              >
                {s.label}
              </span>
              {s.num < 3 && <span className="text-slate-300 text-xs mx-1">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: CONFIGURE */}
      {step === 1 && (
        <Card className="p-6 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-[#E5E9F2]">
            <Sliders className="w-5 h-5 text-[#5865E8]" />
            <div>
              <h2 className="text-base font-semibold text-[#172033]">Step 1: Configure Exercise Parameters</h2>
              <p className="text-xs text-[#687386]">
                Select the target phoneme, syllable, word, or scenario and desired practice level
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Patient selection */}
            <Select
              label="Select Patient"
              required
              value={config.patientId}
              onChange={(e) => handlePatientChange(e.target.value)}
              options={patients.map((p) => ({ value: p.id, label: `${p.name} (${p.status})` }))}
            />

            {/* Target selection */}
            <div>
              <label className="block text-xs font-semibold text-[#172033] tracking-wide mb-1.5">
                Focus Speech Target <span className="text-[#DC5A65]">*</span>
              </label>
              {patientTargets.length > 0 ? (
                <select
                  value={config.targetId}
                  onChange={(e) => handleTargetChange(e.target.value)}
                  className="w-full rounded-lg border border-[#E5E9F2] bg-white px-3.5 py-2.5 text-sm text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#5865E8]"
                >
                  {patientTargets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.value} — [{t.type}] ({t.difficulty})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                  <span>No targets for this patient yet.</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/therapist/patients/${config.patientId}`)}
                  >
                    Add Target
                  </Button>
                </div>
              )}
            </div>

            {/* Target Details Preview */}
            {selectedTarget && (
              <div className="col-span-full bg-slate-50 border border-[#E5E9F2] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-[#172033]">{selectedTarget.value}</span>
                    <Badge variant="primary">{selectedTarget.type}</Badge>
                    <Badge variant="teal">{selectedTarget.difficulty}</Badge>
                  </div>
                  <p className="text-slate-600 mt-1">
                    {selectedTarget.soundDescription || selectedTarget.context || 'Articulation target'}
                  </p>
                </div>
                <div className="text-slate-500 font-mono text-[11px] shrink-0">
                  Target ID: {selectedTarget.id}
                </div>
              </div>
            )}

            {/* Practice Level */}
            <Select
              label="Practice Level"
              value={config.practiceLevel}
              onChange={(e) => setConfig({ ...config, practiceLevel: e.target.value })}
              options={PRACTICE_LEVELS}
              helperText="Determines linguistic complexity (isolation, word, phrase, sentence, conversation)"
            />

            {/* Difficulty */}
            <Select
              label="Difficulty Tier"
              value={config.difficulty}
              onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}
              options={DIFFICULTY_LEVELS}
            />

            {/* Exercise Type */}
            <Select
              label="Exercise Articulation Type"
              value={config.exerciseType}
              onChange={(e) => setConfig({ ...config, exerciseType: e.target.value })}
              options={EXERCISE_TYPES.map((t) => ({ value: t.id, label: `${t.name} — ${t.desc}` }))}
            />

            {/* Example Words */}
            <Input
              label="Seed Target Words / Vocabulary (Optional)"
              placeholder="e.g. ship, shoe, ocean, washing"
              value={config.exampleWords}
              onChange={(e) => setConfig({ ...config, exampleWords: e.target.value })}
              helperText="The generation engine will synthesize sentences and cues around these words"
            />
          </div>

          <div className="pt-4 border-t border-[#E5E9F2] flex justify-end">
            <Button
              variant="primary"
              size="lg"
              onClick={handleTriggerGenerate}
              rightIcon={Sparkles}
              disabled={!config.targetId}
            >
              Generate Structured Exercises
            </Button>
          </div>
        </Card>
      )}

      {/* STEP 2: GENERATION IN PROGRESS */}
      {step === 2 && (
        <Card className="p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 text-[#5865E8] flex items-center justify-center mx-auto animate-bounce">
            <Brain className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#172033]">
              Synthesizing Speech Practice Exercises...
            </h3>
            <p className="text-xs text-[#687386] max-w-md mx-auto mt-1">
              Constructing phonetic prompts, contrast cues, and supportive articulatory instructions for target{' '}
              <span className="font-semibold text-[#172033]">{selectedTarget?.value}</span>.
            </p>
          </div>
          <div className="w-48 h-1.5 bg-slate-100 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-[#5865E8] animate-pulse w-full rounded-full" />
          </div>
        </Card>
      )}

      {/* STEP 3: REVIEW AND APPROVE */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-[#E5E9F2] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#172033]">
                Step 3: Review, Edit & Approve Generated Exercises
              </h2>
              <p className="text-xs text-[#687386]">
                Therapist clinical supervision: Inspect prompts and edit wording before approving for patient practice.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(1)} leftIcon={ArrowLeft}>
                Re-Configure
              </Button>
              <Button variant="ghost" size="sm" onClick={handleTriggerGenerate} leftIcon={RotateCw}>
                Regenerate
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {generatedExercises.map((ex, idx) => {
              const isEditing = editingCardId === ex.id;
              const isApproved = approvedIds.has(ex.id);

              return (
                <Card
                  key={ex.id}
                  className={`p-6 space-y-4 transition-all ${
                    isApproved ? 'border-emerald-300 bg-emerald-50/20' : 'border-[#E5E9F2]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1">
                      {isEditing ? (
                        <div className="space-y-3">
                          <Input
                            label="Exercise Title"
                            value={ex.title}
                            onChange={(e) => handleCardContentChange(ex.id, 'title', e.target.value)}
                          />
                          <Textarea
                            label="Therapy Instructions"
                            value={ex.instructions}
                            onChange={(e) =>
                              handleCardContentChange(ex.id, 'instructions', e.target.value)
                            }
                          />
                        </div>
                      ) : (
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                            <h3 className="text-base font-bold text-[#172033]">{ex.title}</h3>
                            <Badge variant="primary">{ex.level}</Badge>
                            <Badge variant="teal">{ex.difficulty}</Badge>
                            {isApproved && (
                              <Badge variant="success" className="gap-1">
                                <Check className="w-3 h-3" /> Approved
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-[#687386] mt-2">{ex.instructions}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingCardId(isEditing ? null : ex.id)}
                        leftIcon={Edit3}
                      >
                        {isEditing ? 'Done' : 'Edit Content'}
                      </Button>
                    </div>
                  </div>

                  {/* Exercise Content Box */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Spoken Practice Prompt"
                          value={ex.content?.prompt || ''}
                          onChange={(e) =>
                            handleCardContentChange(ex.id, 'content.prompt', e.target.value)
                          }
                        />
                        <Input
                          label="Phonetic / IPA Transcription"
                          value={ex.content?.phonetic || ''}
                          onChange={(e) =>
                            handleCardContentChange(ex.id, 'content.phonetic', e.target.value)
                          }
                        />
                        <div className="sm:col-span-2">
                          <Input
                            label="Reference Model Sentence"
                            value={ex.content?.referenceSentence || ''}
                            onChange={(e) =>
                              handleCardContentChange(ex.id, 'content.referenceSentence', e.target.value)
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="text-slate-400 font-semibold block text-[11px]">
                              Patient Spoken Prompt:
                            </span>
                            <span className="text-xl font-bold text-[#172033] font-mono">
                              "{ex.content?.prompt}"
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-slate-400 font-semibold block text-[11px]">IPA:</span>
                            <span className="font-mono text-xs text-indigo-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {ex.content?.phonetic}
                            </span>
                          </div>
                        </div>

                        {ex.content?.referenceSentence && (
                          <div className="pt-2 border-t border-slate-200 text-slate-600">
                            <span className="font-semibold text-slate-700">Reference Context: </span>
                            {ex.content.referenceSentence}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-[#E5E9F2] flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">
                      Target: <span className="font-semibold text-slate-600">{selectedTarget?.value}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      <Button
                        variant={isApproved ? 'outline' : 'primary'}
                        size="sm"
                        disabled={isApproved}
                        onClick={() => handleApproveExercise(ex)}
                        leftIcon={CheckCircle}
                      >
                        {isApproved ? 'Approved for Patient' : 'Approve Exercise'}
                      </Button>

                      {isApproved && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            navigate(`/therapist/assignments?patientId=${config.patientId}`)
                          }
                          rightIcon={ClipboardList}
                        >
                          Assign Now
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

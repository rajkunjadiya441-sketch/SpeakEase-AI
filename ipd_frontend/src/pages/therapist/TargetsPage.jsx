import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Target,
  Plus,
  Search,
  Filter,
  Sparkles,
  Edit2,
  Trash2,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { targetService } from '../../services/targetService';
import { patientService } from '../../services/patientService';
import { TARGET_TYPES, TARGET_TYPE_DETAILS, DIFFICULTY_LEVELS } from '../../constants/targets';

export function TargetsPage() {
  const navigate = useNavigate();
  const [targets, setTargets] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [patientFilter, setPatientFilter] = useState('ALL');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [form, setForm] = useState({
    patientId: '',
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

  const loadData = async () => {
    try {
      setLoading(true);
      const [tList, pList] = await Promise.all([
        targetService.getAllTargets(),
        patientService.getPatients(),
      ]);
      setTargets(tList);
      setPatients(pList);
      if (pList.length > 0 && !form.patientId) {
        setForm((prev) => ({ ...prev, patientId: pList[0].id }));
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

  const openAddModal = () => {
    setEditingTarget(null);
    setForm({
      patientId: patients[0]?.id || '',
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
    setIsModalOpen(true);
  };

  const openEditModal = (target) => {
    setEditingTarget(target);
    setForm({
      patientId: target.patientId,
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
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.value.trim()) {
      alert('Target value is required');
      return;
    }
    try {
      if (editingTarget) {
        await targetService.updateTarget(editingTarget.id, form);
      } else {
        await targetService.createTarget(form);
      }
      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (targetId) => {
    if (window.confirm('Delete this target?')) {
      try {
        await targetService.deleteTarget(targetId);
        await loadData();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const filteredTargets = targets.filter((t) => {
    const matchesSearch =
      t.value.toLowerCase().includes(search.toLowerCase()) ||
      t.soundDescription?.toLowerCase().includes(search.toLowerCase()) ||
      t.context?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
    const matchesPatient = patientFilter === 'ALL' || t.patientId === patientFilter;
    return matchesSearch && matchesType && matchesPatient;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172033]">
            Target Management
          </h1>
          <p className="text-sm text-[#687386] mt-1">
            Configure phonemes, syllables, words, phrases, sentences, and conversational expressions
          </p>
        </div>
        <Button variant="primary" onClick={openAddModal} leftIcon={Plus}>
          Add Target
        </Button>
      </div>

      {/* Target Types Overview Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {Object.entries(TARGET_TYPES).map(([key, type]) => {
          const count = targets.filter((t) => t.type === type).length;
          const isSelected = typeFilter === type;
          return (
            <button
              key={key}
              onClick={() => setTypeFilter(isSelected ? 'ALL' : type)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-[#5865E8] bg-indigo-50/50 shadow-xs'
                  : 'border-[#E5E9F2] bg-white hover:bg-slate-50'
              }`}
            >
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                {type}
              </span>
              <span className="text-lg font-bold text-[#172033] mt-0.5 block">{count}</span>
              <span className="text-[10px] text-[#687386] truncate block">
                {TARGET_TYPE_DETAILS[type]?.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search targets or cues..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-[#E5E9F2] rounded-lg text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#5865E8]"
            />
          </div>

          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Target Types' },
              ...Object.values(TARGET_TYPES).map((t) => ({ value: t, label: t })),
            ]}
          />

          <Select
            value={patientFilter}
            onChange={(e) => setPatientFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Enrolled Patients' },
              ...patients.map((p) => ({ value: p.id, label: p.name })),
            ]}
          />
        </div>
      </Card>

      {/* Targets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTargets.length > 0 ? (
          filteredTargets.map((t) => {
            const patient = patients.find((p) => p.id === t.patientId);
            const details = TARGET_TYPE_DETAILS[t.type] || {};

            return (
              <Card key={t.id} className="p-5 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-[#172033]">{t.value}</span>
                        <Badge variant="primary">{t.type}</Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Patient: <span className="font-semibold text-slate-600">{patient?.name || 'Unassigned'}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(t)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                        title="Edit target"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Delete target"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {t.soundDescription && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg mt-3">
                      <span className="font-semibold text-slate-700">Articulation Guide: </span>
                      {t.soundDescription}
                    </div>
                  )}

                  {t.context && (
                    <div className="text-xs text-slate-600 bg-purple-50 p-2.5 rounded-lg mt-3">
                      <span className="font-semibold text-purple-800">Context: </span>
                      {t.context}
                    </div>
                  )}

                  {t.examples && t.examples.length > 0 && (
                    <p className="text-xs text-[#687386] mt-2">
                      <span className="font-semibold">Examples: </span>
                      {t.examples.join(', ')}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-[#E5E9F2] flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">Difficulty: {t.difficulty}</span>
                  <Button
                    variant="tealSubtle"
                    size="sm"
                    onClick={() =>
                      navigate(`/therapist/exercise-generator?patientId=${t.patientId}&targetId=${t.id}`)
                    }
                    rightIcon={Sparkles}
                  >
                    Generate Exercise
                  </Button>
                </div>
              </Card>
            );
          })
        ) : (
          <div className="col-span-full text-center py-12 text-[#687386] text-xs">
            No targets found matching your filters.
          </div>
        )}
      </div>

      {/* Target Modal with dynamic fields */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTarget ? `Edit Target: ${editingTarget.value}` : 'Add Speech Target'}
        description="Select target category to adapt articulatory parameters."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Select
            label="Assigned Patient"
            required
            value={form.patientId}
            onChange={(e) => setForm({ ...form, patientId: e.target.value })}
            options={patients.map((p) => ({ value: p.id, label: p.name }))}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Target Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={Object.values(TARGET_TYPES).map((t) => ({
                value: t,
                label: TARGET_TYPE_DETAILS[t]?.label || t,
              }))}
            />

            <Select
              label="Difficulty"
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
              options={DIFFICULTY_LEVELS}
            />
          </div>

          <Input
            label={
              form.type === TARGET_TYPES.SOUND
                ? 'Target Sound Phoneme'
                : form.type === TARGET_TYPES.SYLLABLE
                ? 'Target Syllable'
                : form.type === TARGET_TYPES.WORD
                ? 'Target Word'
                : form.type === TARGET_TYPES.PHRASE
                ? 'Target Phrase'
                : form.type === TARGET_TYPES.SENTENCE
                ? 'Target Sentence'
                : 'Everyday Scenario'
            }
            placeholder={TARGET_TYPE_DETAILS[form.type]?.examplePrompt || 'Target value...'}
            required
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
          />

          {(form.type === TARGET_TYPES.SOUND || form.type === TARGET_TYPES.SYLLABLE) && (
            <Textarea
              label="Articulatory Placement Guidance"
              placeholder="e.g. Voiceless fricative, lip rounding, steady airflow..."
              value={form.soundDescription}
              onChange={(e) => setForm({ ...form, soundDescription: e.target.value })}
            />
          )}

          {form.type === TARGET_TYPES.EVERYDAY_USE && (
            <Textarea
              label="Conversational Context"
              placeholder="e.g. Ordering tea at a counter..."
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
            />
          )}

          <Input
            label="Example Words or Phrases (comma separated)"
            placeholder="e.g. ship, shoe, ocean"
            value={form.examples}
            onChange={(e) => setForm({ ...form, examples: e.target.value })}
          />

          <Textarea
            label="Therapist Notes (Optional)"
            placeholder="Therapy notes and tips..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E9F2]">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingTarget ? 'Save Target' : 'Create Target'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

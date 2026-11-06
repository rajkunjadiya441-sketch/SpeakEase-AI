import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  Clock,
  Mic,
  Plus,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Target,
  FileCheck,
  TrendingUp,
} from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { AudioPlayer } from '../../components/ui/AudioPlayer';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { progressService } from '../../services/progressService';
import { patientService } from '../../services/patientService';
import { exerciseService } from '../../services/exerciseService';
import { formatTimeAgo, formatDate } from '../../utils/formatters';

export function TherapistDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Add Patient Modal state
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [patientForm, setPatientForm] = useState({ name: '', email: '', phone: '', notes: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await progressService.getTherapistDashboardData();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddPatient = async (e) => {
    e.preventDefault();
    if (!patientForm.name.trim() || !patientForm.email.trim()) {
      setErrorMsg('Please enter both name and email');
      return;
    }
    try {
      setFormLoading(true);
      setErrorMsg('');
      const newP = await patientService.createPatient(patientForm);
      setShowAddPatient(false);
      setPatientForm({ name: '', email: '', phone: '', notes: '' });
      await loadData();
      navigate(`/therapist/patients/${newP.id}`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create patient');
    } finally {
      setFormLoading(false);
    }
  };

  const handleQuickApprove = async (exerciseId) => {
    try {
      await exerciseService.approveExercise(exerciseId);
      await loadData();
    } catch (err) {
      console.error('Approve failed:', err);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-sm text-[#687386]">Loading clinical dashboard...</div>
      </div>
    );
  }

  const { metrics, patientsNeedingAttention, pendingApprovals, recentActivity, patientOverview } = data || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172033]">
            Welcome back, Dr. Hayes
          </h1>
          <p className="text-sm text-[#687386] mt-1">
            Clinical Speech Practice Overview & Patient Care Management
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => navigate('/therapist/exercise-generator')}
            leftIcon={Sparkles}
          >
            Generate Exercise
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowAddPatient(true)}
            leftIcon={Plus}
          >
            Add Patient
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex items-center gap-4 p-5">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5865E8] shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#687386] uppercase tracking-wider">Total Patients</p>
            <p className="text-2xl font-bold text-[#172033] mt-0.5">{metrics?.totalPatients || 0}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#2BAE9B] shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#687386] uppercase tracking-wider">Active Assignments</p>
            <p className="text-2xl font-bold text-[#172033] mt-0.5">{metrics?.activeAssignments || 0}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-[#E5A33D] shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#687386] uppercase tracking-wider">Awaiting Approval</p>
            <p className="text-2xl font-bold text-[#172033] mt-0.5">{metrics?.pendingApprovals || 0}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4 p-5">
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Mic className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#687386] uppercase tracking-wider">Practice Attempts</p>
            <p className="text-2xl font-bold text-[#172033] mt-0.5">{metrics?.totalAttempts || 0}</p>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Patients Needing Attention Alert */}
          {patientsNeedingAttention && patientsNeedingAttention.length > 0 && (
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-amber-900">Patients Needing Clinical Attention</h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  The following patients have missed scheduled practice or require target adjustment:
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {patientsNeedingAttention.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => navigate(`/therapist/patients/${p.id}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-amber-200 rounded-lg text-xs font-medium text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      <span>{p.name}</span>
                      <span className="text-[11px] text-amber-600">({formatTimeAgo(p.lastPracticeDate)})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Pending Exercise Approvals */}
          <Card>
            <CardHeader
              title="Exercises Awaiting Review & Approval"
              description="Review AI-generated practice content before making it available for assignment"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/therapist/exercise-generator')}
                  rightIcon={ArrowRight}
                >
                  Generator Wizard
                </Button>
              }
            />

            {pendingApprovals && pendingApprovals.length > 0 ? (
              <div className="space-y-3">
                {pendingApprovals.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 border border-[#E5E9F2] rounded-xl gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#172033] truncate">{ex.title}</span>
                        <Badge variant="primary">{ex.level}</Badge>
                      </div>
                      <p className="text-xs text-[#687386] mt-1 line-clamp-1">{ex.instructions}</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Patient: <span className="font-medium text-slate-600">{ex.patientName}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleQuickApprove(ex.id)}
                        leftIcon={FileCheck}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/therapist/patients/${ex.patientId}`)}
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-[#687386]">
                All generated exercises have been approved and assigned.
              </div>
            )}
          </Card>

          {/* Patient Practice Overview Table */}
          <Card>
            <CardHeader
              title="Patient Practice Overview"
              description="Current status and practice adherence across all enrolled individuals"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/therapist/patients')}
                  rightIcon={ArrowRight}
                >
                  View All
                </Button>
              }
            />

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E5E9F2] text-[#687386] uppercase font-semibold">
                    <th className="pb-3 pl-1">Patient Name</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Active Tasks</th>
                    <th className="pb-3">Total Attempts</th>
                    <th className="pb-3">Last Practice</th>
                    <th className="pb-3 text-right pr-1">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E9F2]">
                  {patientOverview?.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 pl-1 font-semibold text-[#172033]">{p.name}</td>
                      <td className="py-3.5">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="py-3.5 text-[#172033] font-medium">{p.activeAssignmentsCount}</td>
                      <td className="py-3.5 text-[#687386]">{p.totalAttempts}</td>
                      <td className="py-3.5 text-[#687386]">{formatTimeAgo(p.lastPracticeDate)}</td>
                      <td className="py-3.5 text-right pr-1">
                        <button
                          onClick={() => navigate(`/therapist/patients/${p.id}`)}
                          className="text-[#5865E8] hover:text-[#4752c4] font-semibold text-xs hover:underline cursor-pointer"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column (1 Col) */}
        <div className="space-y-6">
          {/* Quick Actions Card */}
          <Card>
            <h3 className="text-base font-semibold text-[#172033] mb-3">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-2.5">
              <Button
                variant="outline"
                className="justify-start text-xs py-3 w-full"
                leftIcon={Plus}
                onClick={() => setShowAddPatient(true)}
              >
                Add New Patient
              </Button>
              <Button
                variant="outline"
                className="justify-start text-xs py-3 w-full"
                leftIcon={Target}
                onClick={() => navigate('/therapist/targets')}
              >
                Create Target Sound/Word
              </Button>
              <Button
                variant="outline"
                className="justify-start text-xs py-3 w-full"
                leftIcon={Sparkles}
                onClick={() => navigate('/therapist/exercise-generator')}
              >
                AI Exercise Generator
              </Button>
              <Button
                variant="outline"
                className="justify-start text-xs py-3 w-full"
                leftIcon={TrendingUp}
                onClick={() => navigate('/therapist/progress')}
              >
                Review Progress Analytics
              </Button>
            </div>
          </Card>

          {/* Recent Patient Activity */}
          <Card>
            <CardHeader
              title="Recent Practice Attempts"
              description="Latest recorded audio submissions"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/therapist/attempts')}
                >
                  All
                </Button>
              }
            />

            <div className="space-y-4">
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.map((att) => (
                  <div key={att.id} className="p-3 bg-slate-50 border border-[#E5E9F2] rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#172033]">{att.patientName}</span>
                      <span className="text-slate-400 text-[11px]">{formatTimeAgo(att.createdAt)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="teal">{att.targetValue}</Badge>
                      <span className="text-xs text-[#687386] truncate">{att.exerciseTitle}</span>
                    </div>

                    {/* Audio playback */}
                    <AudioPlayer
                      src={att.audioBlobUrl} recordingId={att.audioId}
                      title={`Target: ${att.targetText}`}
                    />

                    {att.recognitionEvidence && (
                      <p className="text-[11px] text-slate-500 italic bg-white p-2 rounded border border-slate-100">
                        {att.recognitionEvidence}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-[#687386] text-center py-4">No recent practice attempts recorded.</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Add Patient Modal */}
      <Modal
        isOpen={showAddPatient}
        onClose={() => setShowAddPatient(false)}
        title="Add New Patient"
        description="Enroll a new patient into Adapt Synthetix to configure speech targets and practice sessions."
      >
        <form onSubmit={handleAddPatient} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#DC5A65] font-medium">
              {errorMsg}
            </div>
          )}

          <Input
            label="Full Name"
            placeholder="e.g. Jordan Smith"
            required
            value={patientForm.name}
            onChange={(e) => setPatientForm({ ...patientForm, name: e.target.value })}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="jordan.smith@example.com"
            required
            value={patientForm.email}
            onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })}
          />

          <Input
            label="Phone Number (Optional)"
            placeholder="(555) 000-0000"
            value={patientForm.phone}
            onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })}
          />

          <Textarea
            label="Clinical Evaluation Notes (Optional)"
            placeholder="Describe articulation concerns, focus phonemes, or prior therapy notes..."
            value={patientForm.notes}
            onChange={(e) => setPatientForm({ ...patientForm, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E9F2]">
            <Button variant="outline" onClick={() => setShowAddPatient(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={formLoading}>
              Enroll Patient
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

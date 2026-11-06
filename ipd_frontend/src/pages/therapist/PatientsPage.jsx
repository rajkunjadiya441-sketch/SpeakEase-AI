import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Edit2,
  ChevronRight,
  Target,
  ClipboardList,
  Mail,
  Phone,
  Calendar,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { StatusBadge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { patientService } from '../../services/patientService';
import { formatTimeAgo, formatDate } from '../../utils/formatters';

export function PatientsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', status: 'Active', notes: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const loadPatients = async () => {
    try {
      setLoading(true);
      const data = await patientService.getPatients();
      setPatients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => { setSearch(searchParams.get('search') || ''); }, [searchParams]);

  const openAddModal = () => {
    setEditingPatient(null);
    setForm({ name: '', email: '', phone: '', status: 'Active', notes: '' });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (patient, e) => {
    e.stopPropagation();
    setEditingPatient(patient);
    setForm({
      name: patient.name,
      email: patient.email,
      phone: patient.phone || '',
      status: patient.status || 'Active',
      notes: patient.notes || '',
    });
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSavePatient = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setErrorMsg('Name and email are required');
      return;
    }

    try {
      setFormLoading(true);
      setErrorMsg('');
      if (editingPatient) {
        await patientService.updatePatient(editingPatient.id, form);
      } else {
        await patientService.createPatient(form);
      }
      setIsModalOpen(false);
      await loadPatients();
    } catch (err) {
      setErrorMsg(err.message || 'Operation failed');
    } finally {
      setFormLoading(false);
    }
  };

  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || p.status.toUpperCase() === statusFilter.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172033]">
            Patient Management
          </h1>
          <p className="text-sm text-[#687386] mt-1">
            Manage enrolled individuals, assign articulation targets, and review practice plans
          </p>
        </div>
        <Button variant="primary" onClick={openAddModal} leftIcon={Plus}>
          Add Patient
        </Button>
      </div>

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="w-full md:flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients by name, email, or ID..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-[#E5E9F2] rounded-lg text-[#172033] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5865E8] focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <label className="text-xs font-semibold text-[#687386] whitespace-nowrap">Filter Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-44 py-2 px-3 text-xs bg-slate-50 border border-[#E5E9F2] rounded-lg text-[#172033] focus:outline-none focus:ring-2 focus:ring-[#5865E8]"
            >
              <option value="ALL">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Needs Attention">Needs Attention</option>
              <option value="New">New</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Patient List - Desktop Table */}
      <Card className="p-0 overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-[#E5E9F2] text-[#687386] uppercase font-semibold">
              <tr>
                <th className="py-3 px-6">Patient</th>
                <th className="py-3 px-4">Patient ID</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Assigned Targets</th>
                <th className="py-3 px-4 text-center">Active Tasks</th>
                <th className="py-3 px-4">Last Practice</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E9F2]">
              {filteredPatients.length > 0 ? (
                filteredPatients.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/therapist/patients/${p.id}`)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-[#5865E8] font-bold flex items-center justify-center text-xs">
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-[#172033] group-hover:text-[#5865E8] transition-colors">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-[#687386]">{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-mono text-[11px] text-slate-500">{p.id}</td>
                    <td className="py-4 px-4">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="py-4 px-4 text-center font-medium text-[#172033]">
                      {p.assignedTargetsCount || 0}
                    </td>
                    <td className="py-4 px-4 text-center font-medium text-[#172033]">
                      {p.activeExercisesCount || 0}
                    </td>
                    <td className="py-4 px-4 text-[#687386]">
                      {formatTimeAgo(p.lastPracticeDate)}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => openEditModal(p, e)}
                          title="Edit Patient"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/therapist/patients/${p.id}`)}
                          rightIcon={ChevronRight}
                        >
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#687386]">
                    No patients found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile Patient Cards */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {filteredPatients.length > 0 ? (
          filteredPatients.map((p) => (
            <Card
              key={p.id}
              hover
              onClick={() => navigate(`/therapist/patients/${p.id}`)}
              className="p-4 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-[#172033]">{p.name}</h3>
                  <p className="text-xs text-[#687386]">{p.email}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-[#E5E9F2]">
                <div>
                  <span className="text-[#687386]">Targets: </span>
                  <span className="font-semibold text-[#172033]">{p.assignedTargetsCount || 0}</span>
                </div>
                <div>
                  <span className="text-[#687386]">Active Tasks: </span>
                  <span className="font-semibold text-[#172033]">{p.activeExercisesCount || 0}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[#687386]">Last Practice: </span>
                  <span className="font-medium text-[#172033]">{formatTimeAgo(p.lastPracticeDate)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={(e) => openEditModal(p, e)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" /> Edit Info
                </button>
                <span className="text-xs font-semibold text-[#5865E8] flex items-center gap-1">
                  View Profile <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-10 text-xs text-[#687386]">
            No patients match your filter.
          </div>
        )}
      </div>

      {/* Add / Edit Patient Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPatient ? `Edit Patient: ${editingPatient.name}` : 'Enroll New Patient'}
        description={
          editingPatient
            ? 'Update contact information, status, and therapist clinical notes.'
            : 'Fill in patient credentials to setup their speech therapy practice plan.'
        }
      >
        <form onSubmit={handleSavePatient} className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#DC5A65] font-medium">
              {errorMsg}
            </div>
          )}

          <Input
            label="Patient Name"
            placeholder="e.g. Jordan Smith"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <Input
            label="Email Address"
            type="email"
            placeholder="jordan.smith@example.com"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Phone Number"
              placeholder="(555) 000-0000"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />

            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              options={['Active', 'Needs Attention', 'New', 'Inactive']}
            />
          </div>

          <Textarea
            label="Therapist Notes / Clinical Goals"
            placeholder="Notes on speech production, focus targets, articulation observations..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E5E9F2]">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={formLoading}>
              {editingPatient ? 'Save Changes' : 'Enroll Patient'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

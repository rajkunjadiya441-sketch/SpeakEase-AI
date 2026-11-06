import React, { useState } from 'react';
import {
  Settings,
  User,
  Shield,
  RotateCcw,
  CheckCircle,
  Database,
  Sliders,
  Volume2,
} from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { recordingStore } from '../../services/recordingStore';
import { storage } from '../../mocks/storage';

export function SettingsPage() {
  const [therapistName, setTherapistName] = useState(() => storage.getSettings().therapistName);
  const [clinicName, setClinicName] = useState(() => storage.getSettings().clinicName);
  const [defaultRepetitions, setDefaultRepetitions] = useState(() => storage.getSettings().defaultRepetitions);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    setError('');
    if (!therapistName.trim() || !clinicName.trim() || !Number.isInteger(Number(defaultRepetitions)) || Number(defaultRepetitions) < 1 || Number(defaultRepetitions) > 50) { setError('Enter therapist/clinic names and 1-50 repetitions.'); return; }
    try { storage.setSettings({ therapistName: therapistName.trim(), clinicName: clinicName.trim(), defaultRepetitions }); } catch (e) { setError(e.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleResetData = async () => {
    if (window.confirm('Reset all mock patients, targets, exercises, and attempts to default demonstration data?')) {
      try { await recordingStore.clear(); storage.resetDefaults(); window.location.reload(); }
      catch (error) { setError('Could not reset local recording storage. ' + error.message); }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-slate-100 text-[#172033]">
            <Settings className="w-5 h-5" />
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172033]">
            Clinical Settings
          </h1>
        </div>
        <p className="text-sm text-[#687386] mt-1">
          Manage therapist credentials, practice assignment defaults, and local data state
        </p>
      </div>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {saved && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-900 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span className="font-semibold">Therapist settings successfully updated.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Card */}
        <Card className="p-6 space-y-4">
          <CardHeader
            title="Therapist Profile & Practice"
            description="Your professional identity as displayed on patient assignments and review logs"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Therapist Name & Credentials"
              value={therapistName}
              onChange={(e) => setTherapistName(e.target.value)}
              required
            />

            <Input
              label="Clinic / Practice Facility"
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              required
            />
          </div>
        </Card>

        {/* Assignment Defaults */}
        <Card className="p-6 space-y-4">
          <CardHeader
            title="Clinical Practice Defaults"
            description="Default repetitions and review parameters when configuring assignments"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Default Practice Repetitions"
              value={defaultRepetitions}
              onChange={(e) => setDefaultRepetitions(e.target.value)}
              options={[
                { value: '3', label: '3 repetitions' },
                { value: '5', label: '5 repetitions (Recommended)' },
                { value: '8', label: '8 repetitions' },
                { value: '10', label: '10 repetitions' },
              ]}
            />

            <Select
              label="Recording Format"
              value="browser"
              disabled
              helperText="The browser chooses a supported WAV/WebM format. This is not a quality setting."
              options={[{ value: 'browser', label: 'Browser-selected WAV/WebM' }]}
            />
          </div>

          <div className="pt-2 flex justify-end">
            <Button type="submit" variant="primary">
              Save Settings
            </Button>
          </div>
        </Card>

        {/* Mock Data Management */}
        <Card className="p-6 space-y-4 border-red-100 bg-red-50/20">
          <div className="flex items-center gap-2 text-red-900 font-semibold text-sm">
            <Database className="w-4 h-4 text-red-600" />
            <span>Prototype Demonstration Storage</span>
          </div>
          <p className="text-xs text-slate-600">
            During Phase 1, Adapt Synthetix persists all additions (new patients, targets, exercises, and recorded audio attempts) in browser local storage. You can restore the initial demo dataset at any time.
          </p>

          <Button variant="outline" onClick={handleResetData} leftIcon={RotateCcw}>
            Restore Demo Dataset
          </Button>
        </Card>
      </form>
    </div>
  );
}

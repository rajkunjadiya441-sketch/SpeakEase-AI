import { useActivePatient } from '../../hooks/useActivePatient';
import React, { useState, useEffect, useRef } from 'react';
import { User, Bell, Mic, Stethoscope, CheckCircle, Volume2, Shield } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { storage } from '../../mocks/storage';
import { patientService } from '../../services/patientService';

export function PatientProfileSettingsPage() {
  const [patient, setPatient] = useState(null);
  const [allPatients, setAllPatients] = useState([]);
  const [saved, setSaved] = useState(false);
  const [micTesting, setMicTesting] = useState(false);
  const [micSuccess, setMicSuccess] = useState(false);
  const [micError, setMicError] = useState('');
  const microphone = useRef(null);
  useEffect(() => () => { clearTimeout(microphone.current?.timer); microphone.current?.stream?.getTracks().forEach(t => t.stop()); microphone.current = null; }, []);

  const activePatientId = useActivePatient();

  useEffect(() => {
    const load = async () => {
      const pList = await patientService.getPatients();
      setAllPatients(pList);
      const active = pList.find((p) => p.id === activePatientId) || pList[0];
      setPatient(active);
    };
    load();
  }, [activePatientId]);

  const switchActivePatient = (pid) => {
    storage.setActivePatientId(pid);
    window.location.reload();
  };

  const handleTestMic = async () => {
    setMicError('');
    setMicTesting(true);
    const request = {}; microphone.current = request;
    setMicSuccess(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (microphone.current !== request) { stream.getTracks().forEach(t => t.stop()); return; }
      request.stream = stream;
      request.timer = setTimeout(() => {
        stream.getTracks().forEach((track) => track.stop());
        setMicTesting(false);
        setMicSuccess(true);
      }, 1500);
    } catch (err) {
      setMicTesting(false);
      if (microphone.current === request) setMicError('Microphone check failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#172033]">My Profile & Settings</h1>
        <p className="text-sm text-[#687386] mt-1">
          Review your account details, test your microphone, and view your care team
        </p>
      </div>

      {micError && <p role="alert" className="text-sm text-amber-800">{micError}</p>}
      {/* Patient Profile Card */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-100 text-[#2BAE9B] text-2xl font-bold flex items-center justify-center">
            {patient?.name?.charAt(0) || 'P'}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#172033]">{patient?.name}</h2>
            <p className="text-xs text-[#687386]">{patient?.email}</p>
            <span className="text-[11px] font-mono text-slate-400">ID: {patient?.id}</span>
          </div>
        </div>

        <div className="pt-3 border-t border-[#E5E9F2]">
          <label className="text-xs font-semibold text-[#172033] block mb-2">
            Switch Demo Patient Account:
          </label>
          <div className="flex flex-wrap gap-2">
            {allPatients.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => switchActivePatient(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  p.id === activePatientId
                    ? 'border-[#2BAE9B] bg-teal-50 text-[#2BAE9B] font-semibold'
                    : 'border-[#E5E9F2] bg-white text-[#687386] hover:bg-slate-50'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Hardware & Microphone Check */}
      <Card className="p-6 space-y-4">
        <CardHeader
          title="Microphone Hardware Check"
          description="Ensure your browser and microphone are ready for speech practice recording"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 border border-[#E5E9F2] rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white shadow-2xs flex items-center justify-center text-[#2BAE9B]">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-xs text-[#172033] block">Default System Microphone</span>
              <span className="text-[11px] text-[#687386]">HTML5 MediaRecorder API Ready</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleTestMic}
            isLoading={micTesting}
          >
            {micSuccess ? 'Mic Verified ✓' : 'Test Microphone'}
          </Button>
        </div>

        {micSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Microphone verified! Your audio permissions are working properly.</span>
          </div>
        )}
      </Card>

      {/* Therapist Care Team Card */}
      <Card className="p-6 space-y-3">
        <CardHeader
          title="Assigned Speech-Language Pathologist"
          description="Your supervising therapist who prepares your exercises and evaluates recordings"
        />

        <div className="flex items-center gap-3.5 p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
          <div className="w-12 h-12 rounded-xl bg-white shadow-2xs flex items-center justify-center text-[#5865E8]">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#172033]">Dr. Rachel Hayes, CCC-SLP</h3>
            <p className="text-xs text-[#687386]">Metropolitan Speech & Language Clinic</p>
            <span className="text-[11px] text-[#5865E8] font-medium">Licensed Clinical SLP</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

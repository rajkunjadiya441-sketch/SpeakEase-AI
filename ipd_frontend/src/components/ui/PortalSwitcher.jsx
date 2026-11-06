import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Stethoscope, User, ArrowLeftRight, Check } from 'lucide-react';
import { storage } from '../../mocks/storage';

export function PortalSwitcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const [patients, setPatients] = useState([]);
  const [activePatientId, setActivePatientId] = useState(storage.getActivePatientId());
  const [showPatientSelect, setShowPatientSelect] = useState(false);

  const isTherapistPortal = location.pathname.startsWith('/therapist');

  useEffect(() => {
    setPatients(storage.getPatients());
    setActivePatientId(storage.getActivePatientId());
  }, [location.pathname]);

  const activePatient = patients.find((p) => p.id === activePatientId) || patients[0];

  const handleSwitchToPatient = () => {
    navigate('/patient/home');
  };

  const handleSwitchToTherapist = () => {
    navigate('/therapist/dashboard');
  };

  const selectPatient = (patientId) => {
    storage.setActivePatientId(patientId);
    setActivePatientId(patientId);
    setShowPatientSelect(false);
    // Reload or notify if on patient portal
    if (!isTherapistPortal) {
      navigate('/patient/home');
    }
  };

  return (
    <div className="flex items-center gap-2 bg-white/95 backdrop-blur-xs border border-[#E5E9F2] shadow-xs rounded-full px-2 py-1">
      {isTherapistPortal ? (
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline text-xs font-medium text-[#687386]">Viewing as:</span>
          <span className="text-xs font-semibold text-[#5865E8] flex items-center gap-1">
            <Stethoscope className="w-3.5 h-3.5" /> Therapist
          </span>
          <button
            onClick={handleSwitchToPatient}
            className="flex items-center gap-1 text-xs bg-[#E7F7F5] text-[#2BAE9B] hover:bg-[#d5f1ed] px-2.5 py-1 rounded-full font-medium transition-colors ml-1 cursor-pointer"
            title="Switch to Patient View"
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span>Switch to Patient</span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowPatientSelect(!showPatientSelect)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#172033] hover:text-[#5865E8] bg-slate-50 border border-slate-200 px-2 py-1 rounded-full transition-colors cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-[#2BAE9B]" />
              <span className="font-semibold">{activePatient?.name || 'Patient'}</span>
              <span className="text-[10px] text-slate-400">▼</span>
            </button>

            {showPatientSelect && (
              <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-[#E5E9F2] p-1.5 z-50">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
                  Practising as:
                </div>
                {patients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPatient(p.id)}
                    className="w-full flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span className="font-medium text-[#172033]">{p.name}</span>
                    {p.id === activePatientId && <Check className="w-3.5 h-3.5 text-[#2BAE9B]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSwitchToTherapist}
            className="flex items-center gap-1 text-xs bg-[#EEF0FD] text-[#5865E8] hover:bg-[#e0e4fa] px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer"
            title="Switch to Therapist Dashboard"
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span className="hidden sm:inline">Therapist Portal</span>
            <span className="sm:hidden">Therapist</span>
          </button>
        </div>
      )}
    </div>
  );
}

import { useActivePatient } from '../../hooks/useActivePatient';
import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Home, Mic, TrendingUp, User, Volume2, History } from 'lucide-react';
import { PortalSwitcher } from '../ui/PortalSwitcher';

const PATIENT_NAV = [
  { name: 'History', path: '/patient/history', icon: History },
  { name: 'Home', path: '/patient/home', icon: Home },
  { name: 'My Practice', path: '/patient/practice', icon: Mic },
  { name: 'History', path: '/patient/history', icon: History },
  { name: 'My Progress', path: '/patient/progress', icon: TrendingUp },
  { name: 'Profile', path: '/patient/profile', icon: User },
];

export function PatientLayout() {
  const patientId = useActivePatient();
  return (
    <div className="min-h-screen bg-[#F7F8FC] flex flex-col text-[#172033]">
      {/* Patient Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-[#E5E9F2] px-4 sm:px-8 py-3.5 flex flex-wrap gap-3 items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#2BAE9B] flex items-center justify-center text-white shadow-xs">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-base text-[#172033] tracking-tight block">Adapt Synthetix</span>
            <span className="text-[10px] font-semibold text-[#2BAE9B] uppercase tracking-wider block">Speech Practice</span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-[#F7F8FC] p-1 rounded-xl border border-[#E5E9F2]">
          {PATIENT_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-2 lg:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white text-[#2BAE9B] shadow-xs'
                      : 'text-[#687386] hover:text-[#172033]'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Switcher */}
        <div className="flex items-center gap-2">
          <PortalSwitcher />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">Demo workspace: patient data and history stay local. Submitted recordings use the real speech backend.</div>
        <Outlet key={patientId} />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E9F2] z-40 px-3 py-2 flex items-center justify-around shadow-lg">
        {PATIENT_NAV.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-1 px-2 rounded-xl transition-colors ${
                  isActive
                    ? 'text-[#2BAE9B] font-semibold'
                    : 'text-[#687386] hover:text-[#172033]'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px]">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

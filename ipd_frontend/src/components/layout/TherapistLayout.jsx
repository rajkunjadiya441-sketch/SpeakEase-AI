import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Target,
  Sparkles,
  ClipboardList,
  Headphones,
  TrendingUp,
  Settings,
  Menu,
  X,
  Bell,
  Search,
  RotateCcw,
  Volume2,
} from 'lucide-react';
import { PortalSwitcher } from '../ui/PortalSwitcher';
import { storage } from '../../mocks/storage';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/therapist/dashboard', icon: LayoutDashboard },
  { name: 'Patients', path: '/therapist/patients', icon: Users },
  { name: 'Targets', path: '/therapist/targets', icon: Target },
  { name: 'Exercise Generator', path: '/therapist/exercise-generator', icon: Sparkles },
  { name: 'Assign Practice', path: '/therapist/assignments', icon: ClipboardList },
  { name: 'Attempt Review', path: '/therapist/attempts', icon: Headphones },
  { name: 'Progress Analytics', path: '/therapist/progress', icon: TrendingUp },
  { name: 'Settings', path: '/therapist/settings', icon: Settings },
];

export function TherapistLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const [profile, setProfile] = useState(() => storage.getSettings());
  useEffect(() => { const update = () => setProfile(storage.getSettings()); window.addEventListener('adaptsynthetix:change', update); return () => window.removeEventListener('adaptsynthetix:change', update); }, []);

  const handleGlobalSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/therapist/patients?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleResetData = () => {
    if (window.confirm('Reset all mock data (patients, targets, assignments, attempts) to default demo state?')) {
      storage.resetDefaults();
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FC] flex text-[#172033]">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-[#E5E9F2] flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#E5E9F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#5865E8] flex items-center justify-center text-white shadow-xs">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base text-[#172033] tracking-tight block">Adapt Synthetix</span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-[#5865E8] block">Therapist Portal</span>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 py-4 px-3 overflow-y-auto space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Clinical Workspace
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#EEF0FD] text-[#5865E8]'
                      : 'text-[#687386] hover:text-[#172033] hover:bg-slate-50'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Therapist User Profile & Reset Footer */}
        <div className="p-4 border-t border-[#E5E9F2] space-y-3">
          <button
            onClick={handleResetData}
            className="w-full flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 py-1.5 px-2 rounded-lg transition-colors cursor-pointer"
            title="Reset mock data to fresh defaults"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>

          <div className="flex items-center gap-3 pt-1">
            <div className="w-9 h-9 rounded-full bg-indigo-100 border border-indigo-200 text-[#5865E8] font-semibold flex items-center justify-center text-xs">
              DR
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#172033] truncate">{profile.therapistName}</p>
              <p className="text-[11px] text-[#687386] truncate">Speech-Language Pathologist</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-xs border-b border-[#E5E9F2] flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 flex-1 max-w-lg">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick search */}
            <form onSubmit={handleGlobalSearch} className="w-full hidden sm:block relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patients..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-[#E5E9F2] rounded-lg text-[#172033] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5865E8] focus:bg-white transition-all"
              />
            </form>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-3">
            <PortalSwitcher />

            <button
              type="button"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 relative transition-colors"
              aria-label="Open pending attempt reviews"
              onClick={() => navigate('/therapist/attempts?status=PENDING')}
            >
              <Bell className="w-4 h-4" />
              {storage.getAttempts().some(a => a.reviewStatus === 'PENDING' || (!a.reviewStatus && !a.notes)) && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#DC5A65] rounded-full" />}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">Demo workspace: patient data, generation and history are local. Speech analysis uses the real backend.</div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

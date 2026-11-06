import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Calendar,
  CheckCircle2,
  Users,
  Target,
  Mic,
  ArrowRight,
  Activity,
  Layers,
} from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { progressService } from '../../services/progressService';
import { patientService } from '../../services/patientService';
import { targetService } from '../../services/targetService';
import { attemptService } from '../../services/attemptService';
import { formatTimeAgo, formatDate } from '../../utils/formatters';

export function ProgressDashboardPage() {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [patients, setPatients] = useState([]);
  const [targets, setTargets] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [dash, pList, tList, attList] = await Promise.all([
          progressService.getTherapistDashboardData(),
          patientService.getPatients(),
          targetService.getAllTargets(),
          attemptService.getAllAttempts(),
        ]);
        setDashboardData(dash);
        setPatients(pList);
        setTargets(tList);
        setAttempts(attList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-xs text-[#687386]">
        Loading clinical progress analytics...
      </div>
    );
  }

  // Calculate target-wise attempt distribution
  const targetDistribution = targets.map((t) => {
    const count = attempts.filter((a) => a.targetId === t.id).length;
    return {
      target: t,
      count,
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-teal-50 text-[#2BAE9B]">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#172033]">
              Clinical Progress & Adherence
            </h1>
          </div>
          <p className="text-sm text-[#687386] mt-1">
            Empirical practice cadence, target repetition volume, and longitudinal patient engagement
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <span className="text-xs font-semibold text-[#687386] uppercase tracking-wider">Total Attempts</span>
          <p className="text-2xl font-bold text-[#172033] mt-1">{attempts.length}</p>
          <span className="text-[11px] text-emerald-600 font-medium">Logged speech recordings</span>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-semibold text-[#687386] uppercase tracking-wider">Active Targets</span>
          <p className="text-2xl font-bold text-[#172033] mt-1">{targets.length}</p>
          <span className="text-[11px] text-[#5865E8] font-medium">Across all enrolled patients</span>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-semibold text-[#687386] uppercase tracking-wider">Practice Adherence</span>
          <p className="text-2xl font-bold text-[#172033] mt-1">
            {Math.round(
              (dashboardData?.metrics.activeAssignments /
                (dashboardData?.metrics.activeAssignments + dashboardData?.metrics.pendingApprovals || 1)) *
                100
            )}
            %
          </p>
          <span className="text-[11px] text-teal-600 font-medium">Assignments active</span>
        </Card>

        <Card className="p-5">
          <span className="text-xs font-semibold text-[#687386] uppercase tracking-wider">Enrolled Individuals</span>
          <p className="text-2xl font-bold text-[#172033] mt-1">{patients.length}</p>
          <span className="text-[11px] text-slate-500 font-medium">Active therapy caseload</span>
        </Card>
      </div>

      {/* Visual Activity & Target Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Practice Volume Distribution */}
        <Card className="p-6">
          <CardHeader
            title="Target Practice Volume Distribution"
            description="Number of recorded audio repetitions per configured speech target"
          />

          <div className="space-y-4 pt-2">
            {targetDistribution.map((item) => {
              const maxCount = Math.max(...targetDistribution.map((d) => d.count), 5);
              const percent = Math.round((item.count / maxCount) * 100);

              return (
                <div key={item.target.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#172033] flex items-center gap-1.5">
                      <span className="font-mono text-sm">{item.target.value}</span>
                      <Badge variant="primary">{item.target.type}</Badge>
                    </span>
                    <span className="font-mono text-slate-600 font-bold">{item.count} attempts</span>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-[#2BAE9B] h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(percent, 8)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Patient Adherence Table */}
        <Card className="p-6">
          <CardHeader
            title="Patient Practice Adherence"
            description="Recent practice cadence and repetition volume by patient"
          />

          <div className="space-y-3">
            {patients.map((p) => {
              const pAttempts = attempts.filter((a) => a.patientId === p.id);

              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/therapist/patients/${p.id}`)}
                  className="p-3.5 bg-slate-50 border border-[#E5E9F2] rounded-xl flex items-center justify-between hover:bg-slate-100/70 transition-colors cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#172033]">{p.name}</span>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-xs text-[#687386] mt-0.5">
                      Last active: {formatTimeAgo(p.lastPracticeDate)}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-bold text-[#5865E8] block">{pAttempts.length}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Attempts</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Clinical Disclaimer Notice */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#687386] flex items-start gap-2.5">
        <Activity className="w-4 h-4 text-[#5865E8] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#172033]">Evidence-Based Clinical Protocol: </span>
          Adapt Synthetix displays factual practice repetition metrics and acoustic evidence waveforms. In accordance with clinical best practices, automated pronunciation correctness percentages are withheld until validated by calibrated speech-language pathologist review.
        </div>
      </div>
    </div>
  );
}

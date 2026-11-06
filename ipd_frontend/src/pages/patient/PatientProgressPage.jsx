import { Link } from 'react-router-dom';
import { useActivePatient } from '../../hooks/useActivePatient';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, CheckCircle, Mic, Target, Flame, ArrowRight } from 'lucide-react';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { AudioPlayer } from '../../components/ui/AudioPlayer';
import { progressService } from '../../services/progressService';
import { storage } from '../../mocks/storage';
import { formatDate, formatTimeAgo } from '../../utils/formatters';

export function PatientProgressPage() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);

  const activePatientId = useActivePatient();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await progressService.getPatientProgress(activePatientId);
        setProgress(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activePatientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-xs text-[#687386]">
        Loading your progress...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#172033]">My Practice Progress</h1>
        <p className="text-sm text-[#687386] mt-1">
          Celebrate your practice milestones and review your dedication over time
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-gradient-to-br from-teal-500/10 to-transparent border-teal-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-teal-800 uppercase tracking-wider">
              Exercises Completed
            </span>
            <CheckCircle className="w-5 h-5 text-[#2BAE9B]" />
          </div>
          <p className="text-3xl font-extrabold text-[#172033] mt-2">
            {progress?.completedAssignmentsCount || 0}
          </p>
          <span className="text-xs text-[#687386]">Practice tasks finished.</span>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">
              Speech Recordings
            </span>
            <Mic className="w-5 h-5 text-[#5865E8]" />
          </div>
          <p className="text-3xl font-extrabold text-[#172033] mt-2">
            {progress?.totalAttempts || 0}
          </p>
          <span className="text-xs text-[#687386]">Total attempts saved</span>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-purple-500/10 to-transparent border-purple-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-800 uppercase tracking-wider">
              Targets Practised
            </span>
            <Target className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-extrabold text-[#172033] mt-2">
            {progress?.targetsPracticedCount || 0}
          </p>
          <span className="text-xs text-[#687386]">Unique speech targets</span>
        </Card>
      </div>

      {/* Target Practice Breakdown */}
      <Card className="p-6">
        <CardHeader
          title="Targets You've Practised"
          description="Number of recordings you've made for each speech sound or expression"
        />

        <div className="space-y-4">
          {progress?.targetBreakdown && progress.targetBreakdown.some(item => item.attemptCount > 0) ? (
            progress.targetBreakdown.filter(item => item.attemptCount > 0).map((item) => (
              <div key={item.target.id} className="p-4 border border-[#E5E9F2] rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-[#172033]">{item.target.value}</span>
                    <Badge variant="teal">{item.target.type}</Badge>
                  </div>
                  <span className="text-xs font-semibold text-[#2BAE9B]">
                    {item.attemptCount} recorded practice{item.attemptCount === 1 ? '' : 's'}
                  </span>
                </div>

                {item.latestAttempt && (
                  <p className="text-xs text-[#687386]">
                    Last practised: {formatDate(item.latestAttempt.createdAt)}
                  </p>
                )}
              </div>
            ))
          ) : (
            <p className="text-xs text-[#687386] text-center py-4">No targets practised yet.</p>
          )}
        </div>
      </Card>

      <Card className="space-y-3"><CardHeader title="Recent Attempts" description="Practice history and therapist review status" />{progress?.recentAttempts?.length ? progress.recentAttempts.map(attempt => <div key={attempt.id} className="flex flex-wrap justify-between gap-2 text-sm border-b border-[#E5E9F2] pb-3"><Link className="text-[#5865E8] font-semibold" to={'/patient/history/' + attempt.id}>{attempt.exercise?.title || attempt.targetText}</Link><Badge variant={attempt.reviewStatus === 'REVIEWED' || (!attempt.reviewStatus && attempt.notes) ? 'success' : 'warning'}>{attempt.reviewStatus === 'REVIEWED' || (!attempt.reviewStatus && attempt.notes) ? 'Reviewed' : 'Pending review'}</Badge></div>) : <p className="text-sm text-[#687386]">No recent attempts.</p>}<Link to="/patient/history" className="text-sm text-[#5865E8]">View Practice History</Link></Card>
      {/* Encouraging Callout */}
      <div className="p-6 bg-teal-50 border border-teal-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-base text-[#172033]">Keep Up the Momentum!</h3>
          <p className="text-xs text-teal-900 mt-1 max-w-lg">
            Follow your therapist?s instructions and choose a comfortable pace for your practice.
          </p>
        </div>
        <Button variant="secondary" size="md" onClick={() => navigate('/patient/practice')}>
          Practise Today
        </Button>
      </div>
    </div>
  );
}

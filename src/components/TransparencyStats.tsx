import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Award,
  CheckCircle2,
  Clock,
  TrendingUp,
  ShieldCheck,
  Building2,
  Users,
} from 'lucide-react';
import { TransparencyStats as StatsType } from '../types';

export const TransparencyStatsView: React.FC = () => {
  const [stats, setStats] = useState<StatsType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load stats:', err);
        setLoading(false);
      });
  }, []);

  if (loading || !stats) {
    return (
      <div className="py-16 text-center text-xs text-slate-500">
        <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Loading Municipal Transparency Metrics...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Overview Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-900 to-teal-800 text-white rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-teal-300" />
          <h2 className="text-sm sm:text-base font-bold">Public Municipal Transparency & SLA Audit</h2>
        </div>
        <p className="text-xs text-teal-100 max-w-xl leading-relaxed">
          Open citizen ledger ensuring public accountability, verifiable defect triage, and automated SLA compliance across all municipal wards.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-teal-700/60">
          <div>
            <div className="text-[11px] text-teal-200">Total Registered</div>
            <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
          </div>
          <div>
            <div className="text-[11px] text-teal-200">Publicly Resolved</div>
            <div className="text-xl sm:text-2xl font-bold">{stats.resolved}</div>
          </div>
          <div>
            <div className="text-[11px] text-teal-200">Resolution Rate</div>
            <div className="text-xl sm:text-2xl font-bold">{stats.resolutionRate}%</div>
          </div>
          <div>
            <div className="text-[11px] text-teal-200">Avg Turnaround</div>
            <div className="text-xl sm:text-2xl font-bold">{stats.avgResolutionHours} hrs</div>
          </div>
        </div>
      </div>

      {/* Grid: Category Breakdown & Ward Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Category Breakdown */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-teal-600" />
            Issues by Category
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.categoryCounts).map(([cat, count]) => {
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700 capitalize">
                      {cat.replace('_', ' ')}
                    </span>
                    <span className="text-slate-500 font-medium">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-600 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Citizen Karma Leaderboard */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            Top Citizen Contributors (Karma Leaderboard)
          </h3>
          <p className="text-[11px] text-slate-500 mb-3">
            Reputation points rewarded for verified reports, accurate tags, and community validation.
          </p>

          <div className="space-y-2.5">
            {stats.topReporters.map((reporter, index) => (
              <div
                key={reporter.name}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      index === 0
                        ? 'bg-amber-400 text-amber-950'
                        : index === 1
                        ? 'bg-slate-300 text-slate-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <div className="font-bold text-slate-800">{reporter.name}</div>
                    <div className="text-[10px] text-teal-700 font-semibold">{reporter.badge}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-amber-600">★ {reporter.karma} Karma</div>
                  <div className="text-[10px] text-slate-400">{reporter.verifiedReports} verified tickets</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

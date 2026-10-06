import React, { useState } from 'react';
import {
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Building2,
  TrendingUp,
  Search,
  CheckSquare,
  Square,
  ArrowUpDown,
} from 'lucide-react';
import { Issue, IssueStatus, IssueCategory } from '../types';
import { Language, translations } from '../utils/translations';

interface OfficerDashboardProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
  onRefresh: () => void;
  lang: Language;
}

export const OfficerDashboard: React.FC<OfficerDashboardProps> = ({
  issues,
  onSelectIssue,
  onRefresh,
  lang,
}) => {
  const t = translations[lang];

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSlaBreachOnly, setFilterSlaBreachOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionDept, setBulkActionDept] = useState('Roads & Bridges Department');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const now = Date.now();

  // Filter issues
  const filtered = issues.filter((issue) => {
    if (filterStatus !== 'all' && issue.status !== filterStatus) return false;
    if (filterCategory !== 'all' && issue.category !== filterCategory) return false;
    if (filterSlaBreachOnly) {
      const isBreached = issue.status !== 'resolved' && new Date(issue.slaDeadline).getTime() < now;
      if (!isBreached) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        issue.title.toLowerCase().includes(q) ||
        issue.ticketNumber.toLowerCase().includes(q) ||
        issue.address.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Calculate metrics
  const total = issues.length;
  const resolved = issues.filter((i) => i.status === 'resolved').length;
  const breaches = issues.filter(
    (i) => i.status !== 'resolved' && new Date(i.slaDeadline).getTime() < now
  ).length;
  const criticalUnresolved = issues.filter(
    (i) => i.status !== 'resolved' && (i.severity === 'critical' || i.severity === 'high')
  ).length;

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((i) => i.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleBulkStatusChange = async (newStatus: IssueStatus) => {
    if (selectedIds.length === 0) return;
    setIsBulkProcessing(true);

    try {
      for (const id of selectedIds) {
        await fetch(`/api/issues/${id}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            newStatus,
            officerName: 'Municipal Admin Bulk Ops',
            notes: `Bulk status update applied to ${newStatus}`,
          }),
        });
      }
      setSelectedIds([]);
      onRefresh();
    } catch (err) {
      console.error('Bulk operation failed:', err);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase">Active Issue Queue</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{total - resolved}</div>
          <div className="text-[10px] text-teal-700 font-medium mt-0.5">{total} total tickets registered</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-rose-200 shadow-xs bg-rose-50/30">
          <div className="text-[11px] font-bold text-rose-700 uppercase flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            SLA Breached Tickets
          </div>
          <div className="text-2xl font-bold text-rose-700 mt-1">{breaches}</div>
          <div className="text-[10px] text-rose-600 font-medium mt-0.5">Urgent escalation required</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs bg-amber-50/30">
          <div className="text-[11px] font-bold text-amber-800 uppercase flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            High / Critical Open
          </div>
          <div className="text-2xl font-bold text-amber-900 mt-1">{criticalUnresolved}</div>
          <div className="text-[10px] text-amber-700 font-medium mt-0.5">Top safety hazard score</div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs bg-emerald-50/30">
          <div className="text-[11px] font-bold text-emerald-800 uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Municipal Resolution
          </div>
          <div className="text-2xl font-bold text-emerald-900 mt-1">
            {total > 0 ? Math.round((resolved / total) * 100) : 0}%
          </div>
          <div className="text-[10px] text-emerald-700 font-medium mt-0.5">{resolved} issues transparently closed</div>
        </div>
      </div>

      {/* Filter and Bulk Action Bar */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by ticket #, description, road..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-slate-50"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
          >
            <option value="all">All Statuses</option>
            <option value="reported">Reported</option>
            <option value="verified">Verified</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="reopened">Reopened</option>
          </select>

          {/* SLA Breach Checkbox */}
          <label className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 cursor-pointer bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200">
            <input
              type="checkbox"
              checked={filterSlaBreachOnly}
              onChange={(e) => setFilterSlaBreachOnly(e.target.checked)}
              className="w-3.5 h-3.5 accent-rose-600 rounded"
            />
            <span>SLA Breaches Only</span>
          </label>
        </div>

        {/* Bulk Action Controls if items selected */}
        {selectedIds.length > 0 && (
          <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-teal-900">
              {selectedIds.length} tickets selected for bulk action:
            </span>

            <div className="flex items-center gap-2">
              <button
                disabled={isBulkProcessing}
                onClick={() => handleBulkStatusChange('verified')}
                className="px-2.5 py-1 bg-white hover:bg-teal-100 text-teal-800 font-semibold border border-teal-300 rounded shadow-2xs"
              >
                Mark Verified
              </button>
              <button
                disabled={isBulkProcessing}
                onClick={() => handleBulkStatusChange('in_progress')}
                className="px-2.5 py-1 bg-white hover:bg-teal-100 text-teal-800 font-semibold border border-teal-300 rounded shadow-2xs"
              >
                Set In Progress
              </button>
              <button
                disabled={isBulkProcessing}
                onClick={() => handleBulkStatusChange('resolved')}
                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded shadow-2xs"
              >
                Bulk Resolve
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Issue Triage Table / Card Feed */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 font-semibold">
          <div className="flex items-center gap-2">
            <button onClick={toggleSelectAll} className="text-slate-500 hover:text-slate-800">
              {selectedIds.length === filtered.length && filtered.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-teal-600" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
            <span>Issue Ticket & Description</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="hidden sm:inline">Priority & Upvotes</span>
            <span className="hidden sm:inline">SLA Deadline</span>
            <span>Status</span>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No civic issues match the active filter criteria.
            </div>
          ) : (
            filtered.map((issue) => {
              const isBreached = issue.status !== 'resolved' && new Date(issue.slaDeadline).getTime() < now;
              const isSelected = selectedIds.includes(issue.id);

              return (
                <div
                  key={issue.id}
                  className={`p-3.5 hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-3 ${
                    isSelected ? 'bg-teal-50/50' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(issue.id);
                      }}
                      className="text-slate-400 hover:text-slate-700 shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-teal-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div
                      onClick={() => onSelectIssue(issue)}
                      className="cursor-pointer flex-1 min-w-0"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                          {issue.ticketNumber}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          Ward {issue.wardNumber} • {issue.assignedDept}
                        </span>
                        {isBreached && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                            SLA BREACHED
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-900 truncate">{issue.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">{issue.address}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 text-right">
                    <div className="hidden sm:block">
                      <div className="text-xs font-bold text-teal-800">Score: {issue.priorityScore}</div>
                      <div className="text-[10px] text-slate-500">▲ {issue.upvotesCount} upvotes</div>
                    </div>

                    <div className="hidden sm:block">
                      <div className={`text-[11px] font-semibold ${isBreached ? 'text-rose-700' : 'text-slate-700'}`}>
                        {new Date(issue.slaDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(issue.slaDeadline).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectIssue(issue)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold capitalize transition-all ${
                        issue.status === 'resolved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : issue.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : issue.status === 'assigned'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {issue.status.replace('_', ' ')}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

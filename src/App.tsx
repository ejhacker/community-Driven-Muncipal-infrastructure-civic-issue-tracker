/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  List,
  Map as MapIcon,
  Filter,
  Search,
  ThumbsUp,
  AlertTriangle,
  Clock,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Shield,
  Layers,
} from 'lucide-react';
import { Issue, UserRole, IssueCategory } from './types';
import { Navbar } from './components/Navbar';
import { MapLibreView } from './components/MapLibreView';
import { ReportIssueModal } from './components/ReportIssueModal';
import { IssueDetailModal } from './components/IssueDetailModal';
import { OfficerDashboard } from './components/OfficerDashboard';
import { TransparencyStatsView } from './components/TransparencyStats';
import { SystemBlueprintModal } from './components/SystemBlueprintModal';
import { getOfflineQueue, syncOfflineReports } from './utils/offlineQueue';
import { Language, translations } from './utils/translations';

export default function App() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<'map_list' | 'officer_board' | 'stats'>('map_list');
  const [activeTabMobile, setActiveTabMobile] = useState<'list' | 'map'>('list');

  // Modal States
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // Filters & Sorting
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'newest' | 'upvotes' | 'sla'>('priority');

  // Role, Language & Network Modes
  const [currentRole, setCurrentRole] = useState<UserRole>('citizen');
  const [lang, setLang] = useState<Language>('en');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lowBandwidthMode, setLowBandwidthMode] = useState(false);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const t = translations[lang];

  // Fetch Issues
  const fetchIssues = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (selectedWard !== 'all') params.set('ward', selectedWard);
      if (searchQuery) params.set('search', searchQuery);
      params.set('sortBy', sortBy);

      const res = await fetch(`/api/issues?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues || []);
      }
    } catch (err) {
      console.warn('Failed to load issues from network:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedStatus, selectedWard, searchQuery, sortBy]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Offline and PWA Listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      handleSyncOffline();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Read initial offline queue count
    setOfflineQueueCount(getOfflineQueue().length);

    const handleQueueChange = (e: any) => {
      setOfflineQueueCount(e.detail?.count || 0);
    };
    window.addEventListener('nagrikpulse:offline-queue-updated', handleQueueChange);

    // Register service worker if available
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch((err) => console.log('SW registration:', err));
    }

    // Attempt automatic live GPS detection on startup
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => console.log('App live GPS initial check:', err.message),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('nagrikpulse:offline-queue-updated', handleQueueChange);
    };
  }, []);

  const handleSyncOffline = async () => {
    const { syncedCount } = await syncOfflineReports();
    if (syncedCount > 0) {
      fetchIssues();
    }
    setOfflineQueueCount(getOfflineQueue().length);
  };

  const handleToggleSimulateOffline = () => {
    const nextState = !isOnline;
    setIsOnline(nextState);
    if (nextState) {
      handleSyncOffline();
    }
  };

  const handleQuickUpvote = async (issueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/issues/${issueId}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAffected: false }),
      });
      if (res.ok) {
        fetchIssues();
      }
    } catch (err) {
      console.error('Quick upvote failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        onOpenBlueprintModal={() => setIsBlueprintModalOpen(true)}
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        lang={lang}
        onToggleLang={() => setLang(lang === 'en' ? 'hi' : 'en')}
        isOnline={isOnline}
        onToggleSimulateOffline={handleToggleSimulateOffline}
        offlineCount={offlineQueueCount}
        onSyncOffline={handleSyncOffline}
        lowBandwidthMode={lowBandwidthMode}
        onToggleLowBandwidth={() => setLowBandwidthMode(!lowBandwidthMode)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5">
        {currentView === 'stats' ? (
          <TransparencyStatsView />
        ) : currentView === 'officer_board' ? (
          <OfficerDashboard
            issues={issues}
            onSelectIssue={(issue) => setSelectedIssue(issue)}
            onRefresh={fetchIssues}
            lang={lang}
          />
        ) : (
          /* Split View: Map + Issues Feed */
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                {/* Search */}
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by ticket #, description, road or ward..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-slate-50"
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="all">{t.allCategories}</option>
                  <option value="pothole">{t.pothole}</option>
                  <option value="broken_streetlight">{t.broken_streetlight}</option>
                  <option value="garbage_dump">{t.garbage_dump}</option>
                  <option value="water_leakage">{t.water_leakage}</option>
                  <option value="drainage_overflow">{t.drainage_overflow}</option>
                  <option value="damaged_road">{t.damaged_road}</option>
                </select>

                {/* Status Filter */}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="all">{t.allStatuses}</option>
                  <option value="reported">{t.statusReported}</option>
                  <option value="verified">{t.statusVerified}</option>
                  <option value="assigned">{t.statusAssigned}</option>
                  <option value="in_progress">{t.statusInProgress}</option>
                  <option value="resolved">{t.statusResolved}</option>
                </select>

                {/* Sort Order */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white font-medium"
                >
                  <option value="priority">Sort: Priority Score (AI)</option>
                  <option value="upvotes">Sort: Most Upvoted</option>
                  <option value="sla">Sort: Urgent SLA Deadline</option>
                  <option value="newest">Sort: Newest First</option>
                </select>

                {/* Mobile View Toggle Switch (List vs Map) */}
                <div className="flex md:hidden bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button
                    onClick={() => setActiveTabMobile('list')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      activeTabMobile === 'list'
                        ? 'bg-white text-teal-800 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    List
                  </button>
                  <button
                    onClick={() => setActiveTabMobile('map')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                      activeTabMobile === 'map'
                        ? 'bg-white text-teal-800 shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Map
                  </button>
                </div>
              </div>
            </div>

            {/* Split Screen Grid (Left: Issues Feed, Right: MapLibre Map) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Left Column: Issues Feed */}
              <div
                className={`md:col-span-5 space-y-3 ${
                  activeTabMobile === 'map' ? 'hidden md:block' : 'block'
                }`}
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-700">
                    {issues.length} Civic Issues Found
                  </span>
                  <span className="text-[11px] text-teal-700 font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Faridabad / Delhi-NCR Municipal Sector
                  </span>
                </div>

                {loading ? (
                  <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
                    <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Loading municipal issues ledger...
                  </div>
                ) : issues.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 bg-white rounded-xl border border-slate-200">
                    No issues match your current filters.
                  </div>
                ) : (
                  issues.map((issue) => {
                    const slaDeadline = new Date(issue.slaDeadline).getTime();
                    const now = Date.now();
                    const isBreached = issue.status !== 'resolved' && slaDeadline < now;
                    const hoursLeft = Math.max(0, Math.round((slaDeadline - now) / (3600 * 1000)));

                    return (
                      <div
                        key={issue.id}
                        onClick={() => setSelectedIssue(issue)}
                        className="bg-white p-3.5 rounded-xl border border-slate-200 hover:border-teal-500 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              {issue.ticketNumber}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {issue.category.replace('_', ' ')}
                            </span>
                            {isBreached && (
                              <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded">
                                SLA Breached
                              </span>
                            )}
                          </div>

                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
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
                          </span>
                        </div>

                        {/* Title & Preview Image */}
                        <div className="flex gap-3">
                          <img
                            src={issue.photoUrl}
                            alt={issue.title}
                            className="w-16 h-16 rounded-lg object-cover border border-slate-100 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-1 leading-snug">
                              {issue.title}
                            </h3>
                            <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                              {issue.description}
                            </p>
                          </div>
                        </div>

                        {/* Location address */}
                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate">{issue.address}</span>
                        </div>

                        {/* Footer details & Quick Actions */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => handleQuickUpvote(issue.id, e)}
                              className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md transition-all ${
                                issue.userHasUpvoted
                                  ? 'bg-teal-700 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700'
                              }`}
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span>{issue.upvotesCount}</span>
                            </button>

                            <span className="text-[11px] text-slate-400">
                              ▲ Priority Score: <span className="font-bold text-teal-800">{issue.priorityScore}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span>
                              {issue.status === 'resolved'
                                ? 'Resolved'
                                : `${hoursLeft}h left`}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: MapLibre Interactive OpenStreetMap View */}
              <div
                className={`md:col-span-7 h-[540px] md:h-[680px] sticky top-20 rounded-xl overflow-hidden ${
                  activeTabMobile === 'list' ? 'hidden md:block' : 'block'
                }`}
              >
                <MapLibreView
                  issues={issues}
                  selectedIssueId={selectedIssue?.id}
                  onSelectIssue={(issue) => setSelectedIssue(issue)}
                  lowBandwidthMode={lowBandwidthMode}
                  userCoordinates={userLocation}
                />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button on Mobile */}
      <div className="fixed bottom-5 right-5 z-30 sm:hidden">
        <button
          onClick={() => setIsReportModalOpen(true)}
          className="p-3.5 bg-teal-700 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-teal-800 active:scale-95 transition-all"
        >
          <span className="text-xl leading-none">＋</span>
        </button>
      </div>

      {/* Report Modal */}
      <ReportIssueModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onIssueCreated={fetchIssues}
        lang={lang}
        isOnline={isOnline}
        lowBandwidthMode={lowBandwidthMode}
      />

      {/* Issue Detail Modal */}
      <IssueDetailModal
        issue={selectedIssue}
        isOpen={!!selectedIssue}
        onClose={() => setSelectedIssue(null)}
        onIssueUpdated={fetchIssues}
        currentRole={currentRole}
        lang={lang}
      />

      {/* Technical Blueprint & Deliverables Modal */}
      <SystemBlueprintModal
        isOpen={isBlueprintModalOpen}
        onClose={() => setIsBlueprintModalOpen(false)}
      />
    </div>
  );
}

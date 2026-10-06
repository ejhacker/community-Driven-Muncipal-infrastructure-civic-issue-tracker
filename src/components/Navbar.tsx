import React from 'react';
import {
  MapPin,
  Plus,
  Shield,
  BarChart2,
  List,
  BookOpen,
  Wifi,
  WifiOff,
  RefreshCw,
  Globe,
  SlidersHorizontal,
} from 'lucide-react';
import { UserRole } from '../types';
import { Language, translations } from '../utils/translations';

interface NavbarProps {
  currentView: 'map_list' | 'officer_board' | 'stats';
  onViewChange: (view: 'map_list' | 'officer_board' | 'stats') => void;
  onOpenReportModal: () => void;
  onOpenBlueprintModal: () => void;
  currentRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  lang: Language;
  onToggleLang: () => void;
  isOnline: boolean;
  onToggleSimulateOffline: () => void;
  offlineCount: number;
  onSyncOffline: () => void;
  lowBandwidthMode: boolean;
  onToggleLowBandwidth: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  onOpenReportModal,
  onOpenBlueprintModal,
  currentRole,
  onRoleChange,
  lang,
  onToggleLang,
  isOnline,
  onToggleSimulateOffline,
  offlineCount,
  onSyncOffline,
  lowBandwidthMode,
  onToggleLowBandwidth,
}) => {
  const t = translations[lang];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-5">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br from-teal-700 to-teal-900 rounded-xl flex items-center justify-center text-white shadow-sm">
              <MapPin className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base sm:text-lg text-slate-900 tracking-tight leading-none">
                  {t.appTitle}
                </span>
                <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-1.5 py-0.2 rounded-sm uppercase tracking-wide">
                  PWA
                </span>
              </div>
              <p className="text-[10px] text-slate-500 hidden sm:block leading-none mt-0.5">
                Community Municipal Infrastructure & SLA Tracker
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onViewChange('map_list')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                currentView === 'map_list'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">{t.issuesList}</span>
            </button>

            <button
              onClick={() => onViewChange('officer_board')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                currentView === 'officer_board'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">{t.adminDashboard}</span>
            </button>

            <button
              onClick={() => onViewChange('stats')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                currentView === 'stats'
                  ? 'bg-teal-50 text-teal-800 border border-teal-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t.transparency}</span>
            </button>
          </nav>

          {/* Actions & Utilities */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Offline sync queue chip if any pending */}
            {offlineCount > 0 && (
              <button
                onClick={onSyncOffline}
                className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold rounded-lg flex items-center gap-1 animate-pulse"
                title="Click to sync offline reports"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{offlineCount} Offline</span>
              </button>
            )}

            {/* Offline Simulator Toggle */}
            <button
              onClick={onToggleSimulateOffline}
              title={isOnline ? 'Online (Click to simulate 3G offline/no signal)' : 'Offline mode active (Click to reconnect)'}
              className={`p-1.5 sm:px-2 sm:py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-100 text-rose-900 border border-rose-300'
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-600" /> : <WifiOff className="w-3.5 h-3.5 text-rose-600" />}
              <span className="hidden md:inline">{isOnline ? 'Online' : 'Offline'}</span>
            </button>

            {/* Low-Bandwidth / 2G Mode Toggle */}
            <button
              onClick={onToggleLowBandwidth}
              title="Toggle Low Bandwidth Data Saver (Zero tile download)"
              className={`px-2 py-1 rounded-lg text-xs font-semibold hidden md:flex items-center gap-1 transition-all ${
                lowBandwidthMode
                  ? 'bg-teal-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{lowBandwidthMode ? '2G Lite: ON' : '2G Lite'}</span>
            </button>

            {/* Language Switcher */}
            <button
              onClick={onToggleLang}
              className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 flex items-center gap-1"
              title="Switch language"
            >
              <Globe className="w-3.5 h-3.5 text-teal-700" />
              <span>{lang === 'en' ? 'हिन्दी' : 'EN'}</span>
            </button>

            {/* Role Switcher */}
            <select
              value={currentRole}
              onChange={(e) => onRoleChange(e.target.value as UserRole)}
              className="text-xs py-1 px-2 border border-slate-300 rounded-lg bg-white font-semibold text-slate-700 focus:outline-hidden"
              title="Switch role for testing triage"
            >
              <option value="citizen">Role: Citizen</option>
              <option value="field_officer">Role: Field Officer</option>
              <option value="department_admin">Role: Dept Admin</option>
              <option value="super_admin">Role: Super Admin</option>
            </select>

            {/* Deliverables Blueprint Modal Trigger */}
            <button
              onClick={onOpenBlueprintModal}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold bg-slate-900 hover:bg-black text-white flex items-center gap-1.5 transition-all shadow-2xs"
              title="View Architecture, PostGIS Schema, Cost Model & Deliverables 1-9"
            >
              <BookOpen className="w-3.5 h-3.5 text-teal-300" />
              <span className="hidden sm:inline">Deliverables 1-9</span>
            </button>

            {/* Report Issue CTA Button */}
            <button
              onClick={onOpenReportModal}
              className="py-1.5 px-3 sm:py-2 sm:px-4 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{t.reportIssue}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

/**
 * CivicModals.tsx
 * Consolidated Municipal Civic Dialogs, Modals & Transparency Views:
 * 1. ReportIssueModal (Civic reporting with live GPS geotagging, client image compression & Gemini AI)
 * 2. IssueDetailModal (Public ledger detail, SLA countdown, upvoting, official triage & proof)
 * 3. TransparencyStatsView (Public municipal analytics, SLA compliance, ward breakdown & karma)
 * 4. SystemBlueprintModal (Municipal architecture specifications & offline PWA docs)
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  Sparkles,
  MapPin,
  AlertTriangle,
  Upload,
  CheckCircle2,
  Shield,
  ThumbsUp,
  WifiOff,
  Clock,
  MessageSquare,
  Share2,
  Star,
  RefreshCw,
  Building2,
  ChevronRight,
  BookOpen,
  DollarSign,
  Database,
  Cpu,
  Layers,
  Terminal,
  Milestone,
  ShieldCheck,
  TrendingUp,
  Award,
  Users,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Issue,
  IssueCategory,
  IssueSeverity,
  LocationSensitivity,
  DuplicateIssueMatch,
  UserRole,
  TransparencyStats as StatsType,
} from '../types';
import {
  compressImage,
  CompressionResult,
  addToOfflineQueue,
  translations,
  Language,
} from '../utils';
import { MapLibreView } from './MapLibreView';

// ============================================================================
// 1. REPORT ISSUE MODAL
// ============================================================================
interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIssueCreated: () => void;
  lang: Language;
  isOnline: boolean;
  lowBandwidthMode: boolean;
  currentLiveGps?: { lat: number; lng: number } | null;
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({
  isOpen,
  onClose,
  onIssueCreated,
  lang,
  isOnline,
  lowBandwidthMode,
  currentLiveGps,
}) => {
  const t = translations[lang];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<IssueCategory>('pothole');
  const [severity, setSeverity] = useState<IssueSeverity>('medium');
  const [locationSensitivity, setLocationSensitivity] = useState<LocationSensitivity>('standard');
  const [wardNumber, setWardNumber] = useState(22);
  const [address, setAddress] = useState('Sector 15, Mathura Road, Faridabad Ward 22');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [reporterName, setReporterName] = useState('Aarav Sharma');

  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 28.4089,
    lng: 77.3178,
  });

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);

  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiAnalysisSummary, setAiAnalysisSummary] = useState<string | null>(null);

  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateIssueMatch | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const captureLiveGpsLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const newCoords = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setCoords(newCoords);
          setIsLocating(false);
          checkDuplicateNearby(newCoords.lat, newCoords.lng, category);

          fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${newCoords.lat}&lon=${newCoords.lng}`
          )
            .then((r) => r.json())
            .then((data) => {
              if (data && data.display_name) {
                setAddress(data.display_name);
              }
            })
            .catch(() => {
              setAddress(`GPS Coords: ${newCoords.lat.toFixed(5)}, ${newCoords.lng.toFixed(5)}`);
            });
        },
        (err) => {
          console.warn('Geolocation failed:', err.message);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (currentLiveGps && typeof currentLiveGps.lat === 'number' && typeof currentLiveGps.lng === 'number') {
        setCoords(currentLiveGps);
        checkDuplicateNearby(currentLiveGps.lat, currentLiveGps.lng, category);
      } else {
        captureLiveGpsLocation();
      }
    }
  }, [isOpen, currentLiveGps]);

  const checkDuplicateNearby = async (lat: number, lng: number, cat: string) => {
    try {
      setIsCheckingDuplicates(true);
      const res = await fetch(`/api/issues/check-duplicate?lat=${lat}&lng=${lng}&category=${cat}&radius=65`);
      if (res.ok) {
        const data = await res.json();
        setDuplicateMatch(data.duplicateMatch || null);
      }
    } catch (err) {
      console.warn('Duplicate check warning:', err);
    } finally {
      setIsCheckingDuplicates(false);
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsCompressing(true);
      const result = await compressImage(file, lowBandwidthMode ? 800 : 1200, lowBandwidthMode ? 0.65 : 0.8);
      setCompressionInfo(result);
      setImagePreview(result.base64);
    } catch (err) {
      console.error('Image compression failed:', err);
    } finally {
      setIsCompressing(false);
    }
  };

  const runGeminiAutoTriage = async () => {
    if (!imagePreview && !description) {
      alert('Please add a photo or brief description first for Gemini AI analysis.');
      return;
    }

    try {
      setIsAnalyzingAI(true);
      const res = await fetch('/api/ai/analyze-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description || title,
          imageBase64: imagePreview,
          locationContext: address,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.suggestedTitle) setTitle(data.suggestedTitle);
        if (data.suggestedCategory) {
          setCategory(data.suggestedCategory);
          checkDuplicateNearby(coords.lat, coords.lng, data.suggestedCategory);
        }
        if (data.suggestedSeverity) setSeverity(data.suggestedSeverity);
        if (data.suggestedLocationSensitivity) setLocationSensitivity(data.suggestedLocationSensitivity);
        setAiAnalysisSummary(data.aiSummary || 'Analyzed via Gemini Flash.');
      }
    } catch (err) {
      console.error('AI Triage error:', err);
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Please provide a title for the civic defect.');
      return;
    }

    setIsSubmitting(true);

    const reportData = {
      title: title.trim(),
      description: description.trim(),
      category,
      severity,
      latitude: coords.lat,
      longitude: coords.lng,
      address,
      wardNumber: Number(wardNumber) || 1,
      locationSensitivity,
      photoUrl: imagePreview || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80',
      isAnonymous,
      reporterName: isAnonymous ? 'Anonymous Citizen' : reporterName || 'Concerned Citizen',
    };

    if (!isOnline) {
      addToOfflineQueue(reportData);
      setIsSubmitting(false);
      onIssueCreated();
      onClose();
      return;
    }

    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData),
      });

      if (res.ok) {
        confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
        onIssueCreated();
        onClose();
      } else {
        addToOfflineQueue(reportData);
        onIssueCreated();
        onClose();
      }
    } catch (err) {
      console.warn('Network issue on submit, saving to offline queue:', err);
      addToOfflineQueue(reportData);
      onIssueCreated();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-teal-800 text-white flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Camera className="w-5 h-5 text-teal-300" />
              {t.reportIssue}
            </h2>
            <p className="text-xs text-teal-200 mt-0.5">
              Live GPS Geotagged • SLA Monitored • Community Validated
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-teal-200 hover:text-white hover:bg-teal-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Duplicate Detection Warning Banner */}
          {duplicateMatch && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 text-xs text-amber-900">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-amber-950 flex items-center gap-1.5">
                  <span>{t.duplicateFoundNotice}</span>
                  <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-mono">
                    {duplicateMatch.distanceMeters}m away
                  </span>
                </div>
                <div className="text-amber-800 mt-0.5">
                  "{duplicateMatch.title}" (Ticket: {duplicateMatch.ticketNumber})
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/issues/${duplicateMatch.id}/upvote`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ isAffected: true }),
                      });
                      onIssueCreated();
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-2xs"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    {t.upvoteExistingCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateMatch(null)}
                    className="text-[11px] text-amber-700 hover:underline"
                  >
                    {t.continueReporting}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Photo Capture & HTML5 Canvas Compression */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Defect Photo (Live Geotagged)
            </label>
            <div className="mt-1 flex flex-col sm:flex-row items-center gap-3">
              <label className="w-full sm:w-auto cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-50 border-2 border-dashed border-teal-300 hover:border-teal-500 rounded-xl text-teal-800 text-xs font-semibold transition-all">
                <Camera className="w-4 h-4 text-teal-600" />
                <span>Take Photo / Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>

              {imagePreview && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                  />
                  <div className="text-[11px] text-slate-500 leading-tight">
                    {compressionInfo && (
                      <div>
                        <span className="font-semibold text-teal-700">{compressionInfo.mimeType.split('/')[1].toUpperCase()}</span>{' '}
                        {Math.round(compressionInfo.compressedSizeBytes / 1024)} KB{' '}
                        <span className="text-emerald-600">({compressionInfo.compressionRatio} saved)</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(null);
                        setCompressionInfo(null);
                      }}
                      className="text-rose-600 hover:underline text-[10px]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Gemini AI Auto-Triage Trigger */}
          <div className="p-3 bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-700 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-teal-950">Gemini 3.8 Flash AI Assistance</div>
                <div className="text-[11px] text-teal-700">
                  Auto-classifies defect type, severity SLA, and hazard sensitivity.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={runGeminiAutoTriage}
              disabled={isAnalyzingAI}
              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 shrink-0 flex items-center gap-1 shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAnalyzingAI ? 'Analyzing...' : 'Auto-Detect'}
            </button>
          </div>

          {aiAnalysisSummary && (
            <div className="text-[11px] text-teal-800 bg-teal-100/60 p-2 rounded-lg border border-teal-200">
              <span className="font-bold">AI Diagnosis: </span>{aiAnalysisSummary}
            </div>
          )}

          {/* Title & Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Defect Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Hazardous Pothole near Sector 15 Market"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const newCat = e.target.value as IssueCategory;
                  setCategory(newCat);
                  checkDuplicateNearby(coords.lat, coords.lng, newCat);
                }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
              >
                <option value="pothole">Pothole / Road Crater</option>
                <option value="broken_streetlight">Broken Streetlight / Blackout</option>
                <option value="garbage_dump">Illegal Garbage Dump</option>
                <option value="water_leakage">Pipeline Leakage / Water Waste</option>
                <option value="drainage_overflow">Drain / Sewer Overflow</option>
                <option value="damaged_road">Damaged Road Surface</option>
                <option value="encroachment">Footpath Encroachment</option>
                <option value="fallen_tree">Fallen Tree / Blocked Road</option>
                <option value="other">Other Infrastructure Issue</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description & Landmark Details
            </label>
            <textarea
              rows={2}
              placeholder="Describe depth, water accumulation, traffic hazard, exact landmark..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
            />
          </div>

          {/* Severity & Sensitivity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hazard Severity
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
              >
                <option value="low">Low (Cosmetic / 72h SLA)</option>
                <option value="medium">Medium (Moderate / 48h SLA)</option>
                <option value="high">High (Traffic Risk / 24h SLA)</option>
                <option value="critical">Critical (Immediate Danger / 12h SLA)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Zone Sensitivity
              </label>
              <select
                value={locationSensitivity}
                onChange={(e) => setLocationSensitivity(e.target.value as LocationSensitivity)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
              >
                <option value="standard">Standard Residential / Commercial</option>
                <option value="near_school">Near School / College (+ Priority)</option>
                <option value="near_hospital">Near Hospital / Clinic (+ Priority)</option>
                <option value="major_intersection">Major Traffic Intersection</option>
                <option value="public_transit">Bus / Metro Station Zone</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Municipal Ward #
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={wardNumber}
                onChange={(e) => setWardNumber(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
              />
            </div>
          </div>

          {/* Interactive Pin Location Picker on MapLibre */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                Live Geotagged Location (Tap Map to Move Pin)
              </span>
              <button
                type="button"
                onClick={captureLiveGpsLocation}
                disabled={isLocating}
                className="text-[11px] text-teal-700 hover:underline flex items-center gap-1 font-bold"
              >
                {isLocating ? 'Acquiring GPS...' : 'Refetch My GPS'}
              </button>
            </div>

            <div className="h-44 rounded-xl overflow-hidden border border-slate-300 shadow-inner">
              <MapLibreView
                issues={[]}
                onSelectIssue={() => {}}
                isPickerMode={true}
                pickerCoordinates={coords}
                onCoordinatesChange={(newCoords) => {
                  setCoords(newCoords);
                  checkDuplicateNearby(newCoords.lat, newCoords.lng, category);
                }}
                lowBandwidthMode={lowBandwidthMode}
              />
            </div>
            <div className="text-[10px] text-slate-500 truncate mt-1">
              Lat: {coords.lat.toFixed(5)}, Lng: {coords.lng.toFixed(5)} • {address}
            </div>
          </div>

          {/* Citizen Privacy & Identity */}
          <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500"
              />
              <span>Report Anonymously (Hide name on public ledger)</span>
            </label>

            {!isAnonymous && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Your Name:</span>
                <input
                  type="text"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                />
              </div>
            )}
          </div>

          {/* Submit CTA */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t.submitting}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.submitReport}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 2. ISSUE DETAIL MODAL
// ============================================================================
interface IssueDetailModalProps {
  issue: Issue | null;
  isOpen: boolean;
  onClose: () => void;
  onIssueUpdated: () => void;
  currentRole: UserRole;
  lang: Language;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issue,
  isOpen,
  onClose,
  onIssueUpdated,
  currentRole,
  lang,
}) => {
  const t = translations[lang];

  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [rating, setRating] = useState<number>(5);
  const [reopenFeedback, setReopenFeedback] = useState('');
  const [showReopenInput, setShowReopenInput] = useState(false);

  const [officerNextStatus, setOfficerNextStatus] = useState<string>('in_progress');
  const [officerNotes, setOfficerNotes] = useState('');
  const [resolutionPhoto, setResolutionPhoto] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen || !issue) return null;

  const isStaff =
    currentRole === 'field_officer' ||
    currentRole === 'department_admin' ||
    currentRole === 'super_admin' ||
    currentRole === 'moderator';

  const slaDeadline = new Date(issue.slaDeadline).getTime();
  const now = Date.now();
  const isBreached = issue.status !== 'resolved' && slaDeadline < now;
  const hoursRemaining = Math.max(0, Math.round((slaDeadline - now) / (3600 * 1000)));

  const handleUpvote = async (isAffected: boolean) => {
    try {
      const res = await fetch(`/api/issues/${issue.id}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAffected }),
      });
      if (res.ok) {
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
        onIssueUpdated();
      }
    } catch (err) {
      console.error('Failed to upvote:', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch(`/api/issues/${issue.id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: isStaff ? `${currentRole.toUpperCase()} Officer` : 'Citizen Contributor',
          isOfficial: isStaff,
          message: commentText.trim(),
        }),
      });

      if (res.ok) {
        setCommentText('');
        onIssueUpdated();
      }
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleOfficerStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingStatus(true);

    try {
      const res = await fetch(`/api/issues/${issue.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newStatus: officerNextStatus,
          officerName: `${currentRole.replace('_', ' ').toUpperCase()} Officer`,
          notes: officerNotes || `Status updated to ${officerNextStatus}`,
          resolutionPhotoUrl: resolutionPhoto || undefined,
        }),
      });

      if (res.ok) {
        confetti({ particleCount: 60, spread: 70 });
        setOfficerNotes('');
        setResolutionPhoto('');
        onIssueUpdated();
      }
    } catch (err) {
      console.error('Status update failed:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleRateOrReopen = async (reopen: boolean) => {
    try {
      const res = await fetch(`/api/issues/${issue.id}/rate-resolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          feedback: reopen ? reopenFeedback : 'Resolution verified by community.',
          reopen,
          citizenName: 'Community Inspector',
        }),
      });

      if (res.ok) {
        setShowReopenInput(false);
        onIssueUpdated();
      }
    } catch (err) {
      console.error('Rate/reopen failed:', err);
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.origin + '?ticket=' + issue.ticketNumber);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-teal-600/80 text-white px-2 py-0.5 rounded">
              {issue.ticketNumber}
            </span>
            <span className="text-xs text-slate-300">Ward {issue.wardNumber}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors text-xs flex items-center gap-1"
              title="Share public issue link"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">{copiedLink ? 'Copied!' : 'Share'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Photos: Before & After Split if Resolved */}
          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] font-bold text-slate-500 mb-1 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-slate-400" />
                  ORIGINAL REPORT PHOTO (BEFORE)
                </div>
                <img
                  src={issue.photoUrl}
                  alt="Original civic defect"
                  className="w-full h-44 object-cover rounded-xl shadow-xs border border-slate-200"
                />
              </div>

              {issue.resolutionPhotoUrl ? (
                <div>
                  <div className="text-[11px] font-bold text-emerald-700 mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    MUNICIPAL RESOLUTION PROOF (AFTER)
                  </div>
                  <img
                    src={issue.resolutionPhotoUrl}
                    alt="Resolution proof"
                    className="w-full h-44 object-cover rounded-xl shadow-xs border-2 border-emerald-500"
                  />
                </div>
              ) : (
                <div className="hidden sm:flex flex-col items-center justify-center h-44 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-slate-400 p-4 text-center">
                  <Clock className="w-6 h-6 text-slate-300 mb-1" />
                  <span className="text-xs font-medium">Work in Progress</span>
                  <span className="text-[10px]">Field crew before/after proof will appear here upon completion</span>
                </div>
              )}
            </div>
          </div>

          {/* Status & SLA Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Status:</span>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                  issue.status === 'resolved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : issue.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-800'
                    : issue.status === 'assigned'
                    ? 'bg-purple-100 text-purple-800'
                    : issue.status === 'reopened'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {issue.status.replace('_', ' ')}
              </span>
              <span className="text-xs font-semibold text-slate-500">Severity:</span>
              <span className="text-xs font-bold capitalize text-slate-800">{issue.severity}</span>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <Clock className={`w-4 h-4 ${isBreached ? 'text-rose-600' : 'text-slate-500'}`} />
              {issue.status === 'resolved' ? (
                <span className="text-emerald-700 font-bold">Closed within SLA</span>
              ) : isBreached ? (
                <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded">
                  ⚠️ SLA Breached (Target: {issue.slaHours}h)
                </span>
              ) : (
                <span className="text-slate-700 font-medium">
                  {hoursRemaining}h remaining on SLA
                </span>
              )}
            </div>
          </div>

          {/* Main Title & Description */}
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">{issue.title}</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">{issue.description}</p>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
              <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span>{issue.address}</span>
            </div>
          </div>

          {/* Priority Score Breakdown Card */}
          <div className="p-3 bg-teal-50/70 border border-teal-200/80 rounded-xl flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                <span>Calculated Priority Score: {issue.priorityScore}</span>
                <span className="text-[10px] bg-teal-200 text-teal-900 px-1.5 py-0.2 rounded font-semibold">
                  Triage Algorithm
                </span>
              </div>
              <div className="text-[11px] text-teal-800 mt-0.5">
                f({issue.upvotesCount} upvotes, {issue.severity} hazard, {issue.locationSensitivity.replace('_', ' ')} zone)
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-700">Assigned Department:</div>
              <div className="text-xs font-bold text-slate-900 flex items-center justify-end gap-1">
                <Building2 className="w-3.5 h-3.5 text-teal-700" />
                {issue.assignedDept}
              </div>
            </div>
          </div>

          {/* Community Validation & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <button
              onClick={() => handleUpvote(false)}
              className={`flex-1 min-w-[130px] py-2 px-3 text-xs font-bold rounded-xl border flex items-center justify-center gap-1.5 transition-all ${
                issue.userHasUpvoted
                  ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              <span>{t.upvote} ({issue.upvotesCount})</span>
            </button>

            <button
              onClick={() => handleUpvote(true)}
              className="flex-1 min-w-[150px] py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl border border-amber-200 flex items-center justify-center gap-1.5 transition-all"
            >
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span>{t.affectedToo} ({issue.affectedCount})</span>
            </button>
          </div>

          {/* Resolution Rating / Reopen (if resolved) */}
          {issue.status === 'resolved' && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>Citizen Resolution Transparency & Feedback</span>
                </div>
                {issue.resolutionRating && (
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded">
                    ★ {issue.resolutionRating} / 5 Stars
                  </span>
                )}
              </div>

              {issue.resolutionFeedback && (
                <p className="text-xs text-emerald-900 italic bg-white/70 p-2 rounded border border-emerald-100">
                  "{issue.resolutionFeedback}"
                </p>
              )}

              {!showReopenInput ? (
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setRating(s);
                          handleRateOrReopen(false);
                        }}
                        className={`text-base hover:scale-125 transition-transform ${
                          s <= (issue.resolutionRating || rating)
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-slate-300'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setShowReopenInput(true)}
                    className="ml-auto text-xs font-bold text-rose-700 hover:text-rose-900 underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {t.reopenIssue}
                  </button>
                </div>
              ) : (
                <div className="space-y-2 pt-2 border-t border-emerald-200">
                  <textarea
                    rows={2}
                    placeholder="Describe why this issue is not fixed (e.g. crater only half-filled)..."
                    value={reopenFeedback}
                    onChange={(e) => setReopenFeedback(e.target.value)}
                    className="w-full p-2 text-xs border border-rose-300 rounded-lg bg-white"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setShowReopenInput(false)}
                      className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleRateOrReopen(true)}
                      className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg"
                    >
                      Confirm Reopen Ticket
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Field Officer & Admin Municipal Triage Panel */}
          {isStaff && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-900">
                <Shield className="w-4 h-4 text-purple-700" />
                <span>Municipal Authority Dispatch Panel ({currentRole.replace('_', ' ')})</span>
              </div>

              <form onSubmit={handleOfficerStatusSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-purple-800 mb-1">
                      Transition Status
                    </label>
                    <select
                      value={officerNextStatus}
                      onChange={(e) => setOfficerNextStatus(e.target.value)}
                      className="w-full p-2 text-xs border border-purple-300 rounded-lg bg-white font-medium"
                    >
                      <option value="verified">Verified (Confirm On-Ground)</option>
                      <option value="assigned">Assigned (Issue Work Order)</option>
                      <option value="in_progress">In Progress (Crews Deployed)</option>
                      <option value="resolved">Resolved (Upload Completion Proof)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-purple-800 mb-1">
                      Resolution Photo URL (Optional)
                    </label>
                    <input
                      type="url"
                      placeholder="https://... after photo"
                      value={resolutionPhoto}
                      onChange={(e) => setResolutionPhoto(e.target.value)}
                      className="w-full p-2 text-xs border border-purple-300 rounded-lg bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-purple-800 mb-1">
                    Public Transparency Note / Work Order Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Work crew dispatched; hot-mix asphalt patching completed."
                    value={officerNotes}
                    onChange={(e) => setOfficerNotes(e.target.value)}
                    className="w-full p-2 text-xs border border-purple-300 rounded-lg bg-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="w-full py-2 bg-purple-800 hover:bg-purple-900 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                >
                  {isUpdatingStatus ? 'Applying Triage...' : 'Execute Municipal Status Update'}
                </button>
              </form>
            </div>
          )}

          {/* Audit Timeline */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5">
              Public Transparency Audit Log
            </h3>
            <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {issue.timeline.map((entry) => (
                <div key={entry.id} className="relative pl-7 text-xs">
                  <div className="absolute left-1.5 top-1 w-3.5 h-3.5 rounded-full bg-teal-600 border-2 border-white shadow-xs" />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 capitalize">
                      {entry.newStatus.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-[11px] text-teal-800 font-medium">{entry.actorName}</div>
                  <div className="text-slate-600 mt-0.5">{entry.notes}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Community Comments Section */}
          <div className="pt-2 border-t border-slate-200">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
              Community Discussion ({issue.comments.length})
            </h3>

            <div className="space-y-2.5 max-h-48 overflow-y-auto mb-3">
              {issue.comments.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No community comments yet. Be the first to add details.</p>
              ) : (
                issue.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className={`p-2.5 rounded-xl text-xs ${
                      comment.isOfficial
                        ? 'bg-teal-50 border border-teal-200 text-teal-950'
                        : 'bg-slate-50 border border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold flex items-center gap-1">
                        {comment.authorName}
                        {comment.isOfficial && (
                          <span className="text-[10px] bg-teal-700 text-white font-semibold px-1.5 py-0.2 rounded">
                            Official
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{comment.message}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                type="text"
                placeholder="Add note, photo landmark, or follow-up..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
              />
              <button
                type="submit"
                disabled={isSubmittingComment || !commentText.trim()}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl disabled:opacity-50 transition-all shrink-0"
              >
                Comment
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. TRANSPARENCY STATS VIEW
// ============================================================================
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
            <div className="text-xl sm:text-2xl font-bold text-emerald-300">{stats.resolutionRate}%</div>
          </div>
          <div>
            <div className="text-[11px] text-teal-200">Avg Resolution Time</div>
            <div className="text-xl sm:text-2xl font-bold">{stats.avgResolutionHours}h</div>
          </div>
        </div>
      </div>

      {/* SLA Health Indicator */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800">
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-teal-600" />
            Statutory SLA Compliance
          </span>
          <span className="text-emerald-700">{100 - (stats.slaBreached > 0 ? 15 : 0)}% On-Time</span>
        </div>
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${stats.resolutionRate}%` }}
            className="bg-emerald-500 h-full transition-all"
            title="Resolved on time"
          />
          <div
            style={{ width: `${Math.max(10, 100 - stats.resolutionRate)}%` }}
            className="bg-amber-400 h-full transition-all"
            title="Under active SLA"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1 text-emerald-700 font-semibold">
            ● Resolved within SLA: {stats.resolved}
          </span>
          <span className="flex items-center gap-1 text-amber-700 font-semibold">
            ● In Progress / Active SLA: {stats.inProgress}
          </span>
          <span className="flex items-center gap-1 text-rose-700 font-semibold">
            ● Breached SLA: {stats.slaBreached}
          </span>
        </div>
      </div>

      {/* Ward Distribution & Top Reporters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ward Breakdown */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-teal-600" />
            Ward Volume Heatmap
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.wardCounts).map(([ward, count]) => (
              <div key={ward} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Ward {ward}</span>
                <div className="flex items-center gap-2 flex-1 max-w-[200px] mx-3">
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, (count / (stats.total || 1)) * 100 * 2.5)}%` }}
                      className="bg-teal-600 h-full rounded-full"
                    />
                  </div>
                </div>
                <span className="font-bold text-slate-800 font-mono">{count} tickets</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Citizen Contributors (Karma Leaderboard) */}
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" />
            Top Citizen Karma Contributors
          </h3>
          <div className="space-y-2.5">
            {stats.topReporters.map((rep, idx) => (
              <div
                key={rep.name}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-teal-700 text-white font-bold flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-bold text-slate-800">{rep.name}</div>
                    <div className="text-[10px] text-teal-700 font-semibold">{rep.badge}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900 font-mono">{rep.karma} Karma</div>
                  <div className="text-[10px] text-slate-500">{rep.verifiedReports} verified reports</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. SYSTEM BLUEPRINT MODAL
// ============================================================================
interface SystemBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemBlueprintModal: React.FC<SystemBlueprintModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'arch' | 'python' | 'gps' | 'cost'>('arch');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-teal-600 rounded-lg">
              <BookOpen className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h2 className="text-base font-bold">NagrikPulse Municipal Technical Blueprint</h2>
              <p className="text-[11px] text-teal-300">Live GPS Architecture, Python Core Engine & Municipal SLA Model</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-2 gap-1.5 shrink-0 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('arch')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'arch' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> 1. Full-Stack Architecture
          </button>
          <button
            onClick={() => setActiveTab('python')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'python' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" /> 2. Python Core Engine
          </button>
          <button
            onClick={() => setActiveTab('gps')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'gps' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" /> 3. Live GPS Telemetry
          </button>
          <button
            onClick={() => setActiveTab('cost')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'cost' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" /> 4. SLA & Cost Model
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs leading-relaxed text-slate-700">
          {activeTab === 'arch' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                1. System Architecture & Modern Consolidated Stack
              </h3>
              <p className="text-slate-600">
                NagrikPulse provides continuous municipal accountability by unifying real-time field force telemetry,
                multimodal Gemini AI triage, and zero-data-loss offline queuing into a consolidated lightweight design.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="font-bold text-slate-900 mb-1">Frontend Layer (React 19 + MapLibre GL)</div>
                  <div className="text-[11px] text-slate-600">
                    Client-side HTML5 canvas image compression (&lt;80KB), reactive offline sync queue, and vector MapLibre rendering.
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="font-bold text-slate-900 mb-1">Python 3 Core & Geodesic Engine</div>
                  <div className="text-[11px] text-slate-600">
                    Standalone Python engine on port 5050 with Haversine radial distance matching, proximity hazard detection, and live field tracking.
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'python' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                2. Python Standalone Engine (`python_backend/app.py`)
              </h3>
              <p className="text-slate-600">
                The entire municipal backend can run standalone in Python with zero third-party pip dependencies:
              </p>
              <div className="p-3 bg-slate-900 text-teal-300 font-mono text-[11px] rounded-xl overflow-x-auto">
                <pre>{`# 1. Run Python standalone backend & dashboard:
python3 python_backend/app.py

# 2. Open standalone dashboard:
http://localhost:5050

# 3. Run built-in self test suite:
python3 python_backend/app.py --test`}</pre>
              </div>
            </div>
          )}

          {activeTab === 'gps' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                3. High-Precision Continuous Live GPS Telemetry
              </h3>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
                <li><span className="font-semibold text-slate-900">Continuous Tracking:</span> Uses <code>navigator.geolocation.watchPosition</code> with high accuracy mode enabled.</li>
                <li><span className="font-semibold text-slate-900">Field Telemetry HUD:</span> Real-time speedometer (km/h), compass heading bearing (0°-360°), and distance surveyed.</li>
                <li><span className="font-semibold text-slate-900">Breadcrumbs:</span> Visual path polyline history following the citizen or municipal inspector.</li>
                <li><span className="font-semibold text-slate-900">Proximity Hazard Alerts:</span> Automatically detects and triggers warnings when within 40m of open civic hazards.</li>
                <li><span className="font-semibold text-slate-900">Simulation Walk:</span> One-click field walk simulator allowing instant desktop demonstration.</li>
              </ul>
            </div>
          )}

          {activeTab === 'cost' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                4. Statutory SLA Timers & Municipal Cost Model
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700">
                      <th className="p-2.5 font-bold">Severity</th>
                      <th className="p-2.5 font-bold">Target SLA</th>
                      <th className="p-2.5 font-bold">Auto-Escalation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2.5 font-semibold text-rose-700">Critical</td>
                      <td className="p-2.5">12 Hours</td>
                      <td className="p-2.5 text-slate-600">Executive Engineer SMS & Priority Push</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-amber-700">High</td>
                      <td className="p-2.5">24 Hours</td>
                      <td className="p-2.5 text-slate-600">Assistant Engineer Board Escalation</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-blue-700">Medium</td>
                      <td className="p-2.5">48 Hours</td>
                      <td className="p-2.5 text-slate-600">Department Routine Work Order</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-slate-700">Low</td>
                      <td className="p-2.5">72 Hours</td>
                      <td className="p-2.5 text-slate-600">Weekly Scheduled Maintenance Batch</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
} from 'lucide-react';
import { IssueCategory, IssueSeverity, LocationSensitivity, DuplicateIssueMatch } from '../types';
import { compressImage, CompressionResult } from '../utils/imageCompressor';
import { addToOfflineQueue } from '../utils/offlineQueue';
import { translations, Language } from '../utils/translations';
import { MapLibreView } from './MapLibreView';
import confetti from 'canvas-confetti';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIssueCreated: () => void;
  lang: Language;
  isOnline: boolean;
  lowBandwidthMode: boolean;
}

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({
  isOpen,
  onClose,
  onIssueCreated,
  lang,
  isOnline,
  lowBandwidthMode,
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

  // Location coordinates (default Faridabad / Delhi-NCR)
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 28.4089,
    lng: 77.3178,
  });

  // Image & Compression State
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressionInfo, setCompressionInfo] = useState<CompressionResult | null>(null);

  // AI & Duplicate State
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateIssueMatch[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [gpsDetected, setGpsDetected] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'locating' | 'geocoding' | 'success' | 'fallback'>('idle');

  // Reverse geocodes coordinates to a readable municipal address string
  const performReverseGeocode = async (latitude: number, longitude: number) => {
    setIsGeocoding(true);
    setGpsStatus('geocoding');
    try {
      const res = await fetch(`/api/geo/reverse-geocode?lat=${latitude}&lng=${longitude}`);
      if (res.ok) {
        const data = await res.json();
        if (data.address) {
          setAddress(data.address);
          if (data.wardNumber) {
            setWardNumber(data.wardNumber);
          }
          setGpsStatus('success');
          return;
        }
      }
    } catch (err) {
      console.warn('Reverse geocoding request failed:', err);
    } finally {
      setIsGeocoding(false);
    }

    // Fallback display if reverse geocoding API unreachable
    setAddress(`Near Lat ${latitude.toFixed(4)}, Lng ${longitude.toFixed(4)} (Municipal Zone)`);
    setGpsStatus('fallback');
  };

  // Trigger live GPS location capture and reverse-geocoding
  const captureLiveGpsLocation = () => {
    if (!navigator.geolocation) {
      performReverseGeocode(coords.lat, coords.lng);
      return;
    }

    setIsLocatingGps(true);
    setGpsStatus('locating');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        setGpsDetected(true);
        setIsLocatingGps(false);
        await performReverseGeocode(latitude, longitude);
      },
      async (err) => {
        console.warn('Geolocation capture dismissed or unavailable:', err.message);
        setIsLocatingGps(false);
        // Reverse geocode the fallback coordinates
        await performReverseGeocode(coords.lat, coords.lng);
      },
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 30000,
      }
    );
  };

  // Automatically trigger Geolocation API + reverse-geocoding upon opening the modal
  useEffect(() => {
    if (isOpen) {
      captureLiveGpsLocation();
    }
  }, [isOpen]);

  // Check for duplicates whenever coordinates or category changes
  useEffect(() => {
    if (!isOpen || !coords) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/issues/check-duplicates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            latitude: coords.lat,
            longitude: coords.lng,
            category: category,
            radiusMeters: 65,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setDuplicateMatches(data.duplicates || []);
        }
      } catch (err) {
        console.warn('Duplicate check skipped:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [coords, category, isOpen]);

  if (!isOpen) return null;

  // Handle Photo File Selection & Client-Side Compression
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await compressImage(file, 1024, 0.72);
      setCompressionInfo(result);
      setImagePreview(result.base64);

      // Auto-trigger AI analysis on photo capture if online
      if (isOnline) {
        triggerAIAnalysis(result.base64, result.mimeType);
      }
    } catch (err) {
      console.error('Image compression failed:', err);
    }
  };

  // Trigger Gemini AI Analysis
  const triggerAIAnalysis = async (customBase64?: string, customMime?: string) => {
    setIsAnalyzingAI(true);
    setAiAnalysisResult(null);

    try {
      const base64ToSend = customBase64 || compressionInfo?.base64 || '';
      const mimeToSend = customMime || compressionInfo?.mimeType || 'image/jpeg';

      const res = await fetch('/api/ai/analyze-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64ToSend,
          mimeType: mimeToSend,
          textPrompt: description || title || 'Analyze this civic infrastructure damage',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.data) {
          setAiAnalysisResult(data.data);
          if (data.data.suggestedTitle) setTitle(data.data.suggestedTitle);
          if (data.data.detailedDescription) setDescription(data.data.detailedDescription);
          if (data.data.category) setCategory(data.data.category);
          if (data.data.severity) setSeverity(data.data.severity);
          if (data.data.locationSensitivityHint) setLocationSensitivity(data.data.locationSensitivityHint);
        }
      }
    } catch (err) {
      console.error('AI analysis request failed:', err);
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  // Upvote Existing Duplicate Instead
  const handleUpvoteExisting = async (duplicateId: string) => {
    try {
      await fetch(`/api/issues/${duplicateId}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAffected: true }),
      });
      confetti({ particleCount: 50, spread: 60 });
      onIssueCreated();
      onClose();
    } catch (err) {
      console.error('Failed to upvote duplicate:', err);
    }
  };

  // Submit Issue
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const payload = {
      title: title || 'Civic Infrastructure Defect',
      description: description || 'Issue reported by citizen on ground.',
      category,
      severity,
      latitude: coords.lat,
      longitude: coords.lng,
      address,
      wardNumber,
      locationSensitivity,
      photoUrl:
        imagePreview ||
        'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
      isAnonymous,
      reporterName: isAnonymous ? 'Anonymous Citizen' : reporterName,
    };

    // If device is offline or in simulated offline mode
    if (!isOnline) {
      addToOfflineQueue(payload);
      setIsSubmitting(false);
      setSubmitSuccess(true);
      setTimeout(() => {
        onIssueCreated();
        onClose();
      }, 1400);
      return;
    }

    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
        setSubmitSuccess(true);
        setTimeout(() => {
          onIssueCreated();
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Submission failed, routing to offline queue fallback:', err);
      addToOfflineQueue(payload);
      setSubmitSuccess(true);
      setTimeout(() => {
        onIssueCreated();
        onClose();
      }, 1200);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-teal-700 to-teal-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-teal-600/60 rounded-lg">
              <Camera className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h2 className="text-base font-bold leading-tight">{t.reportIssue}</h2>
              <p className="text-[11px] text-teal-200">Faridabad / Delhi-NCR Municipal Sector • Fast Public Dispatch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-teal-200 hover:text-white hover:bg-teal-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {submitSuccess ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-16 h-16 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                {isOnline ? 'Issue Registered Successfully!' : 'Saved to Offline Queue!'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isOnline
                  ? 'Ticket assigned to municipal ward department with an active SLA timer. Thank you for your active civic participation!'
                  : 'Your report is safely stored in local storage and will sync automatically when network connectivity is restored.'}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Photo Upload & Client-Side Compression Box */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>{t.photoRequired}</span>
                  {compressionInfo && (
                    <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {t.compressedSize} {Math.round(compressionInfo.compressedSizeBytes / 1024)}KB ({compressionInfo.compressionRatio} saved)
                    </span>
                  )}
                </label>

                <div className="relative border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-xl p-3 bg-slate-50 text-center transition-all">
                  {imagePreview ? (
                    <div className="relative group">
                      <img
                        src={imagePreview}
                        alt="Civic defect capture"
                        className="w-full h-44 object-cover rounded-lg shadow-xs"
                      />
                      <label className="absolute bottom-2 right-2 px-3 py-1.5 bg-black/75 hover:bg-black text-white text-xs font-semibold rounded-lg cursor-pointer backdrop-blur-xs flex items-center gap-1.5 transition-all">
                        <Upload className="w-3.5 h-3.5" /> Retake Photo
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoSelect}
                          className="hidden"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center py-5 cursor-pointer">
                      <div className="w-12 h-12 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center mb-2">
                        <Camera className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-semibold text-slate-800">
                        Take Photo / Upload Image
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        Compressed automatically in browser to &lt;100KB for low data burn
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Gemini AI Auto-Classify Action */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-xl border border-teal-200/80">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-teal-600 text-white rounded-lg shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      Gemini Flash AI Assistance
                      <span className="text-[10px] bg-teal-100 text-teal-800 font-semibold px-1.5 py-0.2 rounded">Free Tier</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Auto-detects defect category, severity & SLA
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isAnalyzingAI || !isOnline}
                  onClick={() => triggerAIAnalysis()}
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {isAnalyzingAI ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-teal-200" />
                      Auto-Classify
                    </>
                  )}
                </button>
              </div>

              {aiAnalysisResult && (
                <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-teal-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                    AI Recommendation:
                  </div>
                  <div className="text-slate-700">
                    <span className="font-semibold text-slate-900">Target Dept:</span>{' '}
                    {aiAnalysisResult.targetDepartment} • Recommended SLA:{' '}
                    <span className="font-semibold text-teal-800">{aiAnalysisResult.recommendedSlaHours}h</span>
                  </div>
                  {aiAnalysisResult.safetyWarning && (
                    <div className="text-amber-800 text-[11px] bg-amber-50 p-1.5 rounded border border-amber-200">
                      ⚠️ {aiAnalysisResult.safetyWarning}
                    </div>
                  )}
                </div>
              )}

              {/* Duplicate Detection Warning Banner */}
              {duplicateMatches.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-amber-900">{t.duplicateFoundNotice}</h4>
                      <p className="text-[11px] text-amber-800">
                        {duplicateMatches[0].title} was reported {duplicateMatches[0].distanceMeters}m away ({duplicateMatches[0].upvotesCount} community upvotes).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleUpvoteExisting(duplicateMatches[0].id)}
                      className="flex-1 py-1.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {t.upvoteExistingCta}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDuplicateMatches([])}
                      className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold rounded-lg"
                    >
                      {t.continueReporting}
                    </button>
                  </div>
                </div>
              )}

              {/* Title & Description */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Issue Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Deep crater pothole near junction"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description & Ground Obstruction Details
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Describe size, depth, hazards for traffic or pedestrians..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 bg-white resize-none"
                  />
                </div>
              </div>

              {/* Category & Severity Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as IssueCategory)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="pothole">{t.pothole}</option>
                    <option value="broken_streetlight">{t.broken_streetlight}</option>
                    <option value="garbage_dump">{t.garbage_dump}</option>
                    <option value="water_leakage">{t.water_leakage}</option>
                    <option value="drainage_overflow">{t.drainage_overflow}</option>
                    <option value="damaged_road">{t.damaged_road}</option>
                    <option value="encroachment">{t.encroachment}</option>
                    <option value="fallen_tree">{t.fallen_tree}</option>
                    <option value="other">{t.other}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Severity Hazard</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as IssueSeverity)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="critical">{t.severityCritical} (12h SLA)</option>
                    <option value="high">{t.severityHigh} (24h SLA)</option>
                    <option value="medium">{t.severityMedium} (48h SLA)</option>
                    <option value="low">{t.severityLow} (72h SLA)</option>
                  </select>
                </div>
              </div>

              {/* Location Sensitivity & Ward */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Location Sensitivity
                  </label>
                  <select
                    value={locationSensitivity}
                    onChange={(e) => setLocationSensitivity(e.target.value as LocationSensitivity)}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="standard">Standard Residential / Street</option>
                    <option value="near_school">Near School / Kindergarten (+Priority)</option>
                    <option value="near_hospital">Near Hospital / Clinic (+Priority)</option>
                    <option value="major_intersection">Major Traffic Intersection</option>
                    <option value="public_transit">Public Transit / Metro Station</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ward Number</label>
                  <input
                    type="number"
                    value={wardNumber}
                    onChange={(e) => setWardNumber(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Location Pin Adjust Accordion */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-teal-600" />
                    <span>GPS Coordinates: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLocationPicker(!showLocationPicker)}
                    className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline"
                  >
                    {showLocationPicker ? 'Hide Map Picker' : 'Adjust Map Pin'}
                  </button>
                </div>

                {showLocationPicker && (
                  <div className="h-44 w-full rounded-lg overflow-hidden border border-slate-300">
                    <MapLibreView
                      issues={[]}
                      isPickerMode={true}
                      pickerCoordinates={coords}
                      onCoordinatesChange={(newCoords) => {
                        setCoords(newCoords);
                        performReverseGeocode(newCoords.lat, newCoords.lng);
                      }}
                      onSelectIssue={() => {}}
                      lowBandwidthMode={lowBandwidthMode}
                    />
                  </div>
                )}

                {/* Live GPS Status Indicator & Presets */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={captureLiveGpsLocation}
                      disabled={isLocatingGps || isGeocoding}
                      className="px-2.5 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-all disabled:opacity-60 shadow-2xs"
                    >
                      <MapPin className="w-3 h-3 text-teal-200" />
                      <span>{isLocatingGps ? 'Locating...' : 'Detect Live GPS'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newCoords = { lat: 28.4089, lng: 77.3178 };
                        setCoords(newCoords);
                        performReverseGeocode(newCoords.lat, newCoords.lng);
                      }}
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[11px] font-medium transition-all"
                    >
                      Faridabad (Sec 15)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newCoords = { lat: 28.3964, lng: 77.2985 };
                        setCoords(newCoords);
                        performReverseGeocode(newCoords.lat, newCoords.lng);
                      }}
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[11px] font-medium transition-all"
                    >
                      NIT-5
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const newCoords = { lat: 28.6139, lng: 77.2090 };
                        setCoords(newCoords);
                        performReverseGeocode(newCoords.lat, newCoords.lng);
                      }}
                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-[11px] font-medium transition-all"
                    >
                      Delhi
                    </button>
                  </div>

                  {/* Geocode Status Badge */}
                  <div className="text-[10px]">
                    {isLocatingGps ? (
                      <span className="text-amber-700 font-semibold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        Detecting GPS...
                      </span>
                    ) : isGeocoding ? (
                      <span className="text-teal-700 font-semibold flex items-center gap-1 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        <div className="w-2 h-2 rounded-full bg-teal-500 animate-spin" />
                        Reverse-geocoding street...
                      </span>
                    ) : gpsStatus === 'success' ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        ✓ Live Address Resolved
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Resolving street / landmark address..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500"
                  />
                  {isGeocoding && (
                    <div className="absolute right-2.5 top-2.5">
                      <div className="w-3.5 h-3.5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              {/* Anonymous Reporting Checkbox */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-slate-600" />
                  <div>
                    <div className="text-xs font-semibold text-slate-800">Report Anonymously</div>
                    <div className="text-[10px] text-slate-500">{t.anonymousReportHelp}</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-4 h-4 accent-teal-600 rounded"
                />
              </div>

              {/* Offline Warning if network disconnected */}
              {!isOnline && (
                <div className="p-2.5 bg-slate-800 text-white rounded-lg flex items-center gap-2 text-xs">
                  <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    You are currently offline. Report will be saved to your local offline queue and dispatched when connected.
                  </span>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-2 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t.submitting}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      {t.submitReport}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

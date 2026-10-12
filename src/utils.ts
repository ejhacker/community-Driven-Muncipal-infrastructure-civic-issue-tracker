/**
 * NagrikPulse Unified Utilities
 * Consolidates Client-Side Image Compression, Offline Queuing,
 * Multi-Language Translations (EN/HI), and Continuous Live GPS Telemetry.
 */

import { OfflineQueuedReport } from './types';

// ============================================================================
// 1. IMAGE COMPRESSOR FOR LOW-BANDWIDTH / 2G-3G NETWORKS
// ============================================================================
export interface CompressionResult {
  base64: string;
  mimeType: string;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: string;
}

export async function compressImage(
  file: File,
  maxDimension = 1024,
  quality = 0.75
): Promise<CompressionResult> {
  const originalSizeBytes = file.size;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to obtain canvas 2D rendering context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        let mimeType = 'image/webp';
        let base64 = canvas.toDataURL('image/webp', quality);

        if (!base64.startsWith('data:image/webp')) {
          mimeType = 'image/jpeg';
          base64 = canvas.toDataURL('image/jpeg', quality);
        }

        const head = base64.indexOf(',') + 1;
        const compressedSizeBytes = Math.round((base64.length - head) * 0.75);
        const ratio = ((1 - compressedSizeBytes / originalSizeBytes) * 100).toFixed(1) + '%';

        resolve({
          base64,
          mimeType,
          originalSizeBytes,
          compressedSizeBytes,
          compressionRatio: ratio,
        });
      };

      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = event.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file buffer'));
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// 2. OFFLINE STORAGE & SYNC QUEUE
// ============================================================================
const STORAGE_KEY = 'nagrikpulse_offline_queue_v1';

export function getOfflineQueue(): OfflineQueuedReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to read offline queue from storage:', err);
    return [];
  }
}

export function addToOfflineQueue(report: Omit<OfflineQueuedReport, 'localId' | 'queuedAt'>): OfflineQueuedReport {
  const queue = getOfflineQueue();
  const queuedItem: OfflineQueuedReport = {
    ...report,
    localId: `offline-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    queuedAt: new Date().toISOString(),
  };

  queue.push(queuedItem);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to save to offline queue:', err);
  }

  window.dispatchEvent(new CustomEvent('nagrikpulse:offline-queue-updated', { detail: { count: queue.length } }));
  return queuedItem;
}

export function removeFromOfflineQueue(localId: string): void {
  const queue = getOfflineQueue().filter((item) => item.localId !== localId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('Failed to update offline queue:', err);
  }
  window.dispatchEvent(new CustomEvent('nagrikpulse:offline-queue-updated', { detail: { count: queue.length } }));
}

export function clearOfflineQueue(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear offline queue:', err);
  }
  window.dispatchEvent(new CustomEvent('nagrikpulse:offline-queue-updated', { detail: { count: 0 } }));
}

export async function syncOfflineReports(): Promise<{ syncedCount: number; failedCount: number }> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return { syncedCount: 0, failedCount: 0 };

  let syncedCount = 0;
  let failedCount = 0;

  for (const item of [...queue]) {
    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          description: item.description,
          category: item.category,
          severity: item.severity,
          latitude: item.latitude,
          longitude: item.longitude,
          address: item.address,
          wardNumber: item.wardNumber,
          locationSensitivity: item.locationSensitivity,
          photoUrl: item.photoUrl,
          isAnonymous: item.isAnonymous,
          reporterName: item.reporterName,
        }),
      });

      if (res.ok) {
        removeFromOfflineQueue(item.localId);
        syncedCount++;
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  return { syncedCount, failedCount };
}

// ============================================================================
// 3. MULTI-LANGUAGE TRANSLATIONS (EN / HI)
// ============================================================================
export type Language = 'en' | 'hi';

export const translations = {
  en: {
    appTitle: 'NagrikPulse',
    appSubtitle: 'Municipal Infrastructure & Civic Issue Tracker',
    reportIssue: 'Report Issue',
    offlineReports: 'Offline Queue',
    syncNow: 'Sync Now',
    issuesList: 'Civic Issues',
    mapView: 'Map View',
    adminDashboard: 'Officer Board',
    transparency: 'Public Stats',
    blueprint: 'System Blueprint',
    lowBandwidth: '2G/Lite Mode',
    allCategories: 'All Categories',
    allStatuses: 'All Statuses',
    allWards: 'All Wards',
    pothole: 'Pothole',
    broken_streetlight: 'Broken Streetlight',
    garbage_dump: 'Garbage Dump',
    water_leakage: 'Water Leakage',
    drainage_overflow: 'Drainage Overflow',
    damaged_road: 'Damaged Road',
    encroachment: 'Encroachment',
    fallen_tree: 'Fallen Tree',
    other: 'Other Issue',
    statusReported: 'Reported',
    statusVerified: 'Verified',
    statusAssigned: 'Assigned',
    statusInProgress: 'In Progress',
    statusResolved: 'Resolved',
    statusReopened: 'Reopened',
    severityCritical: 'Critical',
    severityHigh: 'High',
    severityMedium: 'Medium',
    severityLow: 'Low',
    upvote: 'Upvote',
    affectedToo: "I'm Affected Too",
    daysLeft: 'SLA remaining',
    slaBreached: 'SLA Breached',
    anonymous: 'Anonymous',
    karmaScore: 'Citizen Karma',
    aiAssistButton: 'Auto-Detect with Gemini AI',
    analyzingWithAI: 'Gemini AI analyzing photo & location...',
    duplicateFoundNotice: 'Similar issue already reported nearby!',
    upvoteExistingCta: 'Upvote Existing Issue Instead',
    continueReporting: 'Report Anyway',
    photoRequired: 'Take or Upload Photo',
    compressedSize: 'Compressed for 3G:',
    tapToSelectLocation: 'Tap map to adjust pin position',
    anonymousReportHelp: 'Hide your identity from public ledger',
    submitReport: 'Submit Civic Report',
    submitting: 'Registering Ticket...',
    resolutionRating: 'Rate Resolution Work',
    reopenIssue: 'Issue Not Resolved? Reopen',
  },
  hi: {
    appTitle: 'नागरिक पल्स',
    appSubtitle: 'सामुदायिक नागरिक समस्या व अवसंरचना ट्रैकर',
    reportIssue: 'समस्या दर्ज करें',
    offlineReports: 'ऑफलाइन कतार',
    syncNow: 'अभी सिंक करें',
    issuesList: 'नागरिक समस्याएं',
    mapView: 'मानचित्र दृश्य',
    adminDashboard: 'अधिकारी बोर्ड',
    transparency: 'सार्वजनिक आंकड़े',
    blueprint: 'सिस्टम ब्लूप्रिंट',
    lowBandwidth: 'कम डेटा (2जी मोड)',
    allCategories: 'सभी श्रेणियां',
    allStatuses: 'सभी स्थितियां',
    allWards: 'सभी वार्ड',
    pothole: 'सड़क पर गड्ढा (पॉटहोल)',
    broken_streetlight: 'खराब स्ट्रीटलाइट',
    garbage_dump: 'कचरे का ढेर',
    water_leakage: 'पानी का रिसाव / पाइपलाइन लीकेज',
    drainage_overflow: 'नाली या सीवर ओवरफ्लो',
    damaged_road: 'टूटी सड़क',
    encroachment: 'अवैध अतिक्रमण',
    fallen_tree: 'गिरा हुआ पेड़',
    other: 'अन्य समस्या',
    statusReported: 'दर्ज की गई',
    statusVerified: 'सत्यापित',
    statusAssigned: 'आवंटित',
    statusInProgress: 'प्रगति पर',
    statusResolved: 'समाधान संपन्न',
    statusReopened: 'पुनः खुली',
    severityCritical: 'अत्यंत गंभीर',
    severityHigh: 'गंभीर',
    severityMedium: 'मध्यम',
    severityLow: 'सामान्य',
    upvote: 'समर्थन दें',
    affectedToo: 'मैं भी प्रभावित हूँ',
    daysLeft: 'एस.एल.ए शेष समय',
    slaBreached: 'समय सीमा पार (SLA उल्लंघन)',
    anonymous: 'गुमनाम नागरिक',
    karmaScore: 'नागरिक कर्म अंक',
    aiAssistButton: 'जेमिनी AI से स्वतः जांचें',
    analyzingWithAI: 'जेमिनी AI फोटो और स्थान का विश्लेषण कर रहा है...',
    duplicateFoundNotice: 'समीप में समान समस्या पहले से दर्ज है!',
    upvoteExistingCta: 'मौजूदा समस्या का समर्थन करें',
    continueReporting: 'नई रिपोर्ट दर्ज करें',
    photoRequired: 'फोटो लें या अपलोड करें',
    compressedSize: '3G नेटवर्क हेतु कंप्रेस:',
    tapToSelectLocation: 'सटीक स्थान हेतु मानचित्र पर पिन खिसकाएं',
    anonymousReportHelp: 'सार्वजनिक लेजर में अपना नाम छुपाएं',
    submitReport: 'समस्या जमा करें',
    submitting: 'टिकट दर्ज हो रहा है...',
    resolutionRating: 'कार्य गुणवत्ता का मूल्यांकन करें',
    reopenIssue: 'समस्या ठीक नहीं हुई? पुनः खोलें',
  },
};

// ============================================================================
// 4. LIVE CONTINUOUS GPS TELEMETRY TRACKER & FIELD FORCE RADAR
// ============================================================================
export interface LiveGpsState {
  isTracking: boolean;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  altitudeMeters: number | null;
  speedKmh: number | null;
  headingDegrees: number | null;
  timestamp: string;
  distanceWalkedMeters: number;
  pathHistory: Array<[number, number]>;
  isSimulated: boolean;
  nearestIssueDistanceMeters: number | null;
  nearestIssueTitle: string | null;
}

export type LiveGpsListener = (state: LiveGpsState) => void;

let watchId: number | null = null;
let simulationIntervalId: any = null;
const listeners: Set<LiveGpsListener> = new Set();

let currentState: LiveGpsState = {
  isTracking: false,
  latitude: 28.4089,
  longitude: 77.3178,
  accuracyMeters: 5.0,
  altitudeMeters: null,
  speedKmh: 0,
  headingDegrees: 0,
  timestamp: new Date().toISOString(),
  distanceWalkedMeters: 0,
  pathHistory: [[28.4089, 77.3178]],
  isSimulated: false,
  nearestIssueDistanceMeters: null,
  nearestIssueTitle: null,
};

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function notifyListeners() {
  listeners.forEach((fn) => fn({ ...currentState }));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('nagrikpulse:live-telemetry', { detail: { ...currentState } })
    );
  }
}

export function startLiveGpsTracking(
  onUpdate?: LiveGpsListener,
  knownIssues: Array<{ latitude: number; longitude: number; title: string }> = []
): boolean {
  if (onUpdate) listeners.add(onUpdate);

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    console.warn('Geolocation API not supported in this environment');
    return false;
  }

  stopLiveGpsTracking();

  currentState = {
    ...currentState,
    isTracking: true,
    isSimulated: false,
    timestamp: new Date().toISOString(),
  };
  notifyListeners();

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy, altitude, speed, heading } = pos.coords;

      let incrementalDist = 0;
      if (currentState.pathHistory.length > 0) {
        const last = currentState.pathHistory[currentState.pathHistory.length - 1];
        incrementalDist = calculateDistanceMeters(last[0], last[1], latitude, longitude);
      }

      const newPath = [...currentState.pathHistory];
      let newTotalDist = currentState.distanceWalkedMeters;
      if (incrementalDist > 1.5) {
        newPath.push([latitude, longitude]);
        newTotalDist += incrementalDist;
      }

      let nearestDist: number | null = null;
      let nearestTitle: string | null = null;
      if (knownIssues.length > 0) {
        let minD = Infinity;
        for (const iss of knownIssues) {
          const d = calculateDistanceMeters(latitude, longitude, iss.latitude, iss.longitude);
          if (d < minD) {
            minD = d;
            nearestDist = Math.round(d);
            nearestTitle = iss.title;
          }
        }
      }

      currentState = {
        isTracking: true,
        latitude,
        longitude,
        accuracyMeters: Math.round((accuracy || 5) * 10) / 10,
        altitudeMeters: altitude ? Math.round(altitude * 10) / 10 : null,
        speedKmh: speed ? Math.round(speed * 3.6 * 10) / 10 : 0,
        headingDegrees: heading ? Math.round(heading) : currentState.headingDegrees,
        timestamp: new Date(pos.timestamp).toISOString(),
        distanceWalkedMeters: Math.round(newTotalDist),
        pathHistory: newPath.slice(-50),
        isSimulated: false,
        nearestIssueDistanceMeters: nearestDist,
        nearestIssueTitle: nearestTitle,
      };

      notifyListeners();

      fetch('/api/gps/update-telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy,
          speedKmh: currentState.speedKmh,
          heading: currentState.headingDegrees,
        }),
      }).catch(() => {});
    },
    (err) => {
      console.warn('Live GPS watch position error:', err.message);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10000,
    }
  );

  return true;
}

export function stopLiveGpsTracking(): void {
  if (watchId !== null && typeof navigator !== 'undefined') {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (simulationIntervalId) {
    clearInterval(simulationIntervalId);
    simulationIntervalId = null;
  }

  currentState = {
    ...currentState,
    isTracking: false,
    speedKmh: 0,
  };
  notifyListeners();
}

export function startSimulatedFieldWalk(
  knownIssues: Array<{ latitude: number; longitude: number; title: string }> = []
): void {
  stopLiveGpsTracking();

  const routePoints: Array<[number, number]> = [
    [28.4089, 77.3178],
    [28.4084, 77.3172],
    [28.4078, 77.3165],
    [28.4071, 77.3157],
    [28.4065, 77.3149],
    [28.4058, 77.3141],
    [28.4050, 77.3132],
    [28.4042, 77.3125],
    [28.4032, 77.3118],
    [28.4022, 77.3114],
  ];

  let step = 0;
  currentState = {
    ...currentState,
    isTracking: true,
    isSimulated: true,
    latitude: routePoints[0][0],
    longitude: routePoints[0][1],
    accuracyMeters: 3.2,
    speedKmh: 4.8,
    headingDegrees: 215,
    distanceWalkedMeters: 0,
    pathHistory: [routePoints[0]],
  };
  notifyListeners();

  simulationIntervalId = setInterval(() => {
    step = (step + 1) % routePoints.length;
    const pt = routePoints[step];

    const last = currentState.pathHistory[currentState.pathHistory.length - 1];
    const dist = calculateDistanceMeters(last[0], last[1], pt[0], pt[1]);
    const newPath = [...currentState.pathHistory, pt].slice(-40);

    let nearestDist: number | null = null;
    let nearestTitle: string | null = null;
    if (knownIssues.length > 0) {
      let minD = Infinity;
      for (const iss of knownIssues) {
        const d = calculateDistanceMeters(pt[0], pt[1], iss.latitude, iss.longitude);
        if (d < minD) {
          minD = d;
          nearestDist = Math.round(d);
          nearestTitle = iss.title;
        }
      }
    }

    currentState = {
      isTracking: true,
      latitude: pt[0],
      longitude: pt[1],
      accuracyMeters: 2.8 + Math.random() * 1.5,
      altitudeMeters: 210,
      speedKmh: 4.2 + Math.random() * 1.2,
      headingDegrees: (currentState.headingDegrees! + 10) % 360,
      timestamp: new Date().toISOString(),
      distanceWalkedMeters: currentState.distanceWalkedMeters + Math.round(dist),
      pathHistory: newPath,
      isSimulated: true,
      nearestIssueDistanceMeters: nearestDist,
      nearestIssueTitle: nearestTitle,
    };

    notifyListeners();
  }, 2200);
}

export function getLiveGpsState(): LiveGpsState {
  return { ...currentState };
}

export function subscribeLiveGps(listener: LiveGpsListener): () => void {
  listeners.add(listener);
  listener({ ...currentState });
  return () => listeners.delete(listener);
}

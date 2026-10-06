import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Body parser with 10MB limit for client-compressed base64 images
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ----------------------------------------------------------------------------
// SERVER-SIDE GEMINI API INITIALIZATION & COST GUARDS
// ----------------------------------------------------------------------------
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// In-Memory Cost Guard: Cache (prevents duplicate API calls for similar submissions)
const aiAnalysisCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Rate Limiting Map (Max 12 requests per minute per IP to prevent bill runaway)
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + 60 * 1000 });
    return true;
  }
  if (entry.count >= 12) {
    return false;
  }
  entry.count++;
  return true;
}

// ----------------------------------------------------------------------------
// SEED DATA & IN-MEMORY STORE (Production-mirrored)
// ----------------------------------------------------------------------------
export interface Issue {
  id: string;
  ticketNumber: string;
  reporterId: string;
  reporterName: string;
  reporterKarma: number;
  title: string;
  description: string;
  category: 'pothole' | 'broken_streetlight' | 'garbage_dump' | 'water_leakage' | 'drainage_overflow' | 'damaged_road' | 'encroachment' | 'fallen_tree' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'verified' | 'assigned' | 'in_progress' | 'resolved' | 'reopened';
  latitude: number;
  longitude: number;
  address: string;
  wardNumber: number;
  locationSensitivity: 'standard' | 'near_school' | 'near_hospital' | 'major_intersection' | 'public_transit';
  photoUrl: string;
  resolutionPhotoUrl?: string;
  isAnonymous: boolean;
  priorityScore: number;
  upvotesCount: number;
  affectedCount: number;
  userHasUpvoted?: boolean;
  assignedDept: string;
  assignedOfficerName?: string;
  slaHours: number;
  slaDeadline: string;
  resolvedAt?: string;
  resolutionRating?: number;
  resolutionFeedback?: string;
  createdAt: string;
  updatedAt: string;
  comments: Array<{
    id: string;
    authorName: string;
    isOfficial: boolean;
    message: string;
    createdAt: string;
  }>;
  timeline: Array<{
    id: string;
    actorName: string;
    oldStatus?: string;
    newStatus: string;
    notes: string;
    evidenceUrl?: string;
    createdAt: string;
  }>;
}

const DEPARTMENTS = {
  pothole: 'Roads & Bridges Department',
  damaged_road: 'Roads & Bridges Department',
  broken_streetlight: 'Electrical & Lighting Board',
  garbage_dump: 'Solid Waste Management',
  water_leakage: 'Water Supply & Sewerage Board',
  drainage_overflow: 'Stormwater Drainage Department',
  encroachment: 'Town Planning & Enforcement',
  fallen_tree: 'Horticulture & Parks Wing',
  other: 'General Municipal Administration',
};

const DEFAULT_SLA_HOURS = {
  critical: 12,
  high: 24,
  medium: 48,
  low: 72,
};

// Seed Issues (centered around Delhi-NCR / Faridabad municipal zones)
let issuesDB: Issue[] = [
  {
    id: 'iss-101',
    ticketNumber: 'NP-2026-0842',
    reporterId: 'usr-1',
    reporterName: 'Aarav Sharma',
    reporterKarma: 85,
    title: 'Severe crater pothole near Sector 15 Market Road',
    description: 'Deep 1.5-foot crater exposing underlying gravel right before the pedestrian crossing on Mathura Road service lane. Multiple two-wheelers skidded during rain.',
    category: 'pothole',
    severity: 'critical',
    status: 'assigned',
    latitude: 28.4089,
    longitude: 77.3178,
    address: 'Near Sector 15 Community Market, Mathura Road Service Lane, Faridabad Ward 22',
    wardNumber: 22,
    locationSensitivity: 'near_school',
    photoUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
    isAnonymous: false,
    priorityScore: 78.5,
    upvotesCount: 23,
    affectedCount: 16,
    assignedDept: 'Roads & Bridges Department',
    assignedOfficerName: 'Er. Rajesh Kulkarni (MCF Executive Engg)',
    slaHours: 24,
    slaDeadline: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    comments: [
      {
        id: 'c-1',
        authorName: 'Sunita Menon',
        isOfficial: false,
        message: 'Daily commuters on Mathura Road nearly fell off their two-wheelers. Extremely dangerous at night!',
        createdAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
      },
      {
        id: 'c-2',
        authorName: 'Faridabad MCF Control Room',
        isOfficial: true,
        message: 'Triage officer inspected spot. Work order #4492 issued for rapid asphalt patching by Municipal Corporation of Faridabad.',
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      },
    ],
    timeline: [
      {
        id: 't-1',
        actorName: 'Aarav Sharma (Citizen)',
        newStatus: 'reported',
        notes: 'Civic issue logged via Mobile PWA.',
        createdAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
      },
      {
        id: 't-2',
        actorName: 'Civic Bot AI',
        newStatus: 'verified',
        notes: 'AI verified photo: High-severity road crater near institutional zone.',
        createdAt: new Date(Date.now() - 17 * 3600 * 1000).toISOString(),
      },
      {
        id: 't-3',
        actorName: 'MCF Divisional Engineer',
        oldStatus: 'verified',
        newStatus: 'assigned',
        notes: 'Assigned to field team for rapid road resurfacing.',
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'iss-102',
    ticketNumber: 'NP-2026-0819',
    reporterId: 'usr-2',
    reporterName: 'Priya Narayanan',
    reporterKarma: 110,
    title: 'Overflowing community garbage dumpster near NIT-5 Market',
    description: 'Uncollected domestic solid waste spilling onto the pedestrian sidewalk for the past 4 days. Strong odor and blocked drainage channel.',
    category: 'garbage_dump',
    severity: 'high',
    status: 'in_progress',
    latitude: 28.3964,
    longitude: 77.2985,
    address: 'Near Main Chowk, NIT-5 Commercial Market, Faridabad Ward 18',
    wardNumber: 18,
    locationSensitivity: 'standard',
    photoUrl: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80',
    isAnonymous: false,
    priorityScore: 64.2,
    upvotesCount: 18,
    affectedCount: 14,
    assignedDept: 'Solid Waste Management',
    assignedOfficerName: 'Sanitary Inspector Manjunath G.',
    slaHours: 24,
    slaDeadline: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    comments: [
      {
        id: 'c-3',
        authorName: 'Inspector Manjunath G.',
        isOfficial: true,
        message: 'Compactor vehicle #HR-38-E-4412 dispatched on route. Clearing currently under way.',
        createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      },
    ],
    timeline: [
      {
        id: 't-4',
        actorName: 'Priya Narayanan',
        newStatus: 'reported',
        notes: 'Logged with geo-tagged photo.',
        createdAt: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
      },
      {
        id: 't-5',
        actorName: 'Zonal Supervisor',
        newStatus: 'in_progress',
        notes: 'Compactor truck deployed to clear backlog.',
        createdAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'iss-103',
    ticketNumber: 'NP-2026-0750',
    reporterId: 'usr-3',
    reporterName: 'Anonymous Citizen',
    reporterKarma: 40,
    title: 'High-pressure potable water pipeline burst flooding roadway',
    description: 'Clean drinking water gushing under high pressure from main pipeline collar. Water levels knee-deep on Badarpur-Faridabad border link road.',
    category: 'water_leakage',
    severity: 'critical',
    status: 'resolved',
    latitude: 28.4986,
    longitude: 77.3021,
    address: 'Near Badarpur Metro Station / Faridabad Link Road, Ward 12',
    wardNumber: 12,
    locationSensitivity: 'near_hospital',
    photoUrl: 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?auto=format&fit=crop&w=800&q=80',
    resolutionPhotoUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?auto=format&fit=crop&w=800&q=80',
    isAnonymous: true,
    priorityScore: 89.0,
    upvotesCount: 42,
    affectedCount: 38,
    assignedDept: 'Water Supply & Sewerage Board',
    assignedOfficerName: 'Er. Sandeep Verma',
    slaHours: 12,
    slaDeadline: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    resolutionRating: 5,
    resolutionFeedback: 'Resolved within 4 hours before morning office rush. Excellent prompt action!',
    createdAt: new Date(Date.now() - 16 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    comments: [
      {
        id: 'c-4',
        authorName: 'Er. Sandeep Verma',
        isOfficial: true,
        message: 'Valve isolated, collar welded, backfill completed, and pressure restored. Verified leak-free.',
        createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      },
    ],
    timeline: [
      {
        id: 't-6',
        actorName: 'Anonymous Citizen',
        newStatus: 'reported',
        notes: 'Critical pipeline burst alert.',
        createdAt: new Date(Date.now() - 16 * 3600 * 1000).toISOString(),
      },
      {
        id: 't-7',
        actorName: 'Emergency Response Unit',
        newStatus: 'resolved',
        notes: 'Line repaired and road reopened.',
        evidenceUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb1861593?auto=format&fit=crop&w=800&q=80',
        createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      },
    ],
  },
  {
    id: 'iss-104',
    ticketNumber: 'NP-2026-0865',
    reporterId: 'usr-4',
    reporterName: 'Vikram Joshi',
    reporterKarma: 65,
    title: 'Broken streetlight bracket causing pitch dark stretch near Town Park',
    description: 'Streetlight pole #FBD-22-108 bracket snapped during storm. Entire residential pedestrian stretch unlit.',
    category: 'broken_streetlight',
    severity: 'medium',
    status: 'reported',
    latitude: 28.4022,
    longitude: 77.3114,
    address: 'Near Sector 12 Town Park Road, Faridabad Ward 22',
    wardNumber: 22,
    locationSensitivity: 'standard',
    photoUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?auto=format&fit=crop&w=800&q=80',
    isAnonymous: false,
    priorityScore: 32.0,
    upvotesCount: 7,
    affectedCount: 5,
    assignedDept: 'Electrical & Lighting Board',
    slaHours: 48,
    slaDeadline: new Date(Date.now() + 42 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    comments: [],
    timeline: [
      {
        id: 't-8',
        actorName: 'Vikram Joshi',
        newStatus: 'reported',
        notes: 'Citizen complaint logged.',
        createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      },
    ],
  },
];

// Helper: Haversine distance in meters
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// ----------------------------------------------------------------------------
// API ROUTES
// ----------------------------------------------------------------------------

// 1. Gemini AI Civic Issue Analysis with Cost Guards
app.post('/api/ai/analyze-issue', async (req: Request, res: Response): Promise<void> => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  if (!checkRateLimit(clientIp)) {
    res.status(429).json({
      error: 'Rate limit exceeded: Max 12 AI analyses per minute to conserve municipal server resources.',
    });
    return;
  }

  const { imageBase64, mimeType = 'image/jpeg', textPrompt = '' } = req.body;

  // Create hash for caching
  const hashKey = crypto
    .createHash('sha256')
    .update((textPrompt || '') + (imageBase64 ? imageBase64.slice(0, 500) : ''))
    .digest('hex');

  // Check in-memory cost guard cache
  const cached = aiAnalysisCache.get(hashKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    res.json({ ...cached.data, cached: true });
    return;
  }

  // If Gemini API is configured
  if (aiClient) {
    try {
      const parts: any[] = [];

      if (imageBase64) {
        // Strip data:image/...;base64, prefix if included
        const cleanBase64 = imageBase64.includes('base64,')
          ? imageBase64.split('base64,')[1]
          : imageBase64;

        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: cleanBase64,
          },
        });
      }

      const promptDirective = `Analyze this municipal/civic issue image or citizen report: "${textPrompt}".
Classify strictly for municipal dispatch into the required schema:
- category: one of ["pothole", "broken_streetlight", "garbage_dump", "water_leakage", "drainage_overflow", "damaged_road", "encroachment", "fallen_tree", "other"]
- severity: one of ["low", "medium", "high", "critical"] based on pedestrian/traffic hazard, public health, or structural threat
- suggestedTitle: concise, professional title (under 12 words)
- detailedDescription: actionable civic summary describing the obstruction or defect
- targetDepartment: the responsible municipal body
- recommendedSlaHours: integer hours (12 for critical hazards, 24 for high, 48 for medium, 72 for low)
- locationSensitivityHint: one of ["standard", "near_school", "near_hospital", "major_intersection", "public_transit"] if implied by landmarks
- safetyWarning: immediate safety precaution for passing citizens`;

      parts.push({ text: promptDirective });

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: { parts },
        config: {
          systemInstruction:
            'You are NagrikPulse AI, an expert municipal triage engineer evaluating civic infrastructure hazards. Return clean, accurate JSON adhering strictly to the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: 'Issue category from predefined list',
              },
              severity: {
                type: Type.STRING,
                description: 'Hazard severity level',
              },
              suggestedTitle: {
                type: Type.STRING,
                description: 'Clear, concise headline',
              },
              detailedDescription: {
                type: Type.STRING,
                description: 'Objective description of the infrastructure defect',
              },
              targetDepartment: {
                type: Type.STRING,
                description: 'Department responsible',
              },
              recommendedSlaHours: {
                type: Type.INTEGER,
                description: 'SLA deadline hours',
              },
              locationSensitivityHint: {
                type: Type.STRING,
                description: 'Sensitivity category',
              },
              safetyWarning: {
                type: Type.STRING,
                description: 'Brief safety precaution',
              },
            },
            required: [
              'category',
              'severity',
              'suggestedTitle',
              'detailedDescription',
              'targetDepartment',
              'recommendedSlaHours',
            ],
          },
        },
      });

      const responseText = response.text;
      if (responseText) {
        const parsed = JSON.parse(responseText.trim());
        const result = {
          success: true,
          data: parsed,
          cached: false,
        };
        aiAnalysisCache.set(hashKey, { data: result, timestamp: Date.now() });
        res.json(result);
        return;
      }
    } catch (err: any) {
      console.warn('Gemini AI inference warning, falling back to smart heuristics:', err.message);
    }
  }

  // Smart Heuristic Fallback (Runs if no key or offline)
  const lower = (textPrompt || '').toLowerCase();
  let category: Issue['category'] = 'other';
  let severity: Issue['severity'] = 'medium';
  let suggestedTitle = 'Civic infrastructure defect reported';
  let targetDepartment = 'General Municipal Administration';
  let sla = 48;
  let safety = 'Exercise caution in the vicinity.';

  if (lower.includes('pothole') || lower.includes('crater') || lower.includes('road')) {
    category = 'pothole';
    severity = 'high';
    suggestedTitle = 'Road surface damage & pothole hazard';
    targetDepartment = DEPARTMENTS.pothole;
    sla = 24;
    safety = 'Slow down vehicles; severe risk of tyre burst or skidding.';
  } else if (lower.includes('light') || lower.includes('lamp') || lower.includes('dark')) {
    category = 'broken_streetlight';
    severity = 'medium';
    suggestedTitle = 'Malfunctioning public streetlight';
    targetDepartment = DEPARTMENTS.broken_streetlight;
    sla = 48;
    safety = 'Dim lighting hazard during evening pedestrian transit.';
  } else if (lower.includes('garbage') || lower.includes('trash') || lower.includes('waste')) {
    category = 'garbage_dump';
    severity = 'high';
    suggestedTitle = 'Accumulated unsegregated waste dump';
    targetDepartment = DEPARTMENTS.garbage_dump;
    sla = 24;
    safety = 'Health hazard; please avoid contact with stagnant runoff.';
  } else if (lower.includes('water') || lower.includes('leak') || lower.includes('pipe')) {
    category = 'water_leakage';
    severity = 'critical';
    suggestedTitle = 'Main potable water distribution line breach';
    targetDepartment = DEPARTMENTS.water_leakage;
    sla = 12;
    safety = 'Potential waterlogging and supply interruption.';
  } else if (lower.includes('drain') || lower.includes('sewer') || lower.includes('gutter')) {
    category = 'drainage_overflow';
    severity = 'high';
    suggestedTitle = 'Stormwater drain blockage and overflow';
    targetDepartment = DEPARTMENTS.drainage_overflow;
    sla = 24;
    safety = 'Biohazard risk and road inundation.';
  }

  const fallbackData = {
    success: true,
    data: {
      category,
      severity,
      suggestedTitle,
      detailedDescription: textPrompt
        ? `Field report: ${textPrompt}. Verified by municipal rule engine.`
        : 'Civic obstruction requiring municipal verification and field crew assignment.',
      targetDepartment,
      recommendedSlaHours: sla,
      locationSensitivityHint: 'standard',
      safetyWarning: safety,
    },
    cached: false,
    engine: 'heuristic-rule-engine',
  };

  aiAnalysisCache.set(hashKey, { data: fallbackData, timestamp: Date.now() });
  res.json(fallbackData);
});

// 2. Reverse Geocoding API with In-Memory Caching & Nominatim OSM Integration
const reverseGeocodeCache = new Map<string, { address: string; details: any; wardNumber: number }>();

app.get('/api/geo/reverse-geocode', async (req: Request, res: Response): Promise<void> => {
  const latStr = req.query.lat as string;
  const lngStr = req.query.lng as string;

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: 'Valid numeric latitude and longitude required' });
    return;
  }

  const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
  if (reverseGeocodeCache.has(cacheKey)) {
    const cached = reverseGeocodeCache.get(cacheKey)!;
    res.json({ success: true, ...cached, cached: true });
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'NagrikPulse-Civic-App/1.0 (civicops@nagrikpulse.gov.in)',
        'Accept-Language': 'en,hi',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.address) {
        const addr = data.address;
        const parts: string[] = [];

        // Street level
        if (addr.road || addr.street || addr.pedestrian) {
          parts.push(addr.road || addr.street || addr.pedestrian);
        } else if (data.name) {
          parts.push(data.name);
        }

        // Neighborhood / Sector level
        if (addr.suburb || addr.neighbourhood || addr.residential || addr.subdistrict) {
          parts.push(addr.suburb || addr.neighbourhood || addr.residential || addr.subdistrict);
        }

        // City / District level
        if (addr.city || addr.town || addr.municipality || addr.city_district) {
          parts.push(addr.city || addr.town || addr.municipality || addr.city_district);
        } else if (addr.state_district) {
          parts.push(addr.state_district);
        }

        // State & Postcode
        if (addr.state) parts.push(addr.state);
        if (addr.postcode) parts.push(addr.postcode);

        const cleanAddress = parts.length > 0 ? parts.join(', ') : data.display_name;
        
        // Approximate ward number from postcode or coordinate
        const wardNumber = addr.postcode ? (parseInt(addr.postcode.slice(-2), 10) || 22) : 22;

        const result = {
          address: cleanAddress,
          details: addr,
          wardNumber: wardNumber,
        };

        reverseGeocodeCache.set(cacheKey, result);
        res.json({ success: true, ...result, cached: false });
        return;
      }
    }
  } catch (err: any) {
    console.warn('Nominatim reverse-geocode request error:', err.message);
  }

  // Graceful fallback if offline or Nominatim busy
  let fallbackCity = 'Faridabad';
  let fallbackWard = 22;
  if (lat > 28.5) {
    fallbackCity = 'Delhi';
    fallbackWard = 12;
  }

  const fallbackResult = {
    address: `Near Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)} (${fallbackCity} Municipal Sector)`,
    details: { lat, lng, city: fallbackCity },
    wardNumber: fallbackWard,
  };

  reverseGeocodeCache.set(cacheKey, fallbackResult);
  res.json({ success: true, ...fallbackResult, cached: false, fallback: true });
});

// 3. Duplicate Detection (PostGIS logic mirrored in Node/SQL)
app.post('/api/issues/check-duplicates', (req: Request, res: Response) => {
  const { latitude, longitude, category, radiusMeters = 65 } = req.body;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    res.status(400).json({ error: 'Valid latitude and longitude required' });
    return;
  }

  const duplicates = issuesDB
    .filter((issue) => issue.status !== 'resolved')
    .map((issue) => {
      const distance = getHaversineDistance(latitude, longitude, issue.latitude, issue.longitude);
      const isCategoryMatch = !category || issue.category === category;
      return {
        ...issue,
        distanceMeters: Math.round(distance),
        isCategoryMatch,
      };
    })
    .filter((item) => item.distanceMeters <= radiusMeters && item.isCategoryMatch)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 5);

  res.json({
    found: duplicates.length > 0,
    count: duplicates.length,
    radiusMeters,
    duplicates,
  });
});

// 3. List Issues with Filters
app.get('/api/issues', (req: Request, res: Response) => {
  const {
    category,
    status,
    ward,
    search,
    sortBy = 'priority', // 'priority' | 'newest' | 'upvotes' | 'sla'
  } = req.query;

  let filtered = [...issuesDB];

  if (category && category !== 'all') {
    filtered = filtered.filter((i) => i.category === category);
  }

  if (status && status !== 'all') {
    filtered = filtered.filter((i) => i.status === status);
  }

  if (ward && ward !== 'all') {
    filtered = filtered.filter((i) => i.wardNumber === parseInt(ward as string, 10));
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.ticketNumber.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.address.toLowerCase().includes(q)
    );
  }

  if (sortBy === 'priority') {
    filtered.sort((a, b) => b.priorityScore - a.priorityScore);
  } else if (sortBy === 'newest') {
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (sortBy === 'upvotes') {
    filtered.sort((a, b) => b.upvotesCount - a.upvotesCount);
  } else if (sortBy === 'sla') {
    filtered.sort((a, b) => new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime());
  }

  res.json({ issues: filtered, total: filtered.length });
});

// 4. Get Issue by ID
app.get('/api/issues/:id', (req: Request, res: Response) => {
  const issue = issuesDB.find((i) => i.id === req.params.id);
  if (!issue) {
    res.status(404).json({ error: 'Issue not found' });
    return;
  }
  res.json(issue);
});

// 5. Create New Issue
app.post('/api/issues', (req: Request, res: Response) => {
  const {
    title,
    description,
    category,
    severity = 'medium',
    latitude,
    longitude,
    address,
    wardNumber = 142,
    locationSensitivity = 'standard',
    photoUrl,
    isAnonymous = false,
    reporterName = 'Citizen Reporter',
  } = req.body;

  if (!title || !description || !category || typeof latitude !== 'number' || typeof longitude !== 'number') {
    res.status(400).json({ error: 'Missing mandatory issue reporting parameters' });
    return;
  }

  const slaHours = DEFAULT_SLA_HOURS[severity as keyof typeof DEFAULT_SLA_HOURS] || 48;
  const slaDeadline = new Date(Date.now() + slaHours * 3600 * 1000).toISOString();

  // Priority algorithm = upvotes * 3.5 + severityWeight + sensitivityWeight
  const sevWeight = severity === 'critical' ? 45 : severity === 'high' ? 30 : severity === 'medium' ? 18 : 8;
  const sensWeight =
    locationSensitivity === 'near_hospital'
      ? 35
      : locationSensitivity === 'near_school'
      ? 30
      : locationSensitivity === 'major_intersection'
      ? 25
      : 0;
  const priorityScore = Math.round((1 * 3.5 + sevWeight + sensWeight) * 10) / 10;

  const ticketNumber = `NP-2026-${Math.floor(1000 + Math.random() * 9000)}`;

  const newIssue: Issue = {
    id: `iss-${Date.now()}`,
    ticketNumber,
    reporterId: `usr-${Date.now()}`,
    reporterName: isAnonymous ? 'Anonymous Citizen' : reporterName,
    reporterKarma: 50,
    title,
    description,
    category,
    severity,
    status: 'reported',
    latitude,
    longitude,
    address: address || `Ward ${wardNumber}, Municipal Zone`,
    wardNumber: parseInt(wardNumber, 10) || 142,
    locationSensitivity,
    photoUrl: photoUrl || 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=800&q=80',
    isAnonymous,
    priorityScore,
    upvotesCount: 1,
    affectedCount: 1,
    assignedDept: DEPARTMENTS[category as keyof typeof DEPARTMENTS] || 'General Municipal Administration',
    slaHours,
    slaDeadline,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    comments: [],
    timeline: [
      {
        id: `t-${Date.now()}`,
        actorName: isAnonymous ? 'Anonymous Citizen' : reporterName,
        newStatus: 'reported',
        notes: 'Ticket registered into the municipal public ledger.',
        createdAt: new Date().toISOString(),
      },
    ],
  };

  issuesDB.unshift(newIssue);
  res.status(201).json({ success: true, issue: newIssue });
});

// 6. Upvote / "I'm Affected Too"
app.post('/api/issues/:id/upvote', (req: Request, res: Response) => {
  const issue = issuesDB.find((i) => i.id === req.params.id);
  if (!issue) {
    res.status(404).json({ error: 'Issue not found' });
    return;
  }

  const { isAffected = false } = req.body;

  if (issue.userHasUpvoted) {
    issue.upvotesCount = Math.max(1, issue.upvotesCount - 1);
    if (isAffected) {
      issue.affectedCount = Math.max(1, issue.affectedCount - 1);
    }
    issue.userHasUpvoted = false;
    issue.priorityScore = Math.max(5, issue.priorityScore - 3.5);
  } else {
    issue.upvotesCount += 1;
    if (isAffected) {
      issue.affectedCount += 1;
    }
    issue.userHasUpvoted = true;
    issue.priorityScore += 3.5;
  }

  issue.updatedAt = new Date().toISOString();
  res.json({
    success: true,
    upvotesCount: issue.upvotesCount,
    affectedCount: issue.affectedCount,
    userHasUpvoted: issue.userHasUpvoted,
    priorityScore: issue.priorityScore,
  });
});

// 7. Add Comment
app.post('/api/issues/:id/comment', (req: Request, res: Response) => {
  const issue = issuesDB.find((i) => i.id === req.params.id);
  if (!issue) {
    res.status(404).json({ error: 'Issue not found' });
    return;
  }

  const { authorName = 'Citizen', message, isOfficial = false } = req.body;
  if (!message || message.trim() === '') {
    res.status(400).json({ error: 'Message cannot be empty' });
    return;
  }

  const newComment = {
    id: `c-${Date.now()}`,
    authorName,
    isOfficial,
    message: message.trim(),
    createdAt: new Date().toISOString(),
  };

  issue.comments.push(newComment);
  issue.updatedAt = new Date().toISOString();
  res.json({ success: true, comment: newComment });
});

// 8. Officer/Admin Status Update & SLA Triage
app.post('/api/issues/:id/status', (req: Request, res: Response) => {
  const issue = issuesDB.find((i) => i.id === req.params.id);
  if (!issue) {
    res.status(404).json({ error: 'Issue not found' });
    return;
  }

  const {
    newStatus,
    officerName = 'Field Officer',
    assignedDept,
    notes = '',
    resolutionPhotoUrl,
  } = req.body;

  const validStatuses = ['reported', 'verified', 'assigned', 'in_progress', 'resolved', 'reopened'];
  if (!validStatuses.includes(newStatus)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  const oldStatus = issue.status;
  issue.status = newStatus;
  if (assignedDept) issue.assignedDept = assignedDept;
  if (resolutionPhotoUrl) issue.resolutionPhotoUrl = resolutionPhotoUrl;

  if (newStatus === 'resolved') {
    issue.resolvedAt = new Date().toISOString();
  }

  issue.timeline.push({
    id: `t-${Date.now()}`,
    actorName: officerName,
    oldStatus,
    newStatus,
    notes: notes || `Status changed from ${oldStatus} to ${newStatus}`,
    evidenceUrl: resolutionPhotoUrl,
    createdAt: new Date().toISOString(),
  });

  issue.updatedAt = new Date().toISOString();
  res.json({ success: true, issue });
});

// 9. Citizen Resolution Rating & Reopen
app.post('/api/issues/:id/rate-resolution', (req: Request, res: Response) => {
  const issue = issuesDB.find((i) => i.id === req.params.id);
  if (!issue) {
    res.status(404).json({ error: 'Issue not found' });
    return;
  }

  const { rating, feedback, reopen = false, citizenName = 'Citizen Reporter' } = req.body;

  if (reopen) {
    issue.status = 'reopened';
    issue.priorityScore += 25; // Boost reopened issue priority
    issue.timeline.push({
      id: `t-${Date.now()}`,
      actorName: citizenName,
      oldStatus: 'resolved',
      newStatus: 'reopened',
      notes: `Citizen reopened issue: "${feedback || 'Issue was not properly fixed on ground'}"`,
      createdAt: new Date().toISOString(),
    });
  } else {
    issue.resolutionRating = rating;
    issue.resolutionFeedback = feedback;
  }

  issue.updatedAt = new Date().toISOString();
  res.json({ success: true, issue });
});

// 10. Public Analytics & Transparency Stats
app.get('/api/stats', (_req: Request, res: Response) => {
  const total = issuesDB.length;
  const resolved = issuesDB.filter((i) => i.status === 'resolved').length;
  const inProgress = issuesDB.filter((i) => i.status === 'in_progress' || i.status === 'assigned').length;
  const reported = issuesDB.filter((i) => i.status === 'reported' || i.status === 'verified').length;
  const now = Date.now();
  const slaBreached = issuesDB.filter(
    (i) => i.status !== 'resolved' && new Date(i.slaDeadline).getTime() < now
  ).length;

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  issuesDB.forEach((i) => {
    categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1;
  });

  // Ward breakdown
  const wardCounts: Record<number, number> = {};
  issuesDB.forEach((i) => {
    wardCounts[i.wardNumber] = (wardCounts[i.wardNumber] || 0) + 1;
  });

  res.json({
    total,
    resolved,
    inProgress,
    reported,
    slaBreached,
    resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    avgResolutionHours: 18.4,
    categoryCounts,
    wardCounts,
    topReporters: [
      { name: 'Priya Narayanan', karma: 110, verifiedReports: 14, badge: 'Civic Guardian' },
      { name: 'Aarav Sharma', karma: 85, verifiedReports: 9, badge: 'Ward Inspector' },
      { name: 'Vikram Joshi', karma: 65, verifiedReports: 6, badge: 'Active Citizen' },
      { name: 'Ananya Deshmukh', karma: 50, verifiedReports: 4, badge: 'Contributor' },
    ],
  });
});

// ----------------------------------------------------------------------------
// VITE MIDDLEWARE SETUP FOR LOCAL DEV & PRODUCTION SPA SERVING
// ----------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Dynamic import vite for dev server middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static dist folder in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NagrikPulse Civic Tracker server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();

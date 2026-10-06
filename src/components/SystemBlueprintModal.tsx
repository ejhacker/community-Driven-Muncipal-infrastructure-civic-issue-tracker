import React, { useState } from 'react';
import {
  X,
  BookOpen,
  DollarSign,
  Database,
  Cpu,
  Layers,
  Terminal,
  CheckCircle2,
  FileCode,
  Milestone,
  Copy,
} from 'lucide-react';

interface SystemBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemBlueprintModal: React.FC<SystemBlueprintModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<
    'arch' | 'cost' | 'schema' | 'gemini' | 'deploy' | 'testing' | 'roadmap'
  >('arch');
  const [copied, setCopied] = useState(false);

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
              <p className="text-[11px] text-teal-300">Deliverables 1-9: Architecture, PostGIS SQL, Cost Model & Roadmap</p>
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
            <Layers className="w-3.5 h-3.5" /> 1. Architecture
          </button>
          <button
            onClick={() => setActiveTab('cost')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'cost' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" /> 2. Cost Breakdown
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'schema' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" /> 3. PostGIS Schema
          </button>
          <button
            onClick={() => setActiveTab('gemini')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'gemini' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" /> 6. Gemini Cost Guards
          </button>
          <button
            onClick={() => setActiveTab('deploy')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'deploy' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" /> 7. Deploy Guide
          </button>
          <button
            onClick={() => setActiveTab('testing')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'testing' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> 8. Test & CI Plan
          </button>
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'roadmap' ? 'bg-teal-700 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Milestone className="w-3.5 h-3.5" /> 9. Roadmap
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs leading-relaxed text-slate-700">
          {activeTab === 'arch' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                1. System Architecture & Tech Stack Justifications
              </h3>

              <div className="p-3 bg-slate-900 text-teal-300 font-mono text-[11px] rounded-xl overflow-x-auto">
                <pre>{`flowchart TD
    subgraph Client ["Client Layer (Mobile-First PWA)"]
        A[Citizen Device / Field Officer] --> B[Service Worker & Offline Cache]
        B --> C[HTML5 Canvas Image Compressor <100KB]
        C --> D[MapLibre GL + OSM Raster Tiles]
        D --> E[Offline Sync Queue]
    end

    subgraph Edge ["Edge / CDN & Hosting"]
        E -->|HTTPS REST| F[Vercel / Cloudflare Pages / Node Server]
    end

    subgraph Backend ["Municipal Backend & AI Services"]
        F --> G[Gemini 3.8 Flash AI Model]
        F --> H[PostgreSQL + PostGIS Database]
        F --> I[Web Push & Resend Email]
    end

    subgraph PostGIS ["Spatial Intelligence Engine"]
        H --> J[ST_DWithin 65m Duplicate Detection]
        H --> K[GIST Spatial Index on Coordinates]
        H --> L[Row Level Security & Role RBAC]
    end`}</pre>
              </div>

              <div className="space-y-2 pt-2">
                <h4 className="font-bold text-slate-800">Stack Justifications vs Alternatives:</h4>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>
                    <span className="font-semibold text-slate-900">Frontend (Next.js / Vite PWA):</span>{' '}
                    Provides instant client-side rendering with offline queue capability and zero app store barrier for low-end Android phones vs native Kotlin/Flutter.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-900">Database (Supabase PostgreSQL + PostGIS):</span>{' '}
                    Industry gold-standard for geo-queries (ST_DWithin, ST_Distance, GIST spatial index) with built-in RLS policies; eliminates separate geo-database costs vs Mongo/DynamoDB.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-900">Maps (MapLibre GL + OpenStreetMap):</span>{' '}
                    $0/month tile hosting with zero Google Maps billing spikes ($5-$7 per 1,000 loads avoided).
                  </li>
                  <li>
                    <span className="font-semibold text-slate-900">AI (Gemini 3.8 Flash):</span>{' '}
                    Lowest cost per million tokens with fast multimodal inference for civic defect triage.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-900">Image Compression (Client HTML5 Canvas):</span>{' '}
                    Compresses 12MP (4MB) mobile camera shots into ~60KB WebP before upload, saving 98% cellular network data on 3G/4G connections.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'cost' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                2. Comprehensive Cost Breakdown & Free-Tier Capacity Model
              </h3>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[11px] font-bold text-slate-700">
                      <th className="p-2.5 border-b">Component</th>
                      <th className="p-2.5 border-b">Free Tier Limit</th>
                      <th className="p-2.5 border-b">1K MAU Cost</th>
                      <th className="p-2.5 border-b">10K MAU Cost</th>
                      <th className="p-2.5 border-b">100K MAU Cost</th>
                      <th className="p-2.5 border-b">Point It Starts Costing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2.5 font-semibold text-slate-800">Supabase (PostgreSQL + PostGIS)</td>
                      <td className="p-2.5">500MB DB, 50K MAU Auth</td>
                      <td className="p-2.5 text-emerald-700 font-bold">$0</td>
                      <td className="p-2.5 text-emerald-700 font-bold">$0</td>
                      <td className="p-2.5 text-slate-800 font-bold">$25/mo (Pro Tier)</td>
                      <td className="p-2.5 text-slate-500">&gt;500MB DB or &gt;50K auth MAU</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-slate-800">MapLibre + OSM Tiles</td>
                      <td className="p-2.5">Unlimited OpenStreetMap CDN</td>
                      <td className="p-2.5 text-emerald-700 font-bold">$0</td>
                      <td className="p-2.5 text-emerald-700 font-bold">$0</td>
                      <td className="p-2.5 text-slate-800 font-bold">$0 (or $20 self-hosted PMTiles)</td>
                      <td className="p-2.5 text-slate-500">Free forever with OSM tile usage policy</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-slate-800">Gemini 3.8 Flash AI</td>
                      <td className="p-2.5">15 RPM free tier</td>
                      <td className="p-2.5 text-emerald-700 font-bold">$0</td>
                      <td className="p-2.5 text-emerald-700 font-bold">$0.80/mo</td>
                      <td className="p-2.5 text-slate-800 font-bold">$8.50/mo</td>
                      <td className="p-2.5 text-slate-500">&gt;15 RPM or &gt;1M free tokens</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-slate-800">Media Storage (Cloudflare R2)</td>
                      <td className="p-2.5">10GB storage, zero egress fees</td>
                      <td className="p-2.5 text-emerald-700 font-bold">$0</td>
                      <td className="p-2.5 text-emerald-700 font-bold">$0</td>
                      <td className="p-2.5 text-slate-800 font-bold">$1.50/mo</td>
                      <td className="p-2.5 text-slate-500">&gt;10GB total images stored</td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-semibold text-slate-800">Resend & Web Push</td>
                      <td className="p-2.5">3,000 emails/mo, Web Push 100% Free</td>
                      <td className="p-2.5 text-emerald-700 font-bold">$0</td>
                      <td className="p-2.5 text-emerald-700 font-bold">$0</td>
                      <td className="p-2.5 text-slate-800 font-bold">$20/mo</td>
                      <td className="p-2.5 text-slate-500">&gt;100 emails/day</td>
                    </tr>
                    <tr className="bg-teal-50/60 font-bold text-slate-900">
                      <td className="p-2.5">TOTAL ESTIMATED BURN</td>
                      <td className="p-2.5">-</td>
                      <td className="p-2.5 text-emerald-700">$0 / month</td>
                      <td className="p-2.5 text-emerald-700">$0.80 / month</td>
                      <td className="p-2.5 text-slate-900">~$55.00 / month</td>
                      <td className="p-2.5 text-teal-800">Scale-to-zero when idle!</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <span className="font-bold text-amber-900">What to Optimize First:</span>{' '}
                <span className="text-amber-800">
                  Image storage footprint and Gemini API duplicate calls. By using client-side WebP compression (saving 95% bytes) and in-memory caching of AI classification for similar text/photos, total media storage and AI spend stays below $10/month even at 30K MAU.
                </span>
              </div>
            </div>
          )}

          {activeTab === 'schema' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                3. Production PostGIS SQL Migration & RLS Security
              </h3>
              <p>
                Stored in <code>supabase/migrations/20261005_civic_pulse_postgis_schema.sql</code>. Key excerpts:
              </p>

              <div className="p-3 bg-slate-900 text-teal-300 font-mono text-[11px] rounded-xl overflow-x-auto max-h-72">
                <pre>{`-- PostGIS Duplicate Detection Function (65 meter radius)
CREATE OR REPLACE FUNCTION public.check_duplicate_issues(
    p_lat DOUBLE PRECISION,
    p_lng DOUBLE PRECISION,
    p_category issue_category,
    p_radius_meters DOUBLE PRECISION DEFAULT 65.0
)
RETURNS TABLE (
    id UUID, ticket_number TEXT, title VARCHAR,
    distance_meters DOUBLE PRECISION, status issue_status, upvotes_count INTEGER
) LANGUAGE plpgsql STABLE AS $$
BEGIN
    RETURN QUERY
    SELECT i.id, i.ticket_number, i.title,
           ST_Distance(i.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) AS distance_meters,
           i.status, i.upvotes_count
    FROM public.issues i
    WHERE i.category = p_category AND i.status != 'resolved'
      AND ST_DWithin(i.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, p_radius_meters)
    ORDER BY distance_meters ASC LIMIT 5;
END;
$$;

-- Spatial Indexing
CREATE INDEX idx_issues_location_gist ON public.issues USING GIST (location);`}</pre>
              </div>
            </div>
          )}

          {activeTab === 'gemini' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                6. Gemini AI Cost Guards & Prompt Templates
              </h3>
              <div className="space-y-2">
                <div className="p-3 bg-slate-100 rounded-lg">
                  <span className="font-bold text-slate-900">1. Client-Side Image Pre-Compression:</span>
                  <p className="mt-0.5 text-slate-600">
                    High-res mobile camera photos are downsized to max 1024px and compressed to WebP/JPEG under 100KB before transmission to the server.
                  </p>
                </div>

                <div className="p-3 bg-slate-100 rounded-lg">
                  <span className="font-bold text-slate-900">2. In-Memory SHA-256 Response Cache:</span>
                  <p className="mt-0.5 text-slate-600">
                    Prompts and image signatures are hashed. Repeated submissions within 1 hour return cached inference without calling Gemini API again ($0 additional cost).
                  </p>
                </div>

                <div className="p-3 bg-slate-100 rounded-lg">
                  <span className="font-bold text-slate-900">3. Per-IP Rate Limiting:</span>
                  <p className="mt-0.5 text-slate-600">
                    Limited to 12 AI analyses per minute per IP to prevent automated bot scraping or bill runaway.
                  </p>
                </div>

                <div className="p-3 bg-slate-100 rounded-lg">
                  <span className="font-bold text-slate-900">4. Strict JSON Schema & Zero-Waste Output:</span>
                  <p className="mt-0.5 text-slate-600">
                    Uses <code>responseSchema</code> with <code>gemini-3.8-flash</code> so tokens are restricted strictly to structured fields (category, severity, SLA, title), avoiding conversational fluff tokens.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'deploy' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                7. Deployment Guide & Setup Steps
              </h3>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  <span className="font-semibold text-slate-900">Create Supabase Project:</span>
                  <p className="text-slate-600">Enable PostGIS extension via SQL Editor and run <code>supabase/migrations/20261005_civic_pulse_postgis_schema.sql</code>.</p>
                </li>
                <li>
                  <span className="font-semibold text-slate-900">Set Environment Variables:</span>
                  <p className="text-slate-600">Copy <code>.env.example</code> to <code>.env</code> and fill in your Supabase, Gemini API, and VAPID Web Push credentials.</p>
                </li>
                <li>
                  <span className="font-semibold text-slate-900">Build & Verify:</span>
                  <p className="text-slate-600">Run <code>npm run lint</code> and <code>npm run build</code>.</p>
                </li>
                <li>
                  <span className="font-semibold text-slate-900">Deploy to Cloudflare / Vercel / Cloud Run:</span>
                  <p className="text-slate-600">Connect GitHub repo. Zero-configuration deploy with scale-to-zero serverless execution.</p>
                </li>
              </ol>
            </div>
          )}

          {activeTab === 'testing' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                8. Test Plan & Continuous Integration (CI)
              </h3>
              <div className="space-y-2">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="font-bold text-slate-900">Unit Tests:</span>
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-600">
                    <li>Image compressor downscales 4MB camera files to &lt;100KB without distortion.</li>
                    <li>Priority score formula outputs expected numerical weight.</li>
                    <li>Haversine & PostGIS duplicate radius returns correct distance in meters.</li>
                  </ul>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="font-bold text-slate-900">E2E Critical Paths:</span>
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-slate-600">
                    <li>Offline report queuing and automatic sync upon network reconnection.</li>
                    <li>Duplicate detection prompts user to upvote existing issue.</li>
                    <li>Officer status triage updates audit timeline and records before/after photos.</li>
                  </ul>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="font-bold text-slate-900">CI Workflow:</span>
                  <p className="mt-1 text-slate-600">GitHub Actions pipeline at <code>.github/workflows/ci.yml</code> runs on all PRs to validate TypeScript compilation, PostGIS migration syntax, and production build.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'roadmap' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900">
                9. Scalability Roadmap: Phase 2 & 3
              </h3>
              <div className="space-y-3">
                <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl">
                  <span className="font-bold text-teal-900">Phase 2: Hyper-Local Accessibility</span>
                  <ul className="list-disc pl-5 mt-1.5 space-y-1 text-slate-700">
                    <li><span className="font-semibold">WhatsApp Bot Reporting:</span> Twilio / Meta Cloud API webhook allowing citizens to send photo + live location on WhatsApp with automatic Gemini Flash triage.</li>
                    <li><span className="font-semibold">IVR Voice Helpline:</span> Automated phone hotline in regional dialects with speech-to-text ticket registration.</li>
                    <li><span className="font-semibold">Full Offline-First CRDT Sync:</span> IndexedDB with local SQLite wasm sync for field officers in remote rural zero-network pockets.</li>
                  </ul>
                </div>

                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl">
                  <span className="font-bold text-purple-900">Phase 3: Municipal Enterprise & Open Civic Data</span>
                  <ul className="list-disc pl-5 mt-1.5 space-y-1 text-slate-700">
                    <li><span className="font-semibold">ERP / SCADA Integrations:</span> Automated work order dispatch into SAP/Oracle municipal legacy systems.</li>
                    <li><span className="font-semibold">Public Open Data API:</span> Real-time GeoJSON endpoints for civic hackathons, urban planners, and NGO transparency audits.</li>
                    <li><span className="font-semibold">Predictive Infrastructure Failure:</span> Spatial clustering of water leaks and road subsidence predicting pipeline ruptures before surface collapse.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

// Configure MapLibre GL worker URL for Vite bundling
if (typeof maplibregl.setWorkerUrl === 'function') {
  maplibregl.setWorkerUrl(maplibreWorkerUrl);
}
import { Issue } from '../types';
import { MapPin, Navigation, AlertTriangle, Layers, Eye } from 'lucide-react';

interface MapLibreViewProps {
  issues: Issue[];
  selectedIssueId?: string | null;
  onSelectIssue: (issue: Issue) => void;
  isPickerMode?: boolean;
  pickerCoordinates?: { lat: number; lng: number } | null;
  onCoordinatesChange?: (coords: { lat: number; lng: number }) => void;
  duplicateRadiusMeters?: number;
  lowBandwidthMode?: boolean;
  userCoordinates?: { lat: number; lng: number } | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  pothole: '#ea580c', // Orange
  broken_streetlight: '#eab308', // Amber/Yellow
  garbage_dump: '#16a34a', // Green
  water_leakage: '#0284c7', // Blue
  drainage_overflow: '#7c3aed', // Purple
  damaged_road: '#dc2626', // Red
  encroachment: '#d97706', // Ochre
  fallen_tree: '#059669', // Emerald
  other: '#64748b', // Slate
};

export const MapLibreView: React.FC<MapLibreViewProps> = ({
  issues,
  selectedIssueId,
  onSelectIssue,
  isPickerMode = false,
  pickerCoordinates,
  onCoordinatesChange,
  lowBandwidthMode = false,
  userCoordinates,
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const pickerMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userLocationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initial center: default to issues center, picker coords, user location, or Faridabad / Delhi-NCR
  const defaultLat = userCoordinates?.lat || pickerCoordinates?.lat || (issues.length > 0 ? issues[0].latitude : 28.4089);
  const defaultLng = userCoordinates?.lng || pickerCoordinates?.lng || (issues.length > 0 ? issues[0].longitude : 77.3178);

  useEffect(() => {
    if (lowBandwidthMode || !mapContainer.current) return;

    try {
      // Test WebGL availability safely
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGlSupported(false);
        return;
      }
    } catch {
      setWebGlSupported(false);
      return;
    }

    const handleGlobalWorkerError = (e: ErrorEvent) => {
      if (e.message && (e.message.includes('Worker') || e.message.includes('worker'))) {
        e.preventDefault();
        console.warn('MapLibre worker error intercepted, falling back to 2G/Lite grid view:', e.message);
        setWebGlSupported(false);
      }
    };
    window.addEventListener('error', handleGlobalWorkerError);

    if (!mapInstance.current) {
      try {
        const map = new maplibregl.Map({
          container: mapContainer.current,
          style: {
            version: 8,
            sources: {
              'osm-tiles': {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors',
              },
            },
            layers: [
              {
                id: 'osm-layer',
                type: 'raster',
                source: 'osm-tiles',
                minzoom: 0,
                maxzoom: 19,
              },
            ],
          },
          center: [defaultLng, defaultLat],
          zoom: 14.2,
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

        map.on('load', () => {
          setMapLoaded(true);
        });

        map.on('error', (e: any) => {
          const errorMsg = e?.error?.message || e?.message || '';
          if (typeof errorMsg === 'string' && (errorMsg.includes('Worker') || errorMsg.includes('worker'))) {
            console.warn('MapLibre worker error handled, falling back to 2G/Lite grid view:', errorMsg);
            setWebGlSupported(false);
          }
        });

        // Handle map click when in location picker mode
        map.on('click', (e) => {
          if (isPickerMode && onCoordinatesChange) {
            onCoordinatesChange({ lat: e.lngLat.lat, lng: e.lngLat.lng });
          }
        });

        mapInstance.current = map;
      } catch (err) {
        console.warn('MapLibre instantiation error, switching to 2G/Lite grid view:', err);
        setWebGlSupported(false);
      }
    }

    return () => {
      window.removeEventListener('error', handleGlobalWorkerError);
      // Map cleanup on unmount
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [lowBandwidthMode]);

  // Update Issue Markers
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapLoaded || lowBandwidthMode) return;

    // Clear previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    issues.forEach((issue) => {
      const color = CATEGORY_COLORS[issue.category] || '#0d9488';
      const isSelected = issue.id === selectedIssueId;

      const el = document.createElement('div');
      el.className = 'civic-marker-pin';
      el.style.width = isSelected ? '34px' : '26px';
      el.style.height = isSelected ? '34px' : '26px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = isSelected ? '3px solid #ffffff' : '2px solid #ffffff';
      el.style.boxShadow = '0 4px 10px rgba(0,0,0,0.35)';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = '#ffffff';
      el.style.fontSize = '12px';
      el.style.fontWeight = 'bold';
      el.style.transition = 'transform 0.2s';
      el.title = `${issue.ticketNumber}: ${issue.title}`;
      el.innerHTML = `<span style="font-size: 11px;">${issue.upvotesCount}</span>`;

      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.25)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'scale(1)';
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectIssue(issue);
        map.flyTo({ center: [issue.longitude, issue.latitude], zoom: 15.5 });
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([issue.longitude, issue.latitude])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [issues, mapLoaded, selectedIssueId, lowBandwidthMode]);

  // Update Pin Marker in Picker Mode
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapLoaded || !isPickerMode || !pickerCoordinates || lowBandwidthMode) {
      if (pickerMarkerRef.current) {
        pickerMarkerRef.current.remove();
        pickerMarkerRef.current = null;
      }
      return;
    }

    if (!pickerMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'location-picker-pin';
      el.innerHTML = `
        <div style="background-color: #0d9488; color: white; width: 38px; height: 38px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(13,148,136,0.6); border: 2px solid white;">
          <div style="transform: rotate(45deg); font-size: 16px;">📍</div>
        </div>
      `;
      el.style.cursor = 'grab';

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([pickerCoordinates.lng, pickerCoordinates.lat])
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        if (onCoordinatesChange) {
          onCoordinatesChange({ lat: lngLat.lat, lng: lngLat.lng });
        }
      });

      pickerMarkerRef.current = marker;
    } else {
      pickerMarkerRef.current.setLngLat([pickerCoordinates.lng, pickerCoordinates.lat]);
    }
  }, [pickerCoordinates, isPickerMode, mapLoaded, lowBandwidthMode]);

  // Update Live User GPS Marker & Initial Fly-To
  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !mapLoaded || !userCoordinates || lowBandwidthMode) {
      if (userLocationMarkerRef.current) {
        userLocationMarkerRef.current.remove();
        userLocationMarkerRef.current = null;
      }
      return;
    }

    if (!userLocationMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-gps-pulse-marker';
      el.innerHTML = `
        <div style="position: relative; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 24px; height: 24px; background: rgba(2, 132, 199, 0.28); border-radius: 50%; box-shadow: 0 0 10px rgba(2, 132, 199, 0.4);"></div>
          <div style="width: 14px; height: 14px; background: #0284c7; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>
        </div>
      `;
      el.title = 'Your Current Live Location (GPS)';

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([userCoordinates.lng, userCoordinates.lat])
        .addTo(map);

      userLocationMarkerRef.current = marker;
      map.flyTo({ center: [userCoordinates.lng, userCoordinates.lat], zoom: 15.2 });
    } else {
      userLocationMarkerRef.current.setLngLat([userCoordinates.lng, userCoordinates.lat]);
    }
  }, [userCoordinates, mapLoaded, lowBandwidthMode]);

  // Center on GPS button
  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (onCoordinatesChange) onCoordinatesChange(coords);
        if (mapInstance.current) {
          mapInstance.current.flyTo({ center: [coords.lng, coords.lat], zoom: 15.5 });
        }
      },
      (err) => console.warn('Geolocation failed:', err)
    );
  };

  // Low-Bandwidth / 2G Offline Fallback View
  if (lowBandwidthMode || !webGlSupported) {
    return (
      <div className="relative w-full h-full bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-3 bg-teal-800 text-white text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-300" />
            <span className="font-semibold">2G/Low-Data Civic Grid Map (Zero Tile Download)</span>
          </div>
          <span className="bg-teal-700 px-2 py-0.5 rounded text-[10px]">Data Saver Active</span>
        </div>

        <div className="flex-1 p-3 overflow-y-auto space-y-2">
          <p className="text-xs text-slate-500 mb-2">
            Displaying geocoded issue cluster list directly to save mobile bandwidth on 3G/4G:
          </p>
          {issues.map((issue) => (
            <div
              key={issue.id}
              onClick={() => onSelectIssue(issue)}
              className="p-3 bg-white border border-slate-200 rounded-lg hover:border-teal-500 cursor-pointer flex items-center justify-between transition-all"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[issue.category] || '#0d9488' }}
                  />
                  <span className="text-xs font-bold text-slate-700">{issue.ticketNumber}</span>
                  <span className="text-[10px] text-slate-500">Ward {issue.wardNumber}</span>
                </div>
                <div className="text-xs font-medium text-slate-900 line-clamp-1">{issue.title}</div>
                <div className="text-[11px] text-slate-500">{issue.address}</div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded">
                  ▲ {issue.upvotesCount}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[360px] rounded-xl overflow-hidden shadow-sm border border-slate-200">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Floating Controls */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleLocateMe}
          title="Detect Current GPS Location"
          className="p-2.5 bg-white text-slate-700 rounded-full shadow-lg border border-slate-200 hover:bg-teal-50 hover:text-teal-700 transition-all flex items-center justify-center"
        >
          <Navigation className="w-5 h-5 text-teal-600" />
        </button>
      </div>

      {/* Picker Mode Instruction Banner */}
      {isPickerMode && (
        <div className="absolute top-3 left-3 right-14 z-10 bg-white/95 backdrop-blur-sm border border-teal-200 rounded-lg px-3 py-2 shadow-md flex items-center gap-2 text-xs text-slate-800">
          <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
          <span>Tap anywhere on the map or drag the pin to pinpoint the exact defect location.</span>
        </div>
      )}

      {/* Legend pill */}
      <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] text-slate-700 shadow-sm flex items-center gap-3">
        <span className="flex items-center gap-1 font-medium">
          <span className="w-2 h-2 rounded-full bg-orange-600 inline-block" /> Pothole
        </span>
        <span className="flex items-center gap-1 font-medium">
          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /> Water
        </span>
        <span className="flex items-center gap-1 font-medium">
          <span className="w-2 h-2 rounded-full bg-green-600 inline-block" /> Waste
        </span>
        <span className="text-slate-400">| MapLibre + OSM</span>
      </div>
    </div>
  );
};

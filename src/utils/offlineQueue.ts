import { OfflineQueuedReport } from '../types';

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

  // Dispatch custom event for reactive UI updates
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

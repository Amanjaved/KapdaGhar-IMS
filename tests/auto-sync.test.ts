import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncStatus } from '../lib/offline/syncEngine';

// Mock in-memory storage for node test environment
const mockStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = val.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
};

describe('Kapda Ghar - Auto-Sync Engine Tests', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', mockStorage());
    vi.stubGlobal('sessionStorage', mockStorage());
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal('document', {
      visibilityState: 'visible',
      addEventListener: vi.fn(),
    });
    vi.stubGlobal('navigator', {
      onLine: true,
    });
  });

  it('verifies SyncStatus schema and default settings', async () => {
    const { syncEngine } = await import('../lib/offline/syncEngine');
    if (!syncEngine) return;

    let receivedStatus: SyncStatus | null = null;
    const unsub = syncEngine.subscribe((s) => {
      receivedStatus = s;
    });

    expect(receivedStatus).not.toBeNull();
    expect(receivedStatus?.autoSyncEnabled).toBe(true);
    expect(receivedStatus?.autoSyncIntervalSeconds).toBeGreaterThanOrEqual(5);

    unsub();
  });

  it('allows toggling auto-sync and adjusting frequency', async () => {
    const { syncEngine } = await import('../lib/offline/syncEngine');
    if (!syncEngine) return;

    syncEngine.setAutoSyncInterval(30);
    const settings30 = syncEngine.getAutoSyncSettings();
    expect(settings30.intervalSeconds).toBe(30);

    syncEngine.setAutoSyncEnabled(false);
    const settingsOff = syncEngine.getAutoSyncSettings();
    expect(settingsOff.enabled).toBe(false);

    syncEngine.setAutoSyncEnabled(true);
    const settingsOn = syncEngine.getAutoSyncSettings();
    expect(settingsOn.enabled).toBe(true);
  });
});

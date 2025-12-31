import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncContext } from './useSyncContext';
import { ISyncContext } from '../../types/utils.types';

const BUNDLE_INFO_STORAGE_KEY = '@airship_bundle_info';

export interface IPersistedBundleInfo {
  // Native bundle info (immutable - for rollback)
  nativeBundleInfo: {
    appVersion: string;
    platform: string;
    projectId: string;
    environment: string;
    savedAt: number; // timestamp
  } | null;

  // Currently running OTA bundle info (updated when bundle changes)
  currentlyRunningBundle?: {
    bundleHash: string;
    version: string;
    releaseNotes: string;
    environment: string;
    appliedAt: number; // timestamp
  } | null;

  // Last known OTA update response (persisted)
  lastKnownUpdate?: ISyncContext['response'] | null;

  // Metadata
  lastSyncAt: number | null;
}

export interface IBundleInfo {
  // Current bundle info
  currentBundleHash: string | null;
  currentBundleVersion: string | null; // NEW: version of currently running bundle
  currentBundleReleaseNotes: string | null; // NEW: release notes of current bundle
  appVersion: string | null;
  platform: string | null;
  environment: string | null;
  projectId: string | null;

  // Latest available update (persisted even when updateAvailable becomes false)
  latestVersion: string | null;
  latestReleaseHash: string | null;
  latestEnvironment: string | null;
  latestBundleSize: number | null;
  latestDownloadUrl: string | null;
  latestReleaseNotes: string | null;
  latestPromotionId: number | null;
  latestTargetAppVersion: string | null;
  latestIsMandatory: boolean | null;
  latestRolloutPercentage: number | null;

  // Native bundle info (for rollback)
  nativeAppVersion: string | null;
  nativePlatform: string | null;
  nativeEnvironment: string | null;

  // Status
  updateAvailable: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  refetch: () => Promise<void>;
  clearPersistedData: () => Promise<void>;
}

export const useBundleInfo = (): IBundleInfo => {
  const { syncContext, loading, error, refetch } = useSyncContext();
  const [persistedData, setPersistedData] =
    useState<IPersistedBundleInfo | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const loadPersistedData = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(BUNDLE_INFO_STORAGE_KEY);
      if (stored) {
        const data: IPersistedBundleInfo = JSON.parse(stored);
        setPersistedData(data);
      }
    } catch (err) {
      console.warn('Failed to load persisted bundle info:', err);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const saveNativeBundleInfo = useCallback(
    async (context: ISyncContext) => {
      if (!context.appliedBundleHash) {
        // Only save native bundle info when running on native (no OTA bundle applied)
        try {
          const nativeInfo = {
            appVersion: context.appVersion || '',
            platform: context.platform || '',
            projectId: context.projectId || '',
            environment: context.currentEnvironment || '',
            savedAt: Date.now(),
          };

          const newData: IPersistedBundleInfo = {
            nativeBundleInfo: nativeInfo,
            lastKnownUpdate: persistedData?.lastKnownUpdate ?? null,
            lastSyncAt: Date.now(),
          };

          await AsyncStorage.setItem(
            BUNDLE_INFO_STORAGE_KEY,
            JSON.stringify(newData)
          );
          setPersistedData(newData);
        } catch (err) {
          console.warn('Failed to save native bundle info:', err);
        }
      }
    },
    [persistedData]
  );

  const persistUpdateData = useCallback(
    async (response: ISyncContext['response']) => {
      try {
        const newData: IPersistedBundleInfo = {
          nativeBundleInfo: persistedData?.nativeBundleInfo || null,
          lastKnownUpdate: response ?? null,
          lastSyncAt: Date.now(),
        };

        await AsyncStorage.setItem(
          BUNDLE_INFO_STORAGE_KEY,
          JSON.stringify(newData)
        );
        setPersistedData(newData);
      } catch (err) {
        console.warn('Failed to persist update data:', err);
      }
    },
    [persistedData]
  );

  const saveCurrentlyRunningBundle = useCallback(
    async (context: ISyncContext) => {
      // Save currently running OTA bundle info when appliedBundleHash exists
      if (context.appliedBundleHash && context.response) {
        const currentHash = context.appliedBundleHash;
        const persistedHash = persistedData?.currentlyRunningBundle?.bundleHash;

        // Only update if bundle hash changed or not yet saved
        if (currentHash !== persistedHash) {
          try {
            const currentBundle = {
              bundleHash: currentHash,
              version: context.response.version || '',
              releaseNotes: context.response.releaseNotes || '',
              environment:
                context.response.environment ||
                context.currentEnvironment ||
                '',
              appliedAt: Date.now(),
            };

            const newData: IPersistedBundleInfo = {
              nativeBundleInfo: persistedData?.nativeBundleInfo || null,
              currentlyRunningBundle: currentBundle,
              lastKnownUpdate: persistedData?.lastKnownUpdate ?? null,
              lastSyncAt: Date.now(),
            };

            await AsyncStorage.setItem(
              BUNDLE_INFO_STORAGE_KEY,
              JSON.stringify(newData)
            );
            setPersistedData(newData);
          } catch (err) {
            console.warn('Failed to save currently running bundle:', err);
          }
        }
      }
    },
    [persistedData]
  );

  const clearPersistedData = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(BUNDLE_INFO_STORAGE_KEY);
      setPersistedData(null);
    } catch (err) {
      console.warn('Failed to clear persisted data:', err);
    }
  }, []);

  // Load persisted data on mount
  useEffect(() => {
    loadPersistedData();
  }, [loadPersistedData]);

  // Save native bundle info on first sync (immutable)
  useEffect(() => {
    if (syncContext && !persistedData?.nativeBundleInfo) {
      saveNativeBundleInfo(syncContext);
    }
  }, [syncContext, persistedData, saveNativeBundleInfo]);

  // Persist update data when available
  useEffect(() => {
    if (syncContext?.response?.updateAvailable && isInitialized) {
      persistUpdateData(syncContext.response);
    }
  }, [syncContext?.response, isInitialized, persistUpdateData]);

  // Save currently running bundle info whenever appliedBundleHash changes
  useEffect(() => {
    if (syncContext && isInitialized) {
      saveCurrentlyRunningBundle(syncContext);
    }
  }, [syncContext, isInitialized, saveCurrentlyRunningBundle]);

  // Use current response if updateAvailable, otherwise use persisted
  const effectiveUpdate = syncContext?.response?.updateAvailable
    ? syncContext.response
    : persistedData?.lastKnownUpdate;

  return {
    // Current bundle info
    currentBundleHash: syncContext?.appliedBundleHash || null,
    currentBundleVersion:
      persistedData?.currentlyRunningBundle?.version || null,
    currentBundleReleaseNotes:
      persistedData?.currentlyRunningBundle?.releaseNotes || null,
    appVersion: syncContext?.appVersion || null,
    platform: syncContext?.platform || null,
    environment: syncContext?.currentEnvironment || null,
    projectId: syncContext?.projectId || null,

    // Latest available update (persisted)
    latestVersion: effectiveUpdate?.version || null,
    latestReleaseHash: effectiveUpdate?.releaseHash || null,
    latestEnvironment: effectiveUpdate?.environment || null,
    latestBundleSize: effectiveUpdate?.bundleSize || null,
    latestDownloadUrl: effectiveUpdate?.downloadUrl || null,
    latestReleaseNotes: effectiveUpdate?.releaseNotes || null,
    latestPromotionId: (effectiveUpdate as any)?.promotionId || null,
    latestTargetAppVersion: (effectiveUpdate as any)?.targetAppVersion || null,
    latestIsMandatory: (effectiveUpdate as any)?.isMandatory || null,
    latestRolloutPercentage:
      (effectiveUpdate as any)?.rolloutPercentage || null,

    // Native bundle info (for rollback)
    nativeAppVersion: persistedData?.nativeBundleInfo?.appVersion || null,
    nativePlatform: persistedData?.nativeBundleInfo?.platform || null,
    nativeEnvironment: persistedData?.nativeBundleInfo?.environment || null,

    // Status
    updateAvailable: syncContext?.response?.updateAvailable || false,
    loading,
    error,

    // Actions
    refetch,
    clearPersistedData,
  };
};

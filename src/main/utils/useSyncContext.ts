import { useState, useEffect } from 'react';
import { getSyncContext } from './StallionNativeUtils';
import { ISyncContext, IUseSyncContext } from '../../types/utils.types';

export const useSyncContext = (): IUseSyncContext => {
  const [syncContext, setSyncContext] = useState<ISyncContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSyncContext = async () => {
    try {
      setLoading(true);
      const context = await getSyncContext();
      setSyncContext(context);
      setError(null);
    } catch (err) {
      setError(err as string);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncContext();
  }, []);

  return {
    syncContext,
    loading,
    error,
    refetch: fetchSyncContext,
  };
};

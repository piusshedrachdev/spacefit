import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getConfig, getSettings } from '@/api/meta';
import type { StoreConfig, StoreSettings } from '@/types/api';

/**
 * Store-wide settings (policies, discount banner) and runtime config
 * (fees, payment methods) — loaded once at boot, mirroring how every legacy
 * page called getSettings()/getConfig().
 */

interface SettingsContextValue {
  settings: StoreSettings | null;
  config: StoreConfig | null;
  loading: boolean;
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [config, setConfig] = useState<StoreConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [settingsResult, configResult] = await Promise.allSettled([
      getSettings(),
      getConfig()
    ]);
    setSettings(settingsResult.status === 'fulfilled' ? settingsResult.value : null);
    setConfig(configResult.status === 'fulfilled' ? configResult.value : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, config, loading, reload }),
    [settings, config, loading, reload]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

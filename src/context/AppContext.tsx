import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { CalculationResult } from '@/src/core/calculation/calculationEngine';
import * as db from '@/src/core/database/database';
import type {
  AppSettings,
  CalculationRecord,
  Product,
  WizardDraft,
} from '@/src/core/models/types';
import { defaultSettings } from '@/src/core/models/types';

type WizardSession = {
  draft: WizardDraft;
  result: CalculationResult;
  settings: AppSettings;
};

type AppContextValue = {
  ready: boolean;
  settings: AppSettings;
  products: Product[];
  calculations: CalculationRecord[];
  wizardSession: WizardSession | null;
  refreshSettings: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  refreshCalculations: () => Promise<void>;
  setWizardSession: (session: WizardSession | null) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [products, setProducts] = useState<Product[]>([]);
  const [calculations, setCalculations] = useState<CalculationRecord[]>([]);
  const [wizardSession, setWizardSession] = useState<WizardSession | null>(null);

  const refreshSettings = useCallback(async () => {
    setSettings(await db.getSettings());
  }, []);

  const refreshProducts = useCallback(async () => {
    setProducts(await db.getProducts());
  }, []);

  const refreshCalculations = useCallback(async () => {
    setCalculations(await db.getCalculations());
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await refreshSettings();
      await refreshProducts();
      await refreshCalculations();
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [refreshCalculations, refreshProducts, refreshSettings]);

  const value = useMemo(
    () => ({
      ready,
      settings,
      products,
      calculations,
      wizardSession,
      refreshSettings,
      refreshProducts,
      refreshCalculations,
      setWizardSession,
    }),
    [
      ready,
      settings,
      products,
      calculations,
      wizardSession,
      refreshSettings,
      refreshProducts,
      refreshCalculations,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

export { db };

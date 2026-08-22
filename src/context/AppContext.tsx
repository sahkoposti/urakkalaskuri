import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { CalculationResult } from '@/src/core/calculation/calculationPipeline';
import * as db from '@/src/core/database/database';
import type {
  AppSettings,
  CalculationRecord,
  PersistedWizardDraft,
  Product,
  WizardDraft,
  WizardLineDraft,
} from '@/src/core/models/types';
import { defaultSettings } from '@/src/core/models/types';
import type { FormDebugSettings, FormDefinition } from '@/src/core/form/types';
import { createDefaultFormDefinition } from '@/src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '@/src/core/form/formDefinitionHelpers';
import { defaultFormDebugSettings } from '@/src/core/form/types';

import type { WizardFormState } from '@/src/core/wizard/wizardDraftHelpers';

type WizardSession = {
  draft: WizardDraft;
  result: CalculationResult;
  settings: AppSettings;
  form: WizardFormState;
  formContext: Record<string, number>;
  materialLines: WizardLineDraft[];
  editCalculationId?: string;
  originalCreatedAt?: Date;
  /** Muokattavan laskelman snapshotin formVersion (varoitus jos eroaa nykyisestä). */
  editFormVersion?: number;
};

type AppContextValue = {
  ready: boolean;
  settings: AppSettings;
  products: Product[];
  calculations: CalculationRecord[];
  wizardSession: WizardSession | null;
  wizardDraft: PersistedWizardDraft | null;
  formDefinition: FormDefinition;
  formDebug: FormDebugSettings;
  refreshSettings: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  refreshCalculations: () => Promise<void>;
  refreshWizardDraft: () => Promise<void>;
  refreshFormSettings: () => Promise<void>;
  setWizardSession: (session: WizardSession | null) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [products, setProducts] = useState<Product[]>([]);
  const [calculations, setCalculations] = useState<CalculationRecord[]>([]);
  const [wizardSession, setWizardSession] = useState<WizardSession | null>(null);
  const [wizardDraft, setWizardDraft] = useState<PersistedWizardDraft | null>(null);
  const [formDefinition, setFormDefinition] = useState<FormDefinition>(
    normalizeFormDefinition(createDefaultFormDefinition()),
  );
  const [formDebug, setFormDebug] = useState<FormDebugSettings>(defaultFormDebugSettings);

  const refreshFormSettings = useCallback(async () => {
    setFormDefinition(await db.getFormDefinition());
    setFormDebug(await db.getFormDebugSettings());
  }, []);

  const refreshSettings = useCallback(async () => {
    setSettings(await db.getSettings());
  }, []);

  const refreshProducts = useCallback(async () => {
    setProducts(await db.getProducts());
  }, []);

  const refreshCalculations = useCallback(async () => {
    setCalculations(await db.getCalculations());
  }, []);

  const refreshWizardDraft = useCallback(async () => {
    setWizardDraft(await db.getWizardDraft());
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAll() {
      await refreshSettings();
      await refreshProducts();
      await refreshCalculations();
      await refreshWizardDraft();
      await refreshFormSettings();
    }

    (async () => {
      try {
        await loadAll();
        if (active) setReady(true);
      } catch (error) {
        console.warn('Tietokannan avaus epäonnistui, yritetään uudelleen', error);
        db.resetDatabaseConnection();
        try {
          await loadAll();
          if (active) setReady(true);
        } catch (retryError) {
          console.error('Tietokannan avaus epäonnistui uudelleen', retryError);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshCalculations, refreshFormSettings, refreshProducts, refreshSettings, refreshWizardDraft]);

  const value = useMemo(
    () => ({
      ready,
      settings,
      products,
      calculations,
      wizardSession,
      wizardDraft,
      formDefinition,
      formDebug,
      refreshSettings,
      refreshProducts,
      refreshCalculations,
      refreshWizardDraft,
      refreshFormSettings,
      setWizardSession,
    }),
    [
      ready,
      settings,
      products,
      calculations,
      wizardSession,
      wizardDraft,
      formDefinition,
      formDebug,
      refreshSettings,
      refreshProducts,
      refreshCalculations,
      refreshWizardDraft,
      refreshFormSettings,
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

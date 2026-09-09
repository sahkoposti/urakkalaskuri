import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import * as db from '@/src/core/database/database';
import type {
  AppSettings,
  CalculationRecord,
  PersistedWizardDraft,
  Product,
} from '@/src/core/models/types';
import { defaultSettings } from '@/src/core/models/types';
import type { FormDebugSettings, FormDefinition } from '@/src/core/form/types';
import { createDefaultFormDefinition } from '@/src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '@/src/core/form/formDefinitionHelpers';
import { defaultFormDebugSettings } from '@/src/core/form/types';
import {
  DEFAULT_STRUCTURE_ID,
  type CustomerRecord,
  type ProductStructure,
} from '@/src/core/structure/types';

type AppContextValue = {
  ready: boolean;
  settings: AppSettings;
  products: Product[];
  calculations: CalculationRecord[];
  structures: ProductStructure[];
  customers: CustomerRecord[];
  activeStructureId: string;
  wizardDraft: PersistedWizardDraft | null;
  formDefinition: FormDefinition;
  formDebug: FormDebugSettings;
  refreshSettings: () => Promise<void>;
  refreshProducts: () => Promise<void>;
  refreshCalculations: () => Promise<void>;
  refreshWizardDraft: () => Promise<void>;
  refreshFormSettings: () => Promise<void>;
  refreshStructures: () => Promise<void>;
  refreshCustomers: () => Promise<void>;
  setActiveStructure: (id: string) => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [products, setProducts] = useState<Product[]>([]);
  const [calculations, setCalculations] = useState<CalculationRecord[]>([]);
  const [structures, setStructures] = useState<ProductStructure[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [activeStructureId, setActiveStructureIdState] = useState(DEFAULT_STRUCTURE_ID);
  const [wizardDraft, setWizardDraft] = useState<PersistedWizardDraft | null>(null);
  const [formDefinition, setFormDefinition] = useState<FormDefinition>(
    normalizeFormDefinition(createDefaultFormDefinition()),
  );
  const [formDebug, setFormDebug] = useState<FormDebugSettings>(defaultFormDebugSettings);

  const refreshFormSettings = useCallback(async () => {
    setFormDefinition(await db.getFormDefinition());
    setFormDebug(await db.getFormDebugSettings());
    const next = await db.getProductStructures();
    setStructures(next);
    setActiveStructureIdState(await db.getActiveStructureId());
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

  const refreshStructures = useCallback(async () => {
    const next = await db.getProductStructures();
    setStructures(next);
    const activeId = await db.getActiveStructureId();
    setActiveStructureIdState(activeId);
  }, []);

  const refreshCustomers = useCallback(async () => {
    setCustomers(await db.getCustomers());
  }, []);

  const setActiveStructure = useCallback(async (id: string) => {
    await db.setActiveStructureId(id);
    setActiveStructureIdState(id);
    setFormDefinition(await db.getFormDefinition());
  }, []);

  useEffect(() => {
    let active = true;

    async function loadAll() {
      await refreshSettings();
      await refreshStructures();
      await refreshProducts();
      await refreshCustomers();
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
  }, [
    refreshCalculations,
    refreshCustomers,
    refreshFormSettings,
    refreshProducts,
    refreshSettings,
    refreshStructures,
    refreshWizardDraft,
  ]);

  const value = useMemo(
    () => ({
      ready,
      settings,
      products,
      calculations,
      structures,
      customers,
      activeStructureId,
      wizardDraft,
      formDefinition,
      formDebug,
      refreshSettings,
      refreshProducts,
      refreshCalculations,
      refreshWizardDraft,
      refreshFormSettings,
      refreshStructures,
      refreshCustomers,
      setActiveStructure,
    }),
    [
      ready,
      settings,
      products,
      calculations,
      structures,
      customers,
      activeStructureId,
      wizardDraft,
      formDefinition,
      formDebug,
      refreshSettings,
      refreshProducts,
      refreshCalculations,
      refreshWizardDraft,
      refreshFormSettings,
      refreshStructures,
      refreshCustomers,
      setActiveStructure,
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

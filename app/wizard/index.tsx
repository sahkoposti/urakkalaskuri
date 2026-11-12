import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { MaterialQuantitiesEditor } from '@/src/components/calculation/MaterialQuantitiesEditor';
import { StructureLineCard } from '@/src/components/calculation/StructureLineCard';
import { structureRowShowsAdditionalInfo } from '@/src/core/pdf/structureExtraText';
import { ChoiceToggle } from '@/src/components/ChoiceToggle';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { UpdateOldCalculationsDialog } from '@/src/components/UpdateOldCalculationsDialog';
import {
  AppCard,
  AppInput,
  OutlinedButton,
  PrimaryButton,
  SectionTitle,
} from '@/src/components/common';
import { customerFromInfo, customerSnapshotEquals } from '@/src/core/customer/customerRegister';
import type { CustomerInfo, CustomerType, StructureLine } from '@/src/core/models/types';
import { serializeCustomerDetails } from '@/src/core/models/types';
import {
  emptyManualStructureLine,
  emptyStructureLine,
  MANUAL_STRUCTURE_ID,
  type ProductStructure,
} from '@/src/core/structure/types';
import { isStructureFormIncomplete } from '@/src/core/structure/formPages';
import { defaultPricesIncludeVat, type BusinessVatMode } from '@/src/core/utils/priceDisplay';
import {
  materialQuantitiesBlockFinish,
  materialQuantitiesSignature,
  mergeStructureLineMaterials,
} from '@/src/core/materials/materialQuantities';
import { createId } from '@/src/core/utils/id';
import { applySiteAddressSnapshot } from '@/src/core/pdf/siteAddress';
import { applyRefreshedStructurePrices, calculationWithBusinessVatMode, preserveCalculationSnapshot } from '@/src/core/pdf/urakkakorttiCard';
import { buildCalculationRecordFromComposer } from '@/src/core/wizard/buildCalculationRecord';
import { calculationToFormState } from '@/src/core/wizard/calculationToWizard';
import { isDraftCalculation, wizardDraftFromCalculation } from '@/src/core/wizard/draftCalculation';
import {
  buildPersistedWizardDraft,
  composerHasUnsavedChanges,
  composerStateSignature,
  decideComposerLeave,
  firstNonEmptyId,
  hasWizardDraftContent,
  mergeWizardDraftEditMeta,
  persistedDraftToFormState,
  shouldKeepResumeDraftOnLeave,
  shouldPersistOpenComposer,
  type WizardDraftEditMeta,
  type WizardFormState,
} from '@/src/core/wizard/wizardDraftHelpers';
import { decideComposerFocusRestore } from '@/src/core/wizard/composerFocusRestore';
import { createComposerSaveGate } from '@/src/core/wizard/composerSaveGate';
import { createScreenLeave } from '@/src/core/wizard/screenLeave';
import { hasFieldValueContent } from '@/src/core/wizard/wizardPageHelpers';
import { resetToHistoryDetail } from '@/src/core/navigation/appStack';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { exitStackScreenOptions } from '@/src/hooks/exitStackScreenOptions';
import { useNativeRemovePrevention } from '@/src/hooks/useNativeRemovePrevention';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function CalculationComposerScreen() {
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const { editId } = useLocalSearchParams<{ editId?: string | string[] }>();
  const routeEditId = firstNonEmptyId(editId);
  const {
    settings,
    products,
    wizardDraft,
    structures,
    customers,
    refreshWizardDraft,
    refreshCalculations,
    refreshCustomers,
  } = useApp();
  const { showAlert } = useThemedAlert();

  const [editCalculationId, setEditCalculationId] = useState<string | null>(null);
  const [originalCreatedAt, setOriginalCreatedAt] = useState<Date | null>(null);
  const [editFormVersion, setEditFormVersion] = useState<number | null>(null);
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [customerName, setCustomerName] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('private');
  const [reverseVat, setReverseVat] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPostalCode, setCustomerPostalCode] = useState('');
  const [customerPostalLocality, setCustomerPostalLocality] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [deliveryScheduleText, setDeliveryScheduleText] = useState('');
  const [travelTimeOneWay, setTravelTimeOneWay] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [siteAddressTouched, setSiteAddressTouched] = useState(false);
  const [structureLines, setStructureLines] = useState<StructureLine[]>([]);
  const [businessVatMode, setBusinessVatMode] = useState<BusinessVatMode>('alv0');
  const [materialIssues, setMaterialIssues] = useState<Record<string, boolean>>({});
  const [structurePickerVisible, setStructurePickerVisible] = useState(false);
  const [deleteLineId, setDeleteLineId] = useState<string | null>(null);
  const [updateCalcsVisible, setUpdateCalcsVisible] = useState(false);

  const hydratedRef = useRef(false);
  const loadedEditIdRef = useRef<string | null>(null);
  const screenLeave = useRef(createScreenLeave()).current;
  const saveGate = useRef(createComposerSaveGate()).current;
  const completedBaselineRef = useRef<string | null>(null);
  const lastDraftUpdatedAtRef = useRef<number | null>(null);
  const boundCalculationIdRef = useRef<string | null>(null);
  const originalCreatedAtRef = useRef<Date | null>(null);
  const savingRef = useRef(false);
  const savedSignatureRef = useRef<string | null>(null);
  const originSignatureRef = useRef<string | null>(null);
  const resumedIncompleteDraftRef = useRef(false);
  const wizardDraftRef = useRef(wizardDraft);
  wizardDraftRef.current = wizardDraft;
  const structureLinesRef = useRef(structureLines);
  structureLinesRef.current = structureLines;
  const lineFormNavInFlightRef = useRef(false);
  const customerNavInFlightRef = useRef(false);
  const lineFormNavReleaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerNavReleaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SUBSCREEN_NAV_RELEASE_MS = 5000;

  function releaseLineFormNavGuard() {
    lineFormNavInFlightRef.current = false;
    const timeout = lineFormNavReleaseTimeoutRef.current;
    if (timeout != null) {
      clearTimeout(timeout);
      lineFormNavReleaseTimeoutRef.current = null;
    }
  }

  function releaseCustomerNavGuard() {
    customerNavInFlightRef.current = false;
    const timeout = customerNavReleaseTimeoutRef.current;
    if (timeout != null) {
      clearTimeout(timeout);
      customerNavReleaseTimeoutRef.current = null;
    }
  }

  function scheduleLineFormNavSafetyRelease() {
    const existing = lineFormNavReleaseTimeoutRef.current;
    if (existing != null) clearTimeout(existing);
    lineFormNavReleaseTimeoutRef.current = setTimeout(() => {
      lineFormNavInFlightRef.current = false;
      lineFormNavReleaseTimeoutRef.current = null;
    }, SUBSCREEN_NAV_RELEASE_MS);
  }

  function scheduleCustomerNavSafetyRelease() {
    const existing = customerNavReleaseTimeoutRef.current;
    if (existing != null) clearTimeout(existing);
    customerNavReleaseTimeoutRef.current = setTimeout(() => {
      customerNavInFlightRef.current = false;
      customerNavReleaseTimeoutRef.current = null;
    }, SUBSCREEN_NAV_RELEASE_MS);
  }

  const setMaterialLineValidity = useCallback((lineId: string, valid: boolean) => {
    setMaterialIssues((current) => {
      const invalid = !valid;
      if (Boolean(current[lineId]) === invalid) return current;
      if (!invalid) {
        if (!(lineId in current)) return current;
        const next = { ...current };
        delete next[lineId];
        return next;
      }
      return { ...current, [lineId]: true };
    });
  }, []);

  function buildCustomerInfo(): CustomerInfo {
    return {
      name: customerName.trim(),
      customerType,
      reverseVat: customerType === 'business' ? reverseVat : false,
      phone: customerPhone.trim() || undefined,
      email: customerEmail.trim() || undefined,
      address: customerAddress.trim() || undefined,
      postalCode: customerPostalCode.trim() || undefined,
      postalLocality: customerPostalLocality.trim() || undefined,
      notes: customerNotes.trim() || undefined,
    };
  }

  function getFormState(): WizardFormState {
    return {
      step: 0,
      customerName,
      customerType,
      reverseVat,
      customerPhone,
      customerEmail,
      customerAddress,
      customerPostalCode,
      customerPostalLocality,
      customerNotes,
      duration: '',
      fieldValues: {},
      lines: [],
      customerId,
      deliveryScheduleText,
      travelTimeOneWay,
      siteAddress,
      siteAddressTouched,
      structureLines,
      businessVatMode,
    };
  }
  const getFormStateRef = useRef(getFormState);
  getFormStateRef.current = getFormState;
  const pricesIncludeVat = defaultPricesIncludeVat(buildCustomerInfo());
  const forceVat0 = Boolean(reverseVat);
  const showBusinessVatChoice = customerType === 'business' && !reverseVat;
  const businessOfferIncludesVat = customerType === 'business' && businessVatMode === 'sis' && !reverseVat;

  function markComposerSaved(state: WizardFormState) {
    const lines = hydrateLines(state, structures, settings.vatPercent);
    savedSignatureRef.current = composerStateSignature({ ...state, structureLines: lines });
  }

  function isComposerDirty(state = getFormState()): boolean {
    return composerHasUnsavedChanges(state, savedSignatureRef.current);
  }

  function formSignature(state: WizardFormState): string {
    return composerStateSignature({
      ...state,
      structureLines: hydrateLines(state, structures, settings.vatPercent),
    });
  }

  function rememberOrigin(state: WizardFormState) {
    originSignatureRef.current = formSignature(state);
  }

  function shouldKeepResumeDraft(state = getFormState()): boolean {
    return shouldKeepResumeDraftOnLeave({
      resumedIncompleteDraft: resumedIncompleteDraftRef.current,
      currentSignature: formSignature(state),
      originSignature: originSignatureRef.current,
    });
  }

  const composerDirty = composerHasUnsavedChanges(getFormState(), savedSignatureRef.current);
  const applyPreventRemove = useNativeRemovePrevention(
    composerDirty || Boolean(wizardDraft && !shouldKeepResumeDraft()),
  );

  function draftWithBaseline() {
    const previous = wizardDraftRef.current;
    const json = previous?.completedRecordJson ?? completedBaselineRef.current ?? undefined;
    if (!json || previous?.completedRecordJson) return previous;
    if (!previous) return { completedRecordJson: json } as NonNullable<typeof previous>;
    return { ...previous, completedRecordJson: json };
  }

  screenLeave.setOnRelease(() => {
    const state = getFormStateRef.current();
    applyPreventRemove(
      composerHasUnsavedChanges(state, savedSignatureRef.current) ||
        Boolean(wizardDraftRef.current && !shouldKeepResumeDraft(state)),
    );
  });

  function bindExistingCalculation(
    id?: string | null,
    createdAt?: Date | number | null,
    formVersion?: number | null,
  ) {
    const nextId = firstNonEmptyId(id);
    if (nextId) {
      boundCalculationIdRef.current = nextId;
      setEditCalculationId(nextId);
    }
    if (createdAt != null) {
      const date = createdAt instanceof Date ? createdAt : new Date(createdAt);
      if (!Number.isNaN(date.getTime())) {
        originalCreatedAtRef.current = date;
        setOriginalCreatedAt(date);
      }
    }
    if (typeof formVersion === 'number') {
      setEditFormVersion(formVersion);
    }
  }

  function currentEditMeta(extra?: WizardDraftEditMeta | null): WizardDraftEditMeta {
    return mergeWizardDraftEditMeta(extra, {
      editCalculationId: firstNonEmptyId(
        extra?.editCalculationId,
        routeEditId,
        boundCalculationIdRef.current,
        editCalculationId,
        wizardDraft?.editCalculationId,
      ),
      originalCreatedAt:
        extra?.originalCreatedAt ??
        originalCreatedAtRef.current ??
        originalCreatedAt ??
        wizardDraft?.originalCreatedAt,
      editFormVersion: extra?.editFormVersion ?? editFormVersion ?? wizardDraft?.editFormVersion,
    }, wizardDraft);
  }

  async function persistDraft(state = getFormState(), extra?: WizardDraftEditMeta | null) {
    const meta = currentEditMeta(extra);
    bindExistingCalculation(meta.editCalculationId, meta.originalCreatedAt, meta.editFormVersion);
    const built = buildPersistedWizardDraft(state, meta, draftWithBaseline());
    if (isComposerDirty(state)) await db.saveWizardDraft(built);
    else await db.saveWizardViewSession(built);
    await refreshWizardDraft();
    await refreshCalculations();
    markComposerSaved(state);
  }

  function applyFormState(form: WizardFormState): WizardFormState {
    setCustomerName(form.customerName);
    setCustomerType(form.customerType);
    setReverseVat(form.reverseVat);
    setCustomerPhone(form.customerPhone);
    setCustomerEmail(form.customerEmail);
    setCustomerAddress(form.customerAddress);
    setCustomerPostalCode(form.customerPostalCode ?? '');
    setCustomerPostalLocality(form.customerPostalLocality ?? '');
    setCustomerNotes(form.customerNotes);
    setCustomerId(form.customerId);
    setDeliveryScheduleText(form.deliveryScheduleText ?? '');
    setTravelTimeOneWay(form.travelTimeOneWay ?? '');
    setSiteAddress(form.siteAddress ?? '');
    setSiteAddressTouched(form.siteAddressTouched === true);
    setBusinessVatMode(form.businessVatMode === 'sis' ? 'sis' : 'alv0');
    const incoming = hydrateLines(form, structures, settings.vatPercent);
    const lines = incoming.map((item) => {
      const previous = structureLinesRef.current.find((current) => current.id === item.id);
      const structure = structures.find((entry) => entry.id === item.structureId);
      return mergeStructureLineMaterials(previous, item, structure?.form, products);
    });
    setStructureLines(lines);
    const nextForm = { ...form, structureLines: lines };
    markComposerSaved(nextForm);
    // Esitäyttö ei ole käyttäjän muutos. Valmista laskelmaa ei tallenneta siitä.
    // Jo keskeneräinen sessio saa esitäytön, jotta se ei katoa.
    if (
      resumedIncompleteDraftRef.current &&
      materialQuantitiesSignature(incoming) !== materialQuantitiesSignature(lines)
    ) {
      void persistDraft(nextForm);
    }
    return nextForm;
  }

  function restoreDraftForm(draft: NonNullable<typeof wizardDraft>, resumedIncomplete: boolean) {
    lastDraftUpdatedAtRef.current = draft.updatedAt;
    const { form } = persistedDraftToFormState(draft, products);
    bindExistingCalculation(draft.editCalculationId, draft.originalCreatedAt, draft.editFormVersion);
    resumedIncompleteDraftRef.current = resumedIncomplete;
    completedBaselineRef.current = draft.completedRecordJson ?? null;
    const applied = applyFormState(form);
    if (resumedIncomplete) rememberOrigin(applied);
  }

  useEffect(() => {
    return () => {
      releaseLineFormNavGuard();
      releaseCustomerNavGuard();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      releaseLineFormNavGuard();
      releaseCustomerNavGuard();
      screenLeave.reset();
      let active = true;
      // Viimeisin luonnos refistä. Callbackin riippuvuuksissa ei ole wizardDraftia,
      // joten closureen jäänyt avaushetken luonnos ylikirjoittaisi Valmis-paluun.
      const latestDraft = wizardDraftRef.current;
      const decision = decideComposerFocusRestore({
        routeEditId,
        loadedEditId: loadedEditIdRef.current,
        latestDraft,
        lastAppliedUpdatedAt: lastDraftUpdatedAtRef.current,
        hydrated: hydratedRef.current,
      });

      if (routeEditId) {
        bindExistingCalculation(routeEditId);
        if (decision === 'none') {
          return () => {
            active = false;
            screenLeave.reset();
          };
        }
        loadedEditIdRef.current = routeEditId;

        if (decision === 'restoreDraft' && latestDraft) {
          hydratedRef.current = true;
          restoreDraftForm(latestDraft, true);
          return () => {
            active = false;
            screenLeave.reset();
          };
        }

        (async () => {
          const record = await db.getCalculation(routeEditId);
          if (!active || !record) return;
          hydratedRef.current = true;
          const storedDraft = isDraftCalculation(record) ? wizardDraftFromCalculation(record) : null;
          if (storedDraft) {
            restoreDraftForm({ ...storedDraft, editCalculationId: record.id }, true);
            return;
          }
          resumedIncompleteDraftRef.current = false;
          completedBaselineRef.current = isDraftCalculation(record) ? null : JSON.stringify(record);
          const { form } = calculationToFormState(record, products);
          bindExistingCalculation(
            record.id,
            record.createdAt,
            record.formSnapshot?.formVersion ?? null,
          );
          rememberOrigin(applyFormState(form));
        })();
        return () => {
          active = false;
          screenLeave.reset();
        };
      }

      loadedEditIdRef.current = null;

      if (latestDraft) {
        hydratedRef.current = true;
        if (decision === 'restoreDraft') {
          restoreDraftForm(latestDraft, true);
        }
      } else if (decision === 'hydrateEmpty') {
        resumedIncompleteDraftRef.current = false;
        rememberOrigin(getFormStateRef.current());
        hydratedRef.current = true;
      }
      return () => {
        active = false;
        screenLeave.reset();
      };
    }, [routeEditId, products, settings.vatPercent, structures]),
  );

  useEffect(() => {
    if (!wizardDraft) return;
    if (routeEditId && firstNonEmptyId(wizardDraft.editCalculationId) !== routeEditId) {
      return;
    }
    if (lastDraftUpdatedAtRef.current === wizardDraft.updatedAt) return;
    lastDraftUpdatedAtRef.current = wizardDraft.updatedAt;
    const { form } = persistedDraftToFormState(wizardDraft, products);
    bindExistingCalculation(
      wizardDraft.editCalculationId,
      wizardDraft.originalCreatedAt,
      wizardDraft.editFormVersion,
    );
    applyFormState(form);
  }, [wizardDraft?.updatedAt, products, routeEditId]);

  async function publishComposerState(state: WizardFormState): Promise<void> {
    // Lippu otetaan heti. Valmis, joka ehtii väliin, vanhentaa tämän kirjoituksen.
    if (savingRef.current || saveGate.isFinishing()) return;
    const token = saveGate.capture();
    const existingId = firstNonEmptyId(currentEditMeta().editCalculationId);
    const hasContent = hasWizardDraftContent(state);
    // Tyhjä uusi laskenta ei luo riviä. Tyhjennys kirjoitetaan vain olemassa olevalle riville.
    if (!hasContent && !(isComposerDirty(state) && existingId)) return;
    const meta = currentEditMeta();
    let id = firstNonEmptyId(meta.editCalculationId);
    let createdAt: Date =
      meta.originalCreatedAt instanceof Date
        ? meta.originalCreatedAt
        : typeof meta.originalCreatedAt === 'number'
          ? new Date(meta.originalCreatedAt)
          : new Date();
    if (id) {
      const existing = await db.getCalculation(id);
      if (existing) createdAt = existing.createdAt;
    }
    if (!saveGate.canCommit(token)) return;
    if (!id) {
      if (!hasWizardDraftContent(state)) return;
      id = createId();
    }
    const draft = buildPersistedWizardDraft(
      state,
      { editCalculationId: id, originalCreatedAt: createdAt, editFormVersion: meta.editFormVersion },
      draftWithBaseline(),
    );
    bindExistingCalculation(id, createdAt, meta.editFormVersion);
    await saveGate.commit(token, async () => {
      if (!saveGate.canCommit(token)) return;
      await db.saveWizardDraft(draft);
      await refreshWizardDraft();
      await refreshCalculations();
      markComposerSaved(state);
    });
  }

  async function saveDraftAndExit() {
    try {
      await screenLeave.leave(async () => {
        await publishComposerState(getFormStateRef.current());
      }, () => router.back());
    } catch {
      showAlert('Tallennus epäonnistui', 'Laskentaa ei tallennettu. Yritä uudelleen.');
    }
  }

  async function leaveKeepingDraft(onLeave: () => void) {
    try {
      await screenLeave.leave(
        async () => {
          const state = getFormStateRef.current();
          const action = decideComposerLeave({
            allowExit: false,
            dirty: isComposerDirty(state),
            hasContent: hasWizardDraftContent(state),
            keepResume: shouldKeepResumeDraft(state),
            hasSession: Boolean(wizardDraftRef.current),
            canUpdateExisting: Boolean(firstNonEmptyId(currentEditMeta().editCalculationId)),
          });
          if (action === 'save-and-leave') {
            await publishComposerState(state);
          } else if (action === 'clear-and-leave') {
            await db.clearWizardDraft();
            await refreshWizardDraft();
          }
        },
        () => {
          applyPreventRemove(false);
          onLeave();
        },
      );
    } catch {
      showAlert('Tallennus epäonnistui', 'Laskentaa ei tallennettu. Yritä uudelleen.');
    }
  }

  const leaveKeepingDraftRef = useRef(leaveKeepingDraft);
  leaveKeepingDraftRef.current = leaveKeepingDraft;
  const publishComposerStateRef = useRef(publishComposerState);
  publishComposerStateRef.current = publishComposerState;

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (screenLeave.shouldBypass()) return;
      const state = getFormStateRef.current();
      const action = decideComposerLeave({
        allowExit: false,
        dirty: isComposerDirty(state),
        hasContent: hasWizardDraftContent(state),
        keepResume: shouldKeepResumeDraft(state),
        hasSession: Boolean(wizardDraftRef.current),
        canUpdateExisting: Boolean(firstNonEmptyId(currentEditMeta().editCalculationId)),
      });
      if (action === 'leave') return;
      event.preventDefault();
      void leaveKeepingDraft(() => navigation.dispatch(event.data.action));
    });
    return unsubscribe;
  });

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (screenLeave.shouldBypass()) return false;
        void leaveKeepingDraftRef.current(() => router.back());
        return true;
      });
      return () => subscription.remove();
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'background' && next !== 'inactive') return;
      if (screenLeave.shouldBypass() || savingRef.current || saveGate.isFinishing()) return;
      const state = getFormStateRef.current();
      if (
        !shouldPersistOpenComposer({
          dirty: isComposerDirty(state),
          hasContent: hasWizardDraftContent(state),
          canUpdateExisting: Boolean(firstNonEmptyId(currentEditMeta().editCalculationId)),
        })
      ) {
        return;
      }
      // Kutsu on synkroninen lipun ottoon asti. Valmis vanhentaa sen ennen tietokantakirjoitusta.
      void publishComposerStateRef.current(state).catch(() => {
        // Taustatallennuksen epäonnistuminen ei kaada näyttöä. Poistuminen yrittää uudelleen.
      });
    });
    return () => subscription.remove();
  }, []);

  async function openCustomer() {
    if (customerNavInFlightRef.current) return;
    customerNavInFlightRef.current = true;
    scheduleCustomerNavSafetyRelease();
    let pushed = false;
    try {
      await persistDraft();
      const editId = firstNonEmptyId(
        routeEditId,
        boundCalculationIdRef.current,
        editCalculationId,
        wizardDraft?.editCalculationId,
      );
      router.push({ pathname: '/wizard/customer', params: editId ? { editId } : {} } as Href);
      pushed = true;
    } finally {
      if (!pushed) releaseCustomerNavGuard();
    }
  }

  async function openLineForm(lineId: string) {
    if (lineFormNavInFlightRef.current) return;
    lineFormNavInFlightRef.current = true;
    scheduleLineFormNavSafetyRelease();
    let pushed = false;
    try {
      await persistDraft();
      const editId = firstNonEmptyId(
        routeEditId,
        boundCalculationIdRef.current,
        editCalculationId,
        wizardDraft?.editCalculationId,
      );
      router.push({
        pathname: '/wizard/line/[lineId]',
        params: editId ? { lineId, editId } : { lineId },
      } as Href);
      pushed = true;
    } finally {
      if (!pushed) releaseLineFormNavGuard();
    }
  }

  function addStructure(structureId: string) {
    setStructurePickerVisible(false);
    if (structureId === MANUAL_STRUCTURE_ID) {
      setStructureLines((current) => [
        ...current,
        emptyManualStructureLine({
          id: createId(),
          vatPercent: settings.vatPercent,
          pricesIncludeVat,
        }),
      ]);
      return;
    }
    const structure = structures.find((item) => item.id === structureId);
    if (!structure) return;
    setStructureLines((current) => [
      ...current,
      emptyStructureLine({
        id: createId(),
        structure,
        vatPercent: settings.vatPercent,
        pricesIncludeVat,
      }),
    ]);
  }

  async function saveCustomerRecord(updateOldCalculations: boolean) {
    const info = buildCustomerInfo();
    let nextId = customerId;
    if (nextId) {
      await db.upsertCustomer(customerFromInfo(nextId, info));
      if (updateOldCalculations) {
        await db.updateCalculationCustomerSnapshots(
          nextId,
          info.name,
          serializeCustomerDetails(info),
        );
      }
    } else {
      nextId = createId();
      await db.upsertCustomer(customerFromInfo(nextId, info));
      setCustomerId(nextId);
    }
    await refreshCustomers();
    return nextId;
  }

  async function finishCalculation(updateOldCalculations = false, prompted = false) {
    const info = buildCustomerInfo();
    if (!info.name) {
      showAlert('Virhe', 'Anna asiakkaan nimi.');
      return;
    }
    if (structureLines.length === 0) {
      showAlert('Virhe', 'Lisää vähintään yksi tuoterakenne.');
      return;
    }
    const incompleteLine = structureLines.find((line) =>
      isStructureFormIncomplete(
        line,
        structures.find((item) => item.id === line.structureId),
      ),
    );
    if (incompleteLine) {
      showAlert('Lomake kesken', 'Täytä tuoterakenteen lomake ennen yhteenvetoa.');
      return;
    }
    if (
      structureLines.some((line) => materialQuantitiesBlockFinish(line.materialQuantities)) ||
      Object.keys(materialIssues).length > 0
    ) {
      showAlert('Materiaalit', 'Tarkista materiaalimäärät ennen yhteenvetoa.');
      return;
    }

    if (customerId && !prompted) {
      const existing = customers.find((item) => item.id === customerId);
      if (existing && !customerSnapshotEquals(existing, info)) {
        setUpdateCalcsVisible(true);
        return;
      }
    }

    if (savingRef.current || saveGate.isFinishing()) return;
    savingRef.current = true;

    try {
      await saveGate.finish(async () => {
        const savedCustomerId = await saveCustomerRecord(updateOldCalculations);
        const savedId =
          firstNonEmptyId(
            routeEditId,
            boundCalculationIdRef.current,
            editCalculationId,
            wizardDraft?.editCalculationId,
          ) ?? createId();
        const createdAt = originalCreatedAtRef.current ?? originalCreatedAt ?? new Date();
        bindExistingCalculation(savedId, createdAt, editFormVersion);
        const previous = await db.getCalculation(savedId);
        const built = preserveCalculationSnapshot(
          buildCalculationRecordFromComposer({
            id: savedId,
            customer: info,
            customerId: savedCustomerId,
            deliveryScheduleText,
            travelTimeOneWay,
            structureLines,
            settings,
            products,
            structures,
            createdAt,
          }),
          previous?.formSnapshot,
        );
        const priced =
          info.customerType === 'business' ? calculationWithBusinessVatMode(built, businessVatMode) : built;
        const record = applySiteAddressSnapshot(
          applyRefreshedStructurePrices(priced),
          siteAddress,
          siteAddressTouched,
        );
        await db.saveCalculation(record);
        await db.clearWizardDraft();
        await refreshCalculations();
        await refreshWizardDraft();
        hydratedRef.current = false;
        screenLeave.allowOnce(() => {
          applyPreventRemove(false);
          resetToHistoryDetail(navigation, savedId);
        });
      });
    } catch (error) {
      console.error(error);
      showAlert('Virhe', 'Laskelman tallennus epäonnistui.');
    } finally {
      savingRef.current = false;
    }
  }

  const hasIncompleteForm = structureLines.some((line) =>
    isStructureFormIncomplete(
      line,
      structures.find((item) => item.id === line.structureId),
    ),
  );
  const hasInvalidMaterials =
    Object.keys(materialIssues).length > 0 ||
    structureLines.some((line) => materialQuantitiesBlockFinish(line.materialQuantities));

  function handleComposerBack() {
    void leaveKeepingDraft(() => router.back());
  }

  const customerSummary = customerName.trim()
    ? `${customerName.trim()}${customerPostalLocality.trim() ? `\n${customerPostalLocality.trim()}` : ''}`
    : 'Lisää asiakas';

  return (
    <>
      <Stack.Screen
        options={{
          title:
            routeEditId || boundCalculationIdRef.current || editCalculationId
              ? 'Muokkaa laskelmaa'
              : 'Laskenta',
          ...exitStackScreenOptions(handleComposerBack, composerDirty),
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SectionTitle title="Asiakas" />
          <AppCard onPress={() => void openCustomer()}>
            <View style={styles.customerRow}>
              <Text style={styles.customerText}>{customerSummary}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </AppCard>

          <AppInput
            label="Kohteen osoite"
            value={siteAddress}
            onChangeText={(value) => {
              setSiteAddressTouched(true);
              setSiteAddress(value);
            }}
            kind="sentence"
            placeholder="Asiakkaan osoite, voit muuttaa"
          />
          <AppInput
            label="Toimitusajankohta"
            value={deliveryScheduleText}
            onChangeText={setDeliveryScheduleText}
            kind="sentence"
            placeholder="Esim. viikko 42"
          />
          <AppInput
            label="Matka-aika yhteen suuntaan"
            value={travelTimeOneWay}
            onChangeText={setTravelTimeOneWay}
            kind="decimal"
            placeholder="Esim. 0,75"
            trailing={<Text style={styles.unitHint}>h</Text>}
          />

          <SectionTitle title="Tuoterakenteet" />
          {showBusinessVatChoice ? (
            <ChoiceToggle
              label="Hintojen ALV"
              value={businessVatMode}
              options={[
                { value: 'alv0', label: 'ALV 0' },
                { value: 'sis', label: 'Sis. ALV' },
              ]}
              onChange={setBusinessVatMode}
            />
          ) : null}
          {structureLines.map((line) => (
            <View key={line.id} style={styles.lineBlock}>
              <StructureLineCard
                line={line}
                structure={structures.find((item) => item.id === line.structureId)}
                weatherReserveFactor={settings.weatherReserveFactor}
                forceVat0={forceVat0}
                offerIncludesVat={customerType === 'business' ? businessOfferIncludesVat : undefined}
                onChange={(next) =>
                  setStructureLines((current) =>
                    current.map((item) => (item.id === next.id ? next : item)),
                  )
                }
                onOpenForm={() => void openLineForm(line.id)}
                onDelete={() => setDeleteLineId(line.id)}
                showAdditionalInfo={structureRowShowsAdditionalInfo(structureLines, line.id, structures)}
              />
              <MaterialQuantitiesEditor
                line={line}
                form={structures.find((item) => item.id === line.structureId)?.form}
                products={products}
                onChange={(next) =>
                  setStructureLines((current) =>
                    current.map((item) => (item.id === next.id ? next : item)),
                  )
                }
                onValidityChange={setMaterialLineValidity}
              />
            </View>
          ))}

          <OutlinedButton title="Lisää tuoterakenne" onPress={() => setStructurePickerVisible(true)} />
          <PrimaryButton
            title="Yhteenveto"
            onPress={() => void finishCalculation(false)}
            disabled={hasIncompleteForm || hasInvalidMaterials}
          />
          <OutlinedButton
            title="Tallenna ja sulje"
            onPress={() => {
              if (hasIncompleteForm || hasInvalidMaterials || structureLines.length === 0) {
                void saveDraftAndExit();
                return;
              }
              void finishCalculation(false);
            }}
          />
          {hasIncompleteForm ? (
            <Text style={styles.incompleteHint}>
              Täytä keskeneräiset lomakkeet ennen yhteenvetoa.
            </Text>
          ) : null}
          {hasInvalidMaterials ? (
            <Text style={styles.incompleteHint}>Tarkista materiaalimäärät ennen yhteenvetoa.</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={structurePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setStructurePickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalDismiss} onPress={() => setStructurePickerVisible(false)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Valitse tuoterakenne</Text>
            <Pressable
              onPress={() => addStructure(MANUAL_STRUCTURE_ID)}
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
            >
              <Text style={styles.optionText}>Ei pohjaa</Text>
            </Pressable>
            {structures.map((structure) => (
              <Pressable
                key={structure.id}
                onPress={() => addStructure(structure.id)}
                style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              >
                <Text style={styles.optionText}>{structure.name}</Text>
              </Pressable>
            ))}
            {structures.length === 0 ? (
              <Text style={styles.modalHelp}>
                Ei tuoterakenteita. Voit lisätä tyhjän rivin tai luoda rakenteen asetuksista.
              </Text>
            ) : null}
            <OutlinedButton title="Peruuta" onPress={() => setStructurePickerVisible(false)} />
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={Boolean(deleteLineId)}
        title="Poista rivi?"
        message="Tuoterakennerivi poistetaan tästä laskelmasta."
        onClose={() => setDeleteLineId(null)}
        buttons={[
          { title: 'Peruuta', variant: 'outlined', onPress: () => setDeleteLineId(null) },
          {
            title: 'Poista',
            variant: 'destructive',
            onPress: () => {
              setStructureLines((current) => current.filter((item) => item.id !== deleteLineId));
              setDeleteLineId(null);
            },
          },
        ]}
      />

      <UpdateOldCalculationsDialog
        visible={updateCalcsVisible}
        onClose={() => setUpdateCalcsVisible(false)}
        onKeepOld={() => {
          setUpdateCalcsVisible(false);
          void finishCalculation(false, true);
        }}
        onUpdate={() => {
          setUpdateCalcsVisible(false);
          void finishCalculation(true, true);
        }}
      />

    </>
  );
}

function hydrateLines(
  form: WizardFormState,
  structures: ProductStructure[],
  vatPercent: number,
): StructureLine[] {
  if (form.structureLines && form.structureLines.length > 0) {
    return form.structureLines;
  }
  if (hasFieldValueContent(form.fieldValues) && structures[0]) {
    return [
      {
        ...emptyStructureLine({
          id: `legacy-${structures[0].id}`,
          structure: structures[0],
          vatPercent,
        }),
        fieldValues: form.fieldValues,
      },
    ];
  }
  return [];
}

function createStyles(colors: AppColorPalette) {
  return {
    container: {
      flex: 1,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
      gap: 10,
    },
    lineBlock: {
      gap: 8,
    },
    customerRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
    },
    customerText: {
      flex: 1,
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.primary,
      fontSize: 16,
    },
    chevron: {
      fontSize: 22,
      color: colors.accent,
    },
    unitHint: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 15,
      color: colors.text,
      paddingRight: 12,
    },
    incompleteHint: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      color: colors.accent,
      marginTop: -4,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center' as const,
      padding: 20,
    },
    modalDismiss: {
      ...StyleSheet.absoluteFillObject,
    },
    modalCard: {
      backgroundColor: colors.secondary,
      borderRadius: 8,
      padding: 16,
      gap: 10,
    },
    modalTitle: {
      fontFamily: 'IBMPlexSans_700Bold',
      fontSize: 18,
      color: colors.primary,
    },
    modalHelp: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
    },
    option: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    optionPressed: {
      opacity: 0.75,
    },
    optionText: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.text,
    },
  };
}

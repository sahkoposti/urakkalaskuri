import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
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

import { StructureLineCard } from '@/src/components/calculation/StructureLineCard';
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
import { createId } from '@/src/core/utils/id';
import { buildCalculationRecordFromComposer } from '@/src/core/wizard/buildCalculationRecord';
import { calculationToFormState } from '@/src/core/wizard/calculationToWizard';
import {
  buildPersistedWizardDraft,
  composerHasUnsavedChanges,
  composerStateSignature,
  firstNonEmptyId,
  mergeWizardDraftEditMeta,
  persistedDraftToFormState,
  shouldKeepResumeDraftOnLeave,
  type WizardDraftEditMeta,
  type WizardFormState,
} from '@/src/core/wizard/wizardDraftHelpers';
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
  const [structureLines, setStructureLines] = useState<StructureLine[]>([]);
  const [structurePickerVisible, setStructurePickerVisible] = useState(false);
  const [deleteLineId, setDeleteLineId] = useState<string | null>(null);
  const [updateCalcsVisible, setUpdateCalcsVisible] = useState(false);
  const [exitDialogVisible, setExitDialogVisible] = useState(false);

  const hydratedRef = useRef(false);
  const loadedEditIdRef = useRef<string | null>(null);
  const allowExitRef = useRef(false);
  const pendingExitRef = useRef<(() => void) | null>(null);
  const lastDraftUpdatedAtRef = useRef<number | null>(null);
  const boundCalculationIdRef = useRef<string | null>(null);
  const originalCreatedAtRef = useRef<Date | null>(null);
  const savingRef = useRef(false);
  const savedSignatureRef = useRef<string | null>(null);
  const originSignatureRef = useRef<string | null>(null);
  const resumedIncompleteDraftRef = useRef(false);
  const wizardDraftRef = useRef(wizardDraft);
  wizardDraftRef.current = wizardDraft;

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
      structureLines,
    };
  }
  const getFormStateRef = useRef(getFormState);
  getFormStateRef.current = getFormState;

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

  function allowComposerExit() {
    allowExitRef.current = true;
    applyPreventRemove(false);
  }

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
    await db.saveWizardDraft(buildPersistedWizardDraft(state, meta, wizardDraft));
    await refreshWizardDraft();
    markComposerSaved(state);
  }

  function applyFormState(form: WizardFormState) {
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
    const lines = hydrateLines(form, structures, settings.vatPercent);
    setStructureLines(lines);
    markComposerSaved({ ...form, structureLines: lines });
  }

  function restoreDraftForm(draft: NonNullable<typeof wizardDraft>, resumedIncomplete: boolean) {
    lastDraftUpdatedAtRef.current = draft.updatedAt;
    const { form } = persistedDraftToFormState(draft, products);
    bindExistingCalculation(draft.editCalculationId, draft.originalCreatedAt, draft.editFormVersion);
    applyFormState(form);
    resumedIncompleteDraftRef.current = resumedIncomplete;
    if (resumedIncomplete) {
      rememberOrigin(form);
    }
  }

  useFocusEffect(
    useCallback(() => {
      allowExitRef.current = false;

      if (routeEditId) {
        bindExistingCalculation(routeEditId);
        if (loadedEditIdRef.current === routeEditId) {
          return;
        }
        loadedEditIdRef.current = routeEditId;

        if (wizardDraft?.editCalculationId === routeEditId) {
          hydratedRef.current = true;
          restoreDraftForm(wizardDraft, true);
          return;
        }

        let active = true;
        (async () => {
          const record = await db.getCalculation(routeEditId);
          if (!active || !record) return;
          hydratedRef.current = true;
          resumedIncompleteDraftRef.current = false;
          const { form } = calculationToFormState(record, products);
          bindExistingCalculation(
            record.id,
            record.createdAt,
            record.formSnapshot?.formVersion ?? null,
          );
          applyFormState(form);
          rememberOrigin({
            ...form,
            structureLines: hydrateLines(form, structures, settings.vatPercent),
          });
        })();
        return () => {
          active = false;
        };
      }

      loadedEditIdRef.current = null;

      if (wizardDraft) {
        hydratedRef.current = true;
        restoreDraftForm(wizardDraft, true);
        return;
      }

      if (!hydratedRef.current) {
        resumedIncompleteDraftRef.current = false;
        rememberOrigin(getFormStateRef.current());
        hydratedRef.current = true;
      }
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

  function closeExitDialog() {
    setExitDialogVisible(false);
    pendingExitRef.current = null;
  }

  function confirmExit(onLeave: () => void) {
    pendingExitRef.current = onLeave;
    setExitDialogVisible(true);
  }

  async function discardDraftAndExit() {
    await db.clearWizardDraft();
    await refreshWizardDraft();
    allowComposerExit();
    const action = pendingExitRef.current;
    closeExitDialog();
    action?.();
  }

  async function saveDraftAndExit() {
    await persistDraft();
    allowComposerExit();
    const action = pendingExitRef.current;
    closeExitDialog();
    action?.();
  }

  async function leaveWithoutResumeDraft(onLeave: () => void) {
    if (!shouldKeepResumeDraft(getFormStateRef.current())) {
      await db.clearWizardDraft();
      await refreshWizardDraft();
    }
    allowComposerExit();
    onLeave();
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowExitRef.current) {
        return;
      }
      if (isComposerDirty()) {
        event.preventDefault();
        confirmExit(() => navigation.dispatch(event.data.action));
        return;
      }
      if (shouldKeepResumeDraft() || !wizardDraftRef.current) {
        return;
      }
      event.preventDefault();
      void leaveWithoutResumeDraft(() => navigation.dispatch(event.data.action));
    });
    return unsubscribe;
  });

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (allowExitRef.current) return false;
        if (isComposerDirty(getFormStateRef.current())) {
          confirmExit(() => {
            allowComposerExit();
            router.back();
          });
          return true;
        }
        if (shouldKeepResumeDraft(getFormStateRef.current()) || !wizardDraftRef.current) return false;
        void leaveWithoutResumeDraft(() => router.back());
        return true;
      });
      return () => subscription.remove();
    }, []),
  );

  async function openCustomer() {
    await persistDraft();
    const editId = firstNonEmptyId(
      routeEditId,
      boundCalculationIdRef.current,
      editCalculationId,
      wizardDraft?.editCalculationId,
    );
    router.push({ pathname: '/wizard/customer', params: editId ? { editId } : {} } as Href);
  }

  async function openLineForm(lineId: string) {
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
  }

  function addStructure(structureId: string) {
    setStructurePickerVisible(false);
    if (structureId === MANUAL_STRUCTURE_ID) {
      setStructureLines((current) => [
        ...current,
        emptyManualStructureLine({
          id: createId(),
          vatPercent: settings.vatPercent,
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

    if (customerId && !prompted) {
      const existing = customers.find((item) => item.id === customerId);
      if (existing && !customerSnapshotEquals(existing, info)) {
        setUpdateCalcsVisible(true);
        return;
      }
    }

    if (savingRef.current) return;
    savingRef.current = true;

    try {
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
      const record = buildCalculationRecordFromComposer({
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
      });
      await db.saveCalculation(record);
      await db.clearWizardDraft();
      await refreshCalculations();
      await refreshWizardDraft();
      hydratedRef.current = false;
      allowComposerExit();
      resetToHistoryDetail(navigation, savedId);
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

  function handleComposerBack() {
    if (allowExitRef.current) {
      router.back();
      return;
    }
    if (isComposerDirty(getFormStateRef.current())) {
      confirmExit(() => {
        allowComposerExit();
        router.back();
      });
      return;
    }
    if (shouldKeepResumeDraft(getFormStateRef.current()) || !wizardDraftRef.current) {
      router.back();
      return;
    }
    void leaveWithoutResumeDraft(() => router.back());
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
            label="Toimitusajankohta"
            value={deliveryScheduleText}
            onChangeText={setDeliveryScheduleText}
            placeholder="Esim. viikko 42"
          />
          <AppInput
            label="Matka-aika yhteen suuntaan"
            value={travelTimeOneWay}
            onChangeText={setTravelTimeOneWay}
            keyboardType="decimal-pad"
            placeholder="Esim. 0,75"
            trailing={<Text style={styles.unitHint}>h</Text>}
          />

          <SectionTitle title="Tuoterakenteet" />
          {structureLines.map((line) => (
            <StructureLineCard
              key={line.id}
              line={line}
              structure={structures.find((item) => item.id === line.structureId)}
              weatherReserveFactor={settings.weatherReserveFactor}
              onChange={(next) =>
                setStructureLines((current) =>
                  current.map((item) => (item.id === next.id ? next : item)),
                )
              }
              onOpenForm={() => void openLineForm(line.id)}
              onDelete={() => setDeleteLineId(line.id)}
            />
          ))}

          <OutlinedButton title="Lisää tuoterakenne" onPress={() => setStructurePickerVisible(true)} />
          <PrimaryButton
            title="Yhteenveto"
            onPress={() => void finishCalculation(false)}
            disabled={hasIncompleteForm}
          />
          {hasIncompleteForm ? (
            <Text style={styles.incompleteHint}>
              Täytä keskeneräiset lomakkeet ennen yhteenvetoa.
            </Text>
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

      <ConfirmDialog
        visible={exitDialogVisible}
        title="Kesken jäänyt laskenta"
        message="Haluatko tallentaa laskennan keskeneräisenä?"
        onClose={closeExitDialog}
        buttons={[
          { title: 'Peruuta', variant: 'outlined', onPress: closeExitDialog },
          {
            title: 'Tallenna keskeneräisenä',
            variant: 'primary',
            onPress: () => {
              void saveDraftAndExit();
            },
          },
          {
            title: 'Poistu tallentamatta',
            variant: 'destructive',
            onPress: () => {
              void discardDraftAndExit();
            },
          },
        ]}
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

import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import {
  OutlinedButton,
  PrimaryButton,
  SectionTitle,
} from '@/src/components/common';
import { CustomerStep } from '@/src/components/form/CustomerStep';
import { MaterialsStep } from '@/src/components/form/MaterialsStep';
import { WizardFieldList } from '@/src/components/form/WizardFieldList';
import {
  CalculationValidationError,
  previewFormContext,
  runFormCalculation,
} from '@/src/core/calculation/calculationPipeline';
import { applyFieldValueChange, resetComputedFieldOverride } from '@/src/core/form/applyFieldValueChange';
import { wizardFieldsForPage, sortedPages } from '@/src/core/form/formDefinitionHelpers';
import {
  formVersionMismatchMessage,
  hasFormVersionMismatch,
} from '@/src/core/form/formVersion';
import type { CustomerInfo, CustomerType, WizardDraft } from '@/src/core/models/types';
import { emptyCustomerInfo } from '@/src/core/models/types';
import { createId } from '@/src/core/utils/id';
import { buildCalculationRecord } from '@/src/core/wizard/buildCalculationRecord';
import { calculationToFormState } from '@/src/core/wizard/calculationToWizard';
import {
  buildPersistedWizardDraft,
  firstNonEmptyId,
  hasWizardDraftContent,
  persistedDraftToFormState,
  type WizardFormState,
} from '@/src/core/wizard/wizardDraftHelpers';
import { validateFormPageWithValues } from '@/src/core/wizard/wizardPageHelpers';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useLiveFormContext } from '@/src/hooks/useLiveFormContext';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function WizardScreen() {
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation();
  const { editId } = useLocalSearchParams<{ editId?: string | string[] }>();
  const routeEditId = firstNonEmptyId(editId);
  const {
    settings,
    products,
    wizardDraft,
    wizardSession,
    formDefinition,
    setWizardSession,
    refreshWizardDraft,
    refreshCalculations,
  } = useApp();
  const { showAlert } = useThemedAlert();
  const pages = useMemo(() => sortedPages(formDefinition), [formDefinition]);
  const stepCount = pages.length;
  const [step, setStep] = useState(0);
  const [editCalculationId, setEditCalculationId] = useState<string | null>(null);
  const [originalCreatedAt, setOriginalCreatedAt] = useState<Date | null>(null);
  const [editFormVersion, setEditFormVersion] = useState<number | null>(null);
  const [versionWarningDismissed, setVersionWarningDismissed] = useState(false);
  const [draft, setDraft] = useState<WizardDraft>({
    customer: emptyCustomerInfo(),
    lines: [],
    crewSize: settings.defaultCrewSize,
    marginPercent: settings.defaultMarginPercent,
    commissionPercent: settings.defaultCommissionPercent,
  });

  const [customerName, setCustomerName] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('private');
  const [reverseVat, setReverseVat] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPostalCode, setCustomerPostalCode] = useState('');
  const [customerPostalLocality, setCustomerPostalLocality] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [duration, setDuration] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const hydratedRef = useRef(false);
  const loadedEditIdRef = useRef<string | null>(null);
  const allowExitRef = useRef(false);
  const pendingExitRef = useRef<(() => void) | null>(null);
  const [exitDialogVisible, setExitDialogVisible] = useState(false);

  function resetWizardForm() {
    setStep(0);
    setEditCalculationId(null);
    setOriginalCreatedAt(null);
    setEditFormVersion(null);
    setVersionWarningDismissed(false);
    setDraft({
      customer: emptyCustomerInfo(),
      lines: [],
      crewSize: settings.defaultCrewSize,
      marginPercent: settings.defaultMarginPercent,
      commissionPercent: settings.defaultCommissionPercent,
    });
    setCustomerName('');
    setCustomerType('private');
    setReverseVat(false);
    setCustomerPhone('');
    setCustomerEmail('');
    setCustomerAddress('');
    setCustomerPostalCode('');
    setCustomerPostalLocality('');
    setCustomerNotes('');
    setDuration('');
    setFieldValues({});
  }

  function applyFormState(form: WizardFormState, restoredDraft: WizardDraft) {
    setStep(form.step);
    setCustomerName(form.customerName);
    setCustomerType(form.customerType);
    setReverseVat(form.reverseVat);
    setCustomerPhone(form.customerPhone);
    setCustomerEmail(form.customerEmail);
    setCustomerAddress(form.customerAddress);
    setCustomerPostalCode(form.customerPostalCode ?? '');
    setCustomerPostalLocality(form.customerPostalLocality ?? '');
    setCustomerNotes(form.customerNotes);
    setDuration(form.duration);
    setFieldValues(form.fieldValues);
    setDraft(restoredDraft);
  }

  useFocusEffect(
    useCallback(() => {
      allowExitRef.current = false;

      if (routeEditId) {
        if (loadedEditIdRef.current === routeEditId) {
          return;
        }
        loadedEditIdRef.current = routeEditId;
        setEditCalculationId(routeEditId);
        setWizardSession(null);
        let active = true;
        (async () => {
          const record = await db.getCalculation(routeEditId);
          if (!active || !record) return;
          hydratedRef.current = true;
          const { form, wizardDraft: restoredDraft } = calculationToFormState(record, products);
          setEditCalculationId(record.id);
          setOriginalCreatedAt(record.createdAt);
          setEditFormVersion(record.formSnapshot?.formVersion ?? null);
          setVersionWarningDismissed(false);
          applyFormState(form, {
            ...restoredDraft,
            marginPercent: settings.defaultMarginPercent,
            commissionPercent: settings.defaultCommissionPercent,
            crewSize: settings.defaultCrewSize,
          });
          await db.saveWizardDraft(
            buildPersistedWizardDraft(form, {
              editCalculationId: record.id,
              originalCreatedAt: record.createdAt,
              editFormVersion: record.formSnapshot?.formVersion ?? null,
            }),
          );
        })();
        return () => {
          active = false;
        };
      }

      loadedEditIdRef.current = null;

      // Paluu yhteenvedosta: palauta aina aktiivinen istunto
      if (wizardSession) {
        hydratedRef.current = true;
        setEditCalculationId(wizardSession.editCalculationId ?? null);
        setOriginalCreatedAt(wizardSession.originalCreatedAt ?? null);
        setEditFormVersion(wizardSession.editFormVersion ?? null);
        applyFormState(wizardSession.form, wizardSession.draft);
        return;
      }

      if (hydratedRef.current) {
        return;
      }

      if (!wizardDraft) {
        hydratedRef.current = false;
        resetWizardForm();
        return;
      }

      hydratedRef.current = true;
      const { form, wizardDraft: restoredDraft } = persistedDraftToFormState(wizardDraft, products);
      setEditCalculationId(wizardDraft.editCalculationId ?? null);
      setOriginalCreatedAt(
        wizardDraft.originalCreatedAt != null ? new Date(wizardDraft.originalCreatedAt) : null,
      );
      setEditFormVersion(wizardDraft.editFormVersion ?? null);
      applyFormState(form, {
        ...restoredDraft,
        crewSize: settings.defaultCrewSize,
        marginPercent: settings.defaultMarginPercent,
        commissionPercent: settings.defaultCommissionPercent,
      });
    }, [routeEditId, wizardDraft, wizardSession, products, settings, formDefinition, setWizardSession]),
  );

  useEffect(() => {
    if (wizardDraft || routeEditId) return;
    setDraft((current) => ({
      ...current,
      crewSize: settings.defaultCrewSize,
      marginPercent: settings.defaultMarginPercent,
      commissionPercent: settings.defaultCommissionPercent,
    }));
  }, [
    settings.defaultCrewSize,
    settings.defaultMarginPercent,
    settings.defaultCommissionPercent,
    wizardDraft,
    routeEditId,
  ]);

  const currentPage = pages[step] ?? pages[0];
  const pageFields = useMemo(
    () => (currentPage ? wizardFieldsForPage(formDefinition, currentPage.id) : []),
    [currentPage, formDefinition],
  );
  const computedValues = useLiveFormContext({
    form: formDefinition,
    fieldValues,
    materialLines: draft.lines,
    products,
    settings,
    legacyDuration: duration,
  });
  const title = useMemo(
    () => `Laskenta (${step + 1}/${stepCount})`,
    [step, stepCount],
  );

  const showFormVersionWarning =
    !versionWarningDismissed &&
    hasFormVersionMismatch(editFormVersion, formDefinition.version);

  const formVersionWarningText =
    editFormVersion != null
      ? formVersionMismatchMessage(editFormVersion, formDefinition.version)
      : null;

  useEffect(() => {
    if (step >= stepCount && stepCount > 0) {
      setStep(stepCount - 1);
    }
  }, [step, stepCount]);

  function getFormState(): WizardFormState {
    return {
      step,
      customerName,
      customerType,
      reverseVat,
      customerPhone,
      customerEmail,
      customerAddress,
      customerPostalCode,
      customerPostalLocality,
      customerNotes,
      duration,
      fieldValues,
      lines: draft.lines,
    };
  }

  async function persistDraft() {
    await db.saveWizardDraft(
      buildPersistedWizardDraft(getFormState(), {
        editCalculationId,
        originalCreatedAt,
        editFormVersion,
      }),
    );
    await refreshWizardDraft();
  }

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
    setWizardSession(null);
    allowExitRef.current = true;
    const action = pendingExitRef.current;
    closeExitDialog();
    action?.();
  }

  async function saveDraftAndExit() {
    await persistDraft();
    allowExitRef.current = true;
    const action = pendingExitRef.current;
    closeExitDialog();
    action?.();
  }

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowExitRef.current || !hasWizardDraftContent(getFormState())) {
        return;
      }

      const editingExisting = Boolean(
        firstNonEmptyId(routeEditId, editCalculationId, wizardDraft?.editCalculationId),
      );
      event.preventDefault();
      if (editingExisting) {
        void persistDraft().then(() => {
          allowExitRef.current = true;
          navigation.dispatch(event.data.action);
        });
        return;
      }

      confirmExit(() => navigation.dispatch(event.data.action));
    });

    return unsubscribe;
  }, [
    navigation,
    step,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    customerPostalCode,
    customerPostalLocality,
    customerNotes,
    duration,
    customerType,
    reverseVat,
    draft.lines,
    fieldValues,
    routeEditId,
    editCalculationId,
    originalCreatedAt,
    editFormVersion,
    wizardDraft?.editCalculationId,
  ]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) {
        setStep((current) => current - 1);
        return true;
      }

      if (!hasWizardDraftContent(getFormState())) {
        return false;
      }

      const editingExisting = Boolean(
        firstNonEmptyId(routeEditId, editCalculationId, wizardDraft?.editCalculationId),
      );
      if (editingExisting) {
        void persistDraft().then(() => {
          allowExitRef.current = true;
          router.back();
        });
        return true;
      }

      confirmExit(() => {
        allowExitRef.current = true;
        router.back();
      });
      return true;
    });

    return () => subscription.remove();
  }, [
    step,
    customerName,
    customerPhone,
    customerEmail,
    customerAddress,
    customerPostalCode,
    customerPostalLocality,
    customerNotes,
    duration,
    customerType,
    reverseVat,
    draft.lines,
    fieldValues,
    routeEditId,
    editCalculationId,
    originalCreatedAt,
    editFormVersion,
    wizardDraft?.editCalculationId,
  ]);

  function showError(message: string) {
    showAlert('Virhe', message);
  }

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

  function validateStep(): boolean {
    if (!currentPage) return false;
    const error = validateFormPageWithValues(
      formDefinition,
      currentPage,
      fieldValues,
      customerName,
      products,
      previewFormContext(formDefinition, fieldValues, draft.lines, products, settings, duration),
      draft.lines,
    );
    if (error) {
      showError(error);
      return false;
    }
    if (currentPage.system === 'customer') {
      setDraft((current) => ({ ...current, customer: buildCustomerInfo() }));
    }
    return true;
  }

  function handleNext() {
    if (!validateStep()) return;

    if (step < stepCount - 1) {
      setStep((current) => current + 1);
      return;
    }

    void finishCalculation();
  }

  async function finishCalculation() {
    const nextDraft: WizardDraft = {
      ...draft,
      customer: buildCustomerInfo(),
      crewSize: settings.defaultCrewSize,
      marginPercent: settings.defaultMarginPercent,
      commissionPercent: settings.defaultCommissionPercent,
    };

    try {
      const { context, result, materialLines } = runFormCalculation({
        form: formDefinition,
        fieldValues,
        materialLines: nextDraft.lines,
        products,
        settings,
        reverseVat: nextDraft.customer.reverseVat,
        legacyDuration: duration,
      });
      nextDraft.groupDurationHours = result.workDurationDays * settings.workdayHours;
      const formState = getFormState();
      const savedId =
        firstNonEmptyId(
          routeEditId,
          editCalculationId,
          wizardDraft?.editCalculationId,
          wizardSession?.editCalculationId,
        ) ?? createId();
      const createdAt = originalCreatedAt ?? new Date();
      const record = buildCalculationRecord({
        id: savedId,
        draft: nextDraft,
        result,
        settings,
        fieldValues: formState.fieldValues,
        formDefinition,
        formContext: context,
        materialLines,
        products,
        createdAt,
        createLineId: createId,
      });
      await db.saveCalculation(record);
      await db.clearWizardDraft();
      await refreshCalculations();
      await refreshWizardDraft();
      setEditCalculationId(savedId);
      setOriginalCreatedAt(createdAt);
      setWizardSession({
        draft: nextDraft,
        result,
        settings,
        form: formState,
        formContext: context,
        materialLines,
        editCalculationId: savedId,
        originalCreatedAt: createdAt,
        editFormVersion: editFormVersion ?? formDefinition.version,
      });
      hydratedRef.current = false;
      allowExitRef.current = true;
      router.push({ pathname: '/history/[id]', params: { id: savedId, from: 'wizard' } });
    } catch (error) {
      if (error instanceof CalculationValidationError) {
        showError(error.message);
      } else {
        showError('Laskenta epäonnistui.');
      }
    }
  }

  function handleBack() {
    setStep((current) => current - 1);
  }

  const [isScrollable, setIsScrollable] = useState(false);
  const scrollViewHeightRef = useRef(0);
  const contentHeightRef = useRef(0);

  function updateScrollable() {
    setIsScrollable(contentHeightRef.current > scrollViewHeightRef.current + 1);
  }

  useEffect(() => {
    setIsScrollable(false);
    scrollViewHeightRef.current = 0;
    contentHeightRef.current = 0;
  }, [step, currentPage?.id]);

  const nextButtonTitle = step === stepCount - 1 ? 'Laske' : 'Seuraava';

  return (
    <>
      <Stack.Screen options={{ title: routeEditId || editCalculationId ? 'Muokkaa laskelmaa' : title }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onLayout={(event) => {
            scrollViewHeightRef.current = event.nativeEvent.layout.height;
            updateScrollable();
          }}
          onContentSizeChange={(_, height) => {
            contentHeightRef.current = height;
            updateScrollable();
          }}
        >
          <SectionTitle title={currentPage?.title ?? 'Laskenta'} center />

          {showFormVersionWarning && formVersionWarningText ? (
            <View style={styles.versionWarning}>
              <Text style={styles.versionWarningTitle}>Lomakepohja on muuttunut</Text>
              <Text style={styles.versionWarningText}>{formVersionWarningText}</Text>
              <Pressable
                onPress={() => setVersionWarningDismissed(true)}
                style={({ pressed }) => [
                  styles.versionWarningDismiss,
                  pressed && styles.versionWarningDismissPressed,
                ]}
              >
                <Text style={styles.versionWarningDismissText}>Ymmärsin</Text>
              </Pressable>
            </View>
          ) : null}

          <WizardActionBar
            step={step}
            nextTitle={nextButtonTitle}
            onBack={handleBack}
            onNext={handleNext}
          />

          <View style={styles.stepContent}>
            {currentPage?.system === 'customer' && (
              <CustomerStep
                name={customerName}
                customerType={customerType}
                reverseVat={reverseVat}
                phone={customerPhone}
                email={customerEmail}
                address={customerAddress}
                postalCode={customerPostalCode}
                postalLocality={customerPostalLocality}
                notes={customerNotes}
                onNameChange={setCustomerName}
                onCustomerTypeChange={(type) => {
                  setCustomerType(type);
                  if (type === 'private') {
                    setReverseVat(false);
                  }
                }}
                onReverseVatChange={setReverseVat}
                onPhoneChange={setCustomerPhone}
                onEmailChange={setCustomerEmail}
                onAddressChange={setCustomerAddress}
                onPostalCodeChange={setCustomerPostalCode}
                onPostalLocalityChange={setCustomerPostalLocality}
                onNotesChange={setCustomerNotes}
              />
            )}
            {currentPage?.system === 'materials' && (
              <MaterialsStep
                lines={draft.lines}
                products={products}
                onChange={(lines) => setDraft((current) => ({ ...current, lines }))}
              />
            )}
            {currentPage ? (
              <WizardFieldList
                form={formDefinition}
                fields={pageFields}
                fieldValues={fieldValues}
                computedValues={computedValues}
                products={products}
                onChange={(key, value) =>
                  setFieldValues((current) => applyFieldValueChange(formDefinition, current, key, value))
                }
                onResetOverride={(key) =>
                  setFieldValues((current) => resetComputedFieldOverride(current, key))
                }
              />
            ) : null}
          </View>

          {isScrollable ? (
            <WizardActionBar
              step={step}
              nextTitle={nextButtonTitle}
              onBack={handleBack}
              onNext={handleNext}
              style={styles.actionBarBottom}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmDialog
        visible={exitDialogVisible}
        title="Kesken jäänyt laskenta"
        message="Haluatko tallentaa laskennan keskeneräisenä?"
        onClose={closeExitDialog}
        buttons={[
          {
            title: 'Peruuta',
            variant: 'outlined',
            onPress: closeExitDialog,
          },
          {
            title: 'Hylkää',
            variant: 'destructive',
            onPress: () => {
              void discardDraftAndExit();
            },
          },
          {
            title: 'Tallenna',
            variant: 'primary',
            onPress: () => {
              void saveDraftAndExit();
            },
          },
        ]}
      />
    </>
  );
}

type WizardActionBarProps = {
  step: number;
  nextTitle: string;
  onBack: () => void;
  onNext: () => void;
  style?: StyleProp<ViewStyle>;
};

function WizardActionBar({ step, nextTitle, onBack, onNext, style }: WizardActionBarProps) {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.actionBar, style]}>
      {step > 0 ? (
        <View style={styles.actionButton}>
          <OutlinedButton title="Edellinen" onPress={onBack} />
        </View>
      ) : null}
      <View style={[styles.actionButton, step === 0 && styles.actionButtonFull]}>
        <PrimaryButton title={nextTitle} onPress={onNext} />
      </View>
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    container: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 32,
    },
    versionWarning: {
      marginTop: 12,
      marginBottom: 4,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 5,
      backgroundColor: colors.surface,
      gap: 8,
    },
    versionWarningTitle: {
      fontFamily: 'IBMPlexSans_700Bold',
      fontSize: 15,
      color: colors.accent,
    },
    versionWarningText: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      lineHeight: 20,
      color: colors.text,
    },
    versionWarningDismiss: {
      alignSelf: 'flex-start' as const,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    versionWarningDismissPressed: {
      opacity: 0.85,
    },
    versionWarningDismissText: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 13,
      color: colors.accent,
    },
    actionBar: {
      flexDirection: 'row' as const,
      gap: 12,
      marginTop: 20,
      marginBottom: 8,
    },
    actionBarBottom: {
      marginTop: 24,
      marginBottom: 0,
    },
    actionButton: {
      flex: 1,
    },
    actionButtonFull: {
      flex: 1,
    },
    stepContent: {
      marginTop: 16,
    },
  };
}

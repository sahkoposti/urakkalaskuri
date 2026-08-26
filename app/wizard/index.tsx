import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import {
  AppInput,
  OutlinedButton,
  PrimaryButton,
  SectionTitle,
} from '@/src/components/common';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { WizardFieldList } from '@/src/components/form/WizardFieldList';
import {
  CalculationValidationError,
  previewFormContext,
  runFormCalculation,
} from '@/src/core/calculation/calculationPipeline';
import { fieldsForPage, sortedPages } from '@/src/core/form/formDefinitionHelpers';
import {
  formVersionMismatchMessage,
  hasFormVersionMismatch,
} from '@/src/core/form/formVersion';
import type { CustomerInfo, CustomerType, WizardDraft } from '@/src/core/models/types';
import { emptyCustomerInfo } from '@/src/core/models/types';
import { calculationToFormState } from '@/src/core/wizard/calculationToWizard';
import {
  buildPersistedWizardDraft,
  hasWizardDraftContent,
  persistedDraftToFormState,
  type WizardFormState,
} from '@/src/core/wizard/wizardDraftHelpers';
import { validateFormPageWithValues } from '@/src/core/wizard/wizardPageHelpers';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { AppColors } from '@/src/theme/colors';

export default function WizardScreen() {
  const navigation = useNavigation();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { settings, products, wizardDraft, wizardSession, formDefinition, setWizardSession, refreshWizardDraft } = useApp();
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
  const [customerNotes, setCustomerNotes] = useState('');
  const [duration, setDuration] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const hydratedRef = useRef(false);
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
    setCustomerNotes(form.customerNotes);
    setDuration(form.duration);
    setFieldValues(form.fieldValues);
    setDraft(restoredDraft);
  }

  useFocusEffect(
    useCallback(() => {
      allowExitRef.current = false;

      if (editId) {
        let active = true;
        (async () => {
          const record = await db.getCalculation(editId);
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
        })();
        return () => {
          active = false;
        };
      }

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
      applyFormState(form, {
        ...restoredDraft,
        crewSize: settings.defaultCrewSize,
        marginPercent: settings.defaultMarginPercent,
        commissionPercent: settings.defaultCommissionPercent,
      });
    }, [editId, wizardDraft, wizardSession, products, settings, formDefinition]),
  );

  useEffect(() => {
    if (wizardDraft || editId) return;
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
    editId,
  ]);

  const currentPage = pages[step] ?? pages[0];
  const pageFields = useMemo(
    () => (currentPage ? fieldsForPage(formDefinition, currentPage.id) : []),
    [currentPage, formDefinition],
  );
  const computedValues = useMemo(
    () =>
      previewFormContext(formDefinition, fieldValues, draft.lines, products, settings, duration),
    [formDefinition, fieldValues, draft.lines, products, settings, duration],
  );
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
      customerNotes,
      duration,
      fieldValues,
      lines: draft.lines,
    };
  }

  async function persistDraft() {
    await db.saveWizardDraft(buildPersistedWizardDraft(getFormState()));
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
      if (editId || allowExitRef.current || !hasWizardDraftContent(getFormState())) {
        return;
      }

      event.preventDefault();
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
    customerNotes,
    duration,
    customerType,
    reverseVat,
    draft.lines,
    fieldValues,
    editId,
  ]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 0) {
        setStep((current) => current - 1);
        return true;
      }

      if (editId || !hasWizardDraftContent(getFormState())) {
        return false;
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
    customerNotes,
    duration,
    customerType,
    reverseVat,
    draft.lines,
    fieldValues,
    editId,
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
      setWizardSession({
        draft: nextDraft,
        result,
        settings,
        form: formState,
        formContext: context,
        materialLines,
        editCalculationId: editCalculationId ?? undefined,
        originalCreatedAt: originalCreatedAt ?? undefined,
        editFormVersion: editFormVersion ?? undefined,
      });
      await db.saveWizardDraft(buildPersistedWizardDraft(formState));
      await refreshWizardDraft();
      hydratedRef.current = false;
      allowExitRef.current = true;
      router.push('/wizard/summary');
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

  return (
    <>
      <Stack.Screen options={{ title: editId ? 'Muokkaa laskelmaa' : title }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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

          <View style={styles.actionBar}>
            {step > 0 ? (
              <View style={styles.actionButton}>
                <OutlinedButton title="Edellinen" onPress={handleBack} />
              </View>
            ) : null}
            <View style={[styles.actionButton, step === 0 && styles.actionButtonFull]}>
              <PrimaryButton
                title={step === stepCount - 1 ? 'Laske' : 'Seuraava'}
                onPress={handleNext}
              />
            </View>
          </View>

          <View style={styles.stepContent}>
            {currentPage?.system === 'customer' && (
              <CustomerStep
                name={customerName}
                customerType={customerType}
                reverseVat={reverseVat}
                phone={customerPhone}
                email={customerEmail}
                address={customerAddress}
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
                onNotesChange={setCustomerNotes}
              />
            )}
            {currentPage && !currentPage.system ? (
              <WizardFieldList
                form={formDefinition}
                fields={pageFields}
                fieldValues={fieldValues}
                computedValues={computedValues}
                products={products}
                onChange={(key, value) =>
                  setFieldValues((current) => {
                    if (!value.trim()) {
                      if (!(key in current)) return current;
                      const next = { ...current };
                      delete next[key];
                      return next;
                    }
                    return { ...current, [key]: value };
                  })
                }
              />
            ) : null}
          </View>
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

type CustomerStepProps = {
  name: string;
  customerType: CustomerType;
  reverseVat: boolean;
  phone: string;
  email: string;
  address: string;
  notes: string;
  onNameChange: (value: string) => void;
  onCustomerTypeChange: (value: CustomerType) => void;
  onReverseVatChange: (value: boolean) => void;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onNotesChange: (value: string) => void;
};

function CustomerStep({
  name,
  customerType,
  reverseVat,
  phone,
  email,
  address,
  notes,
  onNameChange,
  onCustomerTypeChange,
  onReverseVatChange,
  onPhoneChange,
  onEmailChange,
  onAddressChange,
  onNotesChange,
}: CustomerStepProps) {
  return (
    <View>
      <AppInput label="Nimi *" value={name} onChangeText={onNameChange} />
      <AppInput
        label="Puh."
        value={phone}
        onChangeText={onPhoneChange}
        keyboardType="phone-pad"
      />
      <AppInput
        label="Sähköposti"
        value={email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
      />
      <AppInput label="Osoite" value={address} onChangeText={onAddressChange} />
      <AppInput
        label="Lisätiedot"
        value={notes}
        onChangeText={onNotesChange}
        multiline
        placeholder="Valinnainen"
      />
      <AppPicker
        label="Asiakastyyppi"
        selectedValue={customerType}
        onValueChange={(value) => onCustomerTypeChange(value as CustomerType)}
        items={[
          { label: 'Yksityisasiakas', value: 'private' },
          { label: 'Yritysasiakas', value: 'business' },
        ]}
      />
      {customerType === 'business' ? (
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Käänteinen arvonlisävero</Text>
          <View style={styles.toggleActions}>
            <Pressable
              style={[
                styles.toggleButton,
                reverseVat && styles.toggleButtonActive,
              ]}
              onPress={() => onReverseVatChange(true)}
            >
              <Text style={[styles.toggleButtonText, reverseVat && styles.toggleButtonTextActive]}>
                Kyllä
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleButton,
                !reverseVat && styles.toggleButtonActive,
              ]}
              onPress={() => onReverseVatChange(false)}
            >
              <Text
                style={[styles.toggleButtonText, !reverseVat && styles.toggleButtonTextActive]}
              >
                Ei
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    borderColor: AppColors.accent,
    borderRadius: 5,
    backgroundColor: AppColors.surface,
    gap: 8,
  },
  versionWarningTitle: {
    fontFamily: 'IBMPlexSans_700Bold',
    fontSize: 15,
    color: AppColors.accent,
  },
  versionWarningText: {
    fontFamily: 'IBMPlexSans_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: AppColors.text,
  },
  versionWarningDismiss: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: AppColors.accent,
  },
  versionWarningDismissPressed: {
    opacity: 0.85,
  },
  versionWarningDismissText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    fontSize: 13,
    color: AppColors.accent,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 8,
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
  toggleRow: {
    marginBottom: 12,
  },
  toggleLabel: {
    marginBottom: 6,
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.text,
  },
  toggleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: AppColors.accent,
    borderRadius: 5,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: AppColors.secondary,
  },
  toggleButtonActive: {
    backgroundColor: AppColors.accent,
  },
  toggleButtonText: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.accent,
  },
  toggleButtonTextActive: {
    color: AppColors.secondary,
  },
});

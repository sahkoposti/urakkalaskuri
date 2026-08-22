import { Picker } from '@react-native-picker/picker';
import { router, Stack, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  AppCard,
  AppInput,
  OutlinedButton,
  PrimaryButton,
  SectionTitle,
} from '@/src/components/common';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import {
  CalculationValidationError,
  runCalculation,
} from '@/src/core/calculation/calculationEngine';
import type { CustomerInfo, Product, WizardDraft, WizardLineDraft } from '@/src/core/models/types';
import { emptyCustomerInfo, materialsTotal, WIZARD_STEP_META } from '@/src/core/models/types';
import { formatCurrency, formatDecimal, parseNumber } from '@/src/core/utils/formatters';
import {
  buildPersistedWizardDraft,
  hasWizardDraftContent,
  persistedDraftToFormState,
  type WizardFormState,
} from '@/src/core/wizard/wizardDraftHelpers';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { AppColors } from '@/src/theme/colors';

export default function WizardScreen() {
  const navigation = useNavigation();
  const { settings, products, wizardDraft, setWizardSession, refreshWizardDraft } = useApp();
  const { showAlert } = useThemedAlert();
  const stepOrder = settings.wizardStepOrder;
  const stepCount = stepOrder.length;
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>({
    customer: emptyCustomerInfo(),
    lines: [],
    crewSize: settings.defaultCrewSize,
    marginPercent: settings.defaultMarginPercent,
    commissionPercent: settings.defaultCommissionPercent,
  });

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [duration, setDuration] = useState('');
  const [margin, setMargin] = useState(String(settings.defaultMarginPercent));
  const [commission, setCommission] = useState(String(settings.defaultCommissionPercent));

  const hydratedRef = useRef(false);
  const allowExitRef = useRef(false);
  const pendingExitRef = useRef<(() => void) | null>(null);
  const [exitDialogVisible, setExitDialogVisible] = useState(false);

  function resetWizardForm() {
    setStep(0);
    setDraft({
      customer: emptyCustomerInfo(),
      lines: [],
      crewSize: settings.defaultCrewSize,
      marginPercent: settings.defaultMarginPercent,
      commissionPercent: settings.defaultCommissionPercent,
    });
    setCustomerName('');
    setCustomerPhone('');
    setCustomerEmail('');
    setCustomerAddress('');
    setCustomerNotes('');
    setDuration('');
    setMargin(String(settings.defaultMarginPercent));
    setCommission(String(settings.defaultCommissionPercent));
  }

  useFocusEffect(
    useCallback(() => {
      allowExitRef.current = false;

      if (!wizardDraft) {
        hydratedRef.current = false;
        resetWizardForm();
        return;
      }

      if (hydratedRef.current) return;
      hydratedRef.current = true;
      const { form, wizardDraft: restoredDraft } = persistedDraftToFormState(wizardDraft, products);
      setStep(form.step);
      setCustomerName(form.customerName);
      setCustomerPhone(form.customerPhone);
      setCustomerEmail(form.customerEmail);
      setCustomerAddress(form.customerAddress);
      setCustomerNotes(form.customerNotes);
      setDuration(form.duration);
      setMargin(form.margin);
      setCommission(form.commission);
      setDraft((current) => ({
        ...current,
        ...restoredDraft,
        crewSize: settings.defaultCrewSize,
      }));
    }, [wizardDraft, products, settings]),
  );

  useEffect(() => {
    if (wizardDraft) return;
    setDraft((current) => ({ ...current, crewSize: settings.defaultCrewSize }));
  }, [settings.defaultCrewSize, wizardDraft]);

  const currentStepId = stepOrder[step] ?? stepOrder[0];
  const title = useMemo(() => `Laskenta (${step + 1}/${stepCount})`, [step, stepCount]);

  function getFormState(): WizardFormState {
    return {
      step,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      customerNotes,
      duration,
      margin,
      commission,
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
    margin,
    commission,
    draft.lines,
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
    margin,
    commission,
    draft.lines,
  ]);

  function showError(message: string) {
    showAlert('Virhe', message);
  }

  function buildCustomerInfo(): CustomerInfo {
    return {
      name: customerName.trim(),
      phone: customerPhone.trim() || undefined,
      email: customerEmail.trim() || undefined,
      address: customerAddress.trim() || undefined,
      notes: customerNotes.trim() || undefined,
    };
  }

  function durationDaysToHours(days: number): number {
    return days * settings.workdayHours;
  }

  function validateStep(): boolean {
    switch (currentStepId) {
      case 'customer':
        if (!customerName.trim()) {
          showError('Anna asiakkaan nimi.');
          return false;
        }
        setDraft((current) => ({ ...current, customer: buildCustomerInfo() }));
        return true;
      case 'duration': {
        const parsed = parseNumber(duration);
        if (parsed === null || parsed <= 0) {
          showError('Anna kelvollinen kesto päivinä.');
          return false;
        }
        setDraft((current) => ({
          ...current,
          groupDurationHours: durationDaysToHours(parsed),
        }));
        return true;
      }
      case 'materials':
        return true;
      case 'margin': {
        const parsed = parseNumber(margin);
        if (parsed === null || parsed < 0) {
          showError('Anna kelvollinen myyntikatetavoite.');
          return false;
        }
        setDraft((current) => ({ ...current, marginPercent: parsed }));
        return true;
      }
      case 'commission': {
        const parsedCommission = parseNumber(commission);
        const parsedMargin = parseNumber(margin) ?? 0;
        if (parsedCommission === null || parsedCommission < 0) {
          showError('Anna kelvollinen myyntipalkkio.');
          return false;
        }
        if (parsedMargin + parsedCommission >= 100) {
          showError('Myyntikate ja myyntipalkkio yhteensä on oltava alle 100 %.');
          return false;
        }
        setDraft((current) => ({ ...current, commissionPercent: parsedCommission }));
        return true;
      }
      default:
        return true;
    }
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
    const durationDays = parseNumber(duration);
    const nextDraft: WizardDraft = {
      ...draft,
      customer: buildCustomerInfo(),
      groupDurationHours:
        durationDays !== null ? durationDaysToHours(durationDays) : draft.groupDurationHours,
      crewSize: settings.defaultCrewSize,
      marginPercent: parseNumber(margin) ?? draft.marginPercent,
      commissionPercent: parseNumber(commission) ?? draft.commissionPercent,
    };

    try {
      const result = runCalculation({
        groupDurationHours: nextDraft.groupDurationHours!,
        crewSize: nextDraft.crewSize!,
        hourlyRate: settings.defaultHourlyRate,
        materialsVat0: materialsTotal(nextDraft.lines),
        marginPercent: nextDraft.marginPercent!,
        commissionPercent: nextDraft.commissionPercent!,
        vatPercent: settings.vatPercent,
        workdayHours: settings.workdayHours,
      });
      setWizardSession({ draft: nextDraft, result, settings });
      await db.clearWizardDraft();
      await refreshWizardDraft();
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
      <Stack.Screen options={{ title }} />
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
          <SectionTitle title={WIZARD_STEP_META[currentStepId].title} center />

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
            {currentStepId === 'customer' && (
              <CustomerStep
                name={customerName}
                phone={customerPhone}
                email={customerEmail}
                address={customerAddress}
                notes={customerNotes}
                onNameChange={setCustomerName}
                onPhoneChange={setCustomerPhone}
                onEmailChange={setCustomerEmail}
                onAddressChange={setCustomerAddress}
                onNotesChange={setCustomerNotes}
              />
            )}
            {currentStepId === 'duration' && (
              <AppInput
                label="Kesto (pv) *"
                value={duration}
                onChangeText={setDuration}
                keyboardType="decimal-pad"
                placeholder="Esim. 1,1"
              />
            )}
            {currentStepId === 'materials' && (
              <MaterialsStep
                products={products}
                lines={draft.lines}
                onChange={(lines) => setDraft((current) => ({ ...current, lines }))}
              />
            )}
            {currentStepId === 'margin' && (
              <AppInput
                label="Kate (%) *"
                value={margin}
                onChangeText={setMargin}
                keyboardType="decimal-pad"
              />
            )}
            {currentStepId === 'commission' && (
              <AppInput
                label="Palkkio (%) *"
                value={commission}
                onChangeText={setCommission}
                keyboardType="decimal-pad"
              />
            )}
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
  phone: string;
  email: string;
  address: string;
  notes: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onNotesChange: (value: string) => void;
};

function CustomerStep({
  name,
  phone,
  email,
  address,
  notes,
  onNameChange,
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
    </View>
  );
}

type MaterialsStepProps = {
  products: Product[];
  lines: WizardLineDraft[];
  onChange: (lines: WizardLineDraft[]) => void;
};

function MaterialsStep({ products, lines, onChange }: MaterialsStepProps) {
  const [selectedId, setSelectedId] = useState<string>('');
  const [quantity, setQuantity] = useState('');

  const selectedProduct = products.find((product) => product.id === selectedId) ?? null;

  function addLine() {
    const parsedQuantity = parseNumber(quantity);
    if (!selectedProduct || parsedQuantity === null || parsedQuantity <= 0) return;
    onChange([...lines, { product: selectedProduct, quantity: parsedQuantity }]);
    setSelectedId('');
    setQuantity('');
  }

  if (products.length === 0) {
    return <Text style={styles.emptyText}>Ei tuotteita. Voit jatkaa ilman materiaalirivejä.</Text>;
  }

  return (
    <View>
      <Text style={styles.inputLabel}>Tuote</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={selectedId} onValueChange={setSelectedId}>
          <Picker.Item label="Valitse tuote..." value="" />
          {products.map((product) => (
            <Picker.Item
              key={product.id}
              label={`${product.name} (${formatCurrency(product.unitPriceVat0)}/${product.unit})`}
              value={product.id}
            />
          ))}
        </Picker>
      </View>
      <AppInput
        label="Määrä"
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="decimal-pad"
      />
      <OutlinedButton title="Lisää rivi" onPress={addLine} />
      <View style={styles.linesWrap}>
        {lines.map((line, index) => (
          <AppCard key={`${line.product.id}-${index}`} style={styles.lineCard}>
            <View style={styles.lineRow}>
              <Text style={styles.lineText}>
                {line.product.name} × {formatDecimal(line.quantity)} {line.product.unit}
              </Text>
              <Text style={styles.linePrice}>
                {formatCurrency(line.quantity * line.product.unitPriceVat0)}
              </Text>
              <Text
                style={styles.removeButton}
                onPress={() => onChange(lines.filter((_, lineIndex) => lineIndex !== index))}
              >
                ×
              </Text>
            </View>
          </AppCard>
        ))}
      </View>
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
  emptyText: {
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_400Regular',
  },
  inputLabel: {
    marginBottom: 6,
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.text,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: 5,
    backgroundColor: AppColors.secondary,
    marginBottom: 12,
    overflow: 'hidden',
  },
  linesWrap: {
    marginTop: 16,
    gap: 8,
  },
  lineCard: {
    marginBottom: 0,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lineText: {
    flex: 1,
    color: AppColors.text,
    fontFamily: 'IBMPlexSans_400Regular',
  },
  linePrice: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.primary,
  },
  removeButton: {
    color: AppColors.accent,
    fontSize: 24,
    paddingHorizontal: 4,
  },
});

import { Picker } from '@react-native-picker/picker';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import {
  CalculationValidationError,
  runCalculation,
} from '@/src/core/calculation/calculationEngine';
import type { Product, WizardDraft, WizardLineDraft } from '@/src/core/models/types';
import { materialsTotal } from '@/src/core/models/types';
import { formatCurrency, formatDecimal, parseNumber } from '@/src/core/utils/formatters';
import { useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

const STEP_TITLES = [
  'Projektin nimi',
  'Asiakas',
  'Työryhmän arvioitu kesto',
  'Työryhmän koko',
  'Materiaalit',
  'Myyntikatetavoite',
  'Myyntipalkkio',
];

export default function WizardScreen() {
  const { settings, products, setWizardSession } = useApp();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<WizardDraft>({
    projectName: '',
    customer: '',
    lines: [],
    crewSize: settings.defaultCrewSize,
    marginPercent: settings.defaultMarginPercent,
    commissionPercent: settings.defaultCommissionPercent,
  });

  const [projectName, setProjectName] = useState('');
  const [customer, setCustomer] = useState('');
  const [duration, setDuration] = useState('');
  const [crewSize, setCrewSize] = useState(String(settings.defaultCrewSize));
  const [margin, setMargin] = useState(String(settings.defaultMarginPercent));
  const [commission, setCommission] = useState(String(settings.defaultCommissionPercent));

  useEffect(() => {
    setCrewSize(String(settings.defaultCrewSize));
    setMargin(String(settings.defaultMarginPercent));
    setCommission(String(settings.defaultCommissionPercent));
  }, [settings]);

  const title = useMemo(() => `Laskenta (${step + 1}/7)`, [step]);

  function showError(message: string) {
    Alert.alert('Virhe', message);
  }

  function validateStep(): boolean {
    switch (step) {
      case 0:
        if (!projectName.trim()) {
          showError('Anna projektin nimi.');
          return false;
        }
        setDraft((current) => ({ ...current, projectName: projectName.trim() }));
        return true;
      case 1:
        setDraft((current) => ({ ...current, customer: customer.trim() }));
        return true;
      case 2: {
        const parsed = parseNumber(duration);
        if (parsed === null || parsed <= 0) {
          showError('Anna kelvollinen kesto tunneissa.');
          return false;
        }
        setDraft((current) => ({ ...current, groupDurationHours: parsed }));
        return true;
      }
      case 3: {
        const parsed = Number.parseInt(crewSize, 10);
        if (!Number.isFinite(parsed) || parsed <= 0) {
          showError('Anna kelvollinen työryhmän koko.');
          return false;
        }
        setDraft((current) => ({ ...current, crewSize: parsed }));
        return true;
      }
      case 4:
        return true;
      case 5: {
        const parsed = parseNumber(margin);
        if (parsed === null || parsed < 0) {
          showError('Anna kelvollinen myyntikatetavoite.');
          return false;
        }
        setDraft((current) => ({ ...current, marginPercent: parsed }));
        return true;
      }
      case 6: {
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

    if (step < 6) {
      setStep((current) => current + 1);
      return;
    }

    const nextDraft: WizardDraft = {
      ...draft,
      projectName: projectName.trim(),
      customer: customer.trim(),
      groupDurationHours: parseNumber(duration) ?? draft.groupDurationHours,
      crewSize: Number.parseInt(crewSize, 10),
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
      router.push('/wizard/summary');
    } catch (error) {
      if (error instanceof CalculationValidationError) {
        showError(error.message);
      } else {
        showError('Laskenta epäonnistui.');
      }
    }
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <SectionTitle title={STEP_TITLES[step]} center />
          <View style={styles.stepContent}>
            {step === 0 && (
              <AppInput label="Projektin nimi *" value={projectName} onChangeText={setProjectName} />
            )}
            {step === 1 && (
              <AppInput
                label="Asiakas (valinnainen)"
                value={customer}
                onChangeText={setCustomer}
              />
            )}
            {step === 2 && (
              <AppInput
                label="Kesto (h) *"
                value={duration}
                onChangeText={setDuration}
                keyboardType="decimal-pad"
              />
            )}
            {step === 3 && (
              <AppInput
                label="Henkilömäärä *"
                value={crewSize}
                onChangeText={setCrewSize}
                keyboardType="numeric"
              />
            )}
            {step === 4 && (
              <MaterialsStep
                products={products}
                lines={draft.lines}
                onChange={(lines) => setDraft((current) => ({ ...current, lines }))}
              />
            )}
            {step === 5 && (
              <AppInput
                label="Kate (%) *"
                value={margin}
                onChangeText={setMargin}
                keyboardType="decimal-pad"
              />
            )}
            {step === 6 && (
              <AppInput
                label="Palkkio (%) *"
                value={commission}
                onChangeText={setCommission}
                keyboardType="decimal-pad"
              />
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 && (
            <View style={styles.footerButton}>
              <OutlinedButton title="Takaisin" onPress={() => setStep((current) => current - 1)} />
            </View>
          )}
          <View style={styles.footerButton}>
            <PrimaryButton title={step === 6 ? 'Laske' : 'Seuraava'} onPress={handleNext} />
          </View>
        </View>
      </View>
    </>
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
    paddingBottom: 12,
  },
  stepContent: {
    marginTop: 24,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 12,
  },
  footerButton: {
    flex: 1,
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

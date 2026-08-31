import { Pressable, Text, View } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import { AppCard, AppInput, OutlinedButton, ResultRow } from '@/src/components/common';
import { materialLinesTotal } from '@/src/core/form/fieldEffects';
import type { Product, WizardLineDraft } from '@/src/core/models/types';
import { formatCurrency, parseNumber } from '@/src/core/utils/formatters';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type MaterialsStepProps = {
  lines: WizardLineDraft[];
  products: Product[];
  onChange: (lines: WizardLineDraft[]) => void;
};

export function MaterialsStep({ lines, products, onChange }: MaterialsStepProps) {
  const styles = useThemedStyles(createStyles);

  function updateLine(index: number, patch: Partial<WizardLineDraft>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    onChange(lines.filter((_, i) => i !== index));
  }

  function addLine() {
    const product = products[0];
    if (!product) return;
    onChange([...lines, { product, quantity: 1 }]);
  }

  const total = materialLinesTotal(lines);

  if (products.length === 0) {
    return (
      <Text style={styles.emptyHint}>
        Ei tuotteita tuoterekisterissä. Lisää tuotteita asetuksista ennen materiaalirivejä.
      </Text>
    );
  }

  return (
    <View>
      {lines.length === 0 ? (
        <Text style={styles.emptyHint}>Ei materiaalirivejä. Lisää rivi alla olevasta painikkeesta.</Text>
      ) : (
        lines.map((line, index) => {
          const lineTotal = line.quantity * line.product.unitPriceVat0;
          return (
            <AppCard key={`${line.product.id}-${index}`} style={styles.lineCard}>
              <View style={styles.lineHeader}>
                <Text style={styles.lineTitle}>Rivi {index + 1}</Text>
                <Pressable onPress={() => removeLine(index)} hitSlop={8}>
                  <Text style={styles.removeText}>Poista</Text>
                </Pressable>
              </View>
              <Text style={styles.inputLabel}>Tuote *</Text>
              <AppPicker
                selectedValue={line.product.id}
                onValueChange={(productId) => {
                  const product = products.find((item) => item.id === productId);
                  if (product) updateLine(index, { product });
                }}
                items={products.map((product) => ({
                  value: product.id,
                  label: `${product.name} (${formatCurrency(product.unitPriceVat0)}/${product.unit})`,
                }))}
              />
              <AppInput
                label={`Määrä (${line.product.unit}) *`}
                value={line.quantity > 0 ? String(line.quantity).replace('.', ',') : ''}
                onChangeText={(value) => {
                  const parsed = parseNumber(value);
                  updateLine(index, { quantity: parsed ?? 0 });
                }}
                keyboardType="decimal-pad"
                placeholder="Esim. 10"
              />
              <Text style={styles.lineMeta}>
                {line.product.name} · {formatCurrency(line.product.unitPriceVat0)}/{line.product.unit}
              </Text>
              <ResultRow label="Rivin summa (alv0)" value={formatCurrency(lineTotal)} />
            </AppCard>
          );
        })
      )}

      <OutlinedButton title="Lisää materiaalirivi" onPress={addLine} />

      <AppCard style={styles.totalCard}>
        <ResultRow label="Materiaalit yhteensä (alv0)" value={formatCurrency(total)} highlight />
      </AppCard>
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    emptyHint: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      lineHeight: 20,
      marginBottom: 12,
    },
    lineCard: {
      marginBottom: 12,
      gap: 4,
    },
    lineHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      marginBottom: 4,
    },
    lineTitle: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.primary,
      fontSize: 15,
    },
    removeText: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.accent,
      fontSize: 14,
    },
    inputLabel: {
      marginTop: 4,
      marginBottom: 6,
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.text,
    },
    lineMeta: {
      marginTop: -4,
      marginBottom: 4,
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 13,
    },
    totalCard: {
      marginTop: 16,
    },
  };
}

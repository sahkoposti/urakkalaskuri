import { router, Stack, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { AppCard, PrimaryButton, ScreenLoading } from '@/src/components/common';
import { runDebugPipeline } from '@/src/core/form/pipeline';
import type { FormDebugSettings } from '@/src/core/form/types';
import { formatCurrency, formatDecimal } from '@/src/core/utils/formatters';
import { db, useApp } from '@/src/context/AppContext';
import { AppColors } from '@/src/theme/colors';

export default function FormDebugSettingsScreen() {
  const { ready, formDebug, formDefinition, products, settings, formDefaults, refreshFormSettings } = useApp();
  const [debug, setDebug] = useState<FormDebugSettings>(formDebug);

  useEffect(() => {
    setDebug(formDebug);
  }, [formDebug]);

  const preview = useMemo(() => {
    if (!debug.enabled) return null;
    return runDebugPipeline(formDefinition, { products, settings, defaults: formDefaults });
  }, [debug.enabled, formDefinition, products, settings, formDefaults]);

  if (!ready) return <ScreenLoading />;

  async function handleSave() {
    await db.saveFormDebugSettings(debug);
    await refreshFormSettings();
    router.back();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Debug' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <AppCard>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.title}>Debug-tila</Text>
              <Text style={styles.body}>
                Kun päällä, jokaisella syötekentällä voi asettaa esimerkkiarvon. Kaava-asetukset
                näyttävät live-laskennan näiden arvojen pohjalta.
              </Text>
            </View>
            <Switch
              value={debug.enabled}
              onValueChange={(enabled) => setDebug((current) => ({ ...current, enabled }))}
              trackColor={{ true: AppColors.accent, false: AppColors.border }}
            />
          </View>
        </AppCard>

        <AppCard style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.title}>Näytä välivaiheet</Text>
              <Text style={styles.body}>Listaa kaikki laskentavaiheet live-paneelissa.</Text>
            </View>
            <Switch
              value={debug.showIntermediateSteps}
              onValueChange={(showIntermediateSteps) =>
                setDebug((current) => ({ ...current, showIntermediateSteps }))
              }
              trackColor={{ true: AppColors.accent, false: AppColors.border }}
            />
          </View>
        </AppCard>

        {debug.enabled && preview ? (
          <AppCard style={styles.card}>
            <Text style={styles.title}>Live-esikatselu</Text>
            <Text style={styles.body}>
              Perustuu kenttien debug-esimerkkeihin. Avaa kenttä muokataksesi arvoja.
            </Text>
            {preview.errors.length > 0 ? (
              <View style={styles.errorBox}>
                {preview.errors.map((error) => (
                  <Text key={error} style={styles.errorText}>
                    • {error}
                  </Text>
                ))}
              </View>
            ) : null}
            {preview.summaryFields.map((field) => (
              <View key={field.key} style={styles.previewRow}>
                <Text style={styles.previewLabel}>
                  {field.label}
                  {field.unit ? ` (${field.unit})` : ''}
                </Text>
                <Text style={styles.previewValue}>
                  {typeof field.value === 'number' ? formatDecimal(field.value) : String(field.value)}
                </Text>
              </View>
            ))}
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Kesto (h)</Text>
              <Text style={styles.previewValue}>{formatDecimal(preview.groupDurationHours)}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Materiaalit (alv0)</Text>
              <Text style={styles.previewValue}>{formatCurrency(preview.materialsVat0)}</Text>
            </View>
            {preview.materialLines.map((line) => (
              <View key={line.id} style={styles.previewRow}>
                <Text style={styles.previewLabel}>
                  {line.productName} × {formatDecimal(line.quantity)} {line.unit}
                </Text>
                <Text style={styles.previewValue}>{formatCurrency(line.lineTotalVat0)}</Text>
              </View>
            ))}
            <Text
              style={styles.link}
              onPress={() => router.push('/settings/calculation/fields' as Href)}
            >
              Muokkaa esimerkkiarvoja →
            </Text>
          </AppCard>
        ) : null}

        <PrimaryButton title="Tallenna" onPress={handleSave} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    marginTop: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  title: {
    fontFamily: 'IBMPlexSans_700Bold',
    color: AppColors.primary,
    fontSize: 16,
    marginBottom: 6,
  },
  body: {
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  errorBox: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#FFF5F5',
    borderRadius: 5,
  },
  errorText: {
    fontFamily: 'IBMPlexSans_500Medium',
    color: AppColors.accent,
    fontSize: 13,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  previewLabel: {
    flex: 1,
    fontFamily: 'IBMPlexSans_400Regular',
    color: AppColors.text,
    fontSize: 13,
  },
  previewValue: {
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.primary,
    fontSize: 13,
  },
  link: {
    marginTop: 12,
    fontFamily: 'IBMPlexSans_600SemiBold',
    color: AppColors.accent,
  },
});

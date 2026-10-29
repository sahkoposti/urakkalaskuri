import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';

import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import {
  AppInput,
  AppPercentSlider,
  OutlinedButton,
  PrimaryButton,
  ScreenLoading,
  ScreenMessage,
} from '@/src/components/common';
import { SettingsNavCard } from '@/src/components/SettingsNavCard';
import { createDefaultFormDefinition } from '@/src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '@/src/core/form/formDefinitionHelpers';
import { calculationSettingsHref } from '@/src/core/navigation/calculationSettings';
import { parseNumber, formatFixed2 } from '@/src/core/utils/formatters';
import { createId } from '@/src/core/utils/id';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import {
  maxMarginPercent,
  parseCrewSize,
  resolvedStructureMargin,
  structureMarginFromSettings,
} from '@/src/core/structure/structureSettings';
import { normalizeDisplayWorkDurationDays, WORK_DURATION_DISPLAY_LABEL } from '@/src/core/structure/workDurationDisplay';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function ProductStructureDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const structureId = Array.isArray(id) ? id[0] : id;
  const isNew = structureId === 'new';
  const {
    structures,
    settings,
    refreshStructures,
    refreshFormSettings,
    refreshProducts,
  } = useApp();
  const { showAlert } = useThemedAlert();
  const structure = isNew ? undefined : structures.find((item) => item.id === structureId);
  const [name, setName] = useState(isNew ? '' : (structure?.name ?? ''));
  const [commission, setCommission] = useState(
    isNew
      ? String(settings.defaultCommissionPercent).replace('.', ',')
      : structure
        ? String(structure.commissionPercent).replace('.', ',')
        : '',
  );
  const [crewSize, setCrewSize] = useState(
    isNew
      ? String(settings.defaultCrewSize)
      : structure
        ? String(structure.crewSize)
        : '',
  );
  const [hourlyRate, setHourlyRate] = useState(
    isNew ? '' : hourlyRateText(structure?.hourlyRate),
  );
  const initialMargin = isNew
    ? structureMarginFromSettings(settings)
    : structure
      ? resolvedStructureMargin(structure, settings)
      : structureMarginFromSettings(settings);
  const [marginLowAmount, setMarginLowAmount] = useState(String(initialMargin.marginLowAmount));
  const [marginLowPercent, setMarginLowPercent] = useState(initialMargin.marginLowPercent);
  const [marginHighAmount, setMarginHighAmount] = useState(String(initialMargin.marginHighAmount));
  const [marginHighPercent, setMarginHighPercent] = useState(initialMargin.marginHighPercent);
  const [unit, setUnit] = useState(isNew ? '' : (structure?.unit ?? ''));
  const [additionalInfo, setAdditionalInfo] = useState(
    isNew ? '' : (structure?.defaultAdditionalInfo ?? ''),
  );
  const [defaultUnitPrice, setDefaultUnitPrice] = useState(
    isNew ? '' : optionalPriceText(structure?.defaultUnitPriceVat0),
  );
  const [defaultDisplayWorkDuration, setDefaultDisplayWorkDuration] = useState(
    isNew ? '' : optionalDaysText(structure?.defaultDisplayWorkDurationDays),
  );
  const [defaultMaterials, setDefaultMaterials] = useState(
    isNew ? '' : optionalPriceText(structure?.defaultMaterialsVat0),
  );
  const [deleteVisible, setDeleteVisible] = useState(false);
  const savedIdRef = useRef<string | null>(isNew ? null : structureId ?? null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

  function currentSnapshot() {
    return JSON.stringify({
      name: name.trim(),
      commission,
      crewSize,
      hourlyRate,
      marginLowAmount,
      marginLowPercent,
      marginHighAmount,
      marginHighPercent,
      unit: unit.trim(),
      additionalInfo,
      defaultUnitPrice,
      defaultDisplayWorkDuration,
      defaultMaterials,
    });
  }

  useEffect(() => {
    if (isNew || !structure) return;
    setName(structure.name);
    setCommission(String(structure.commissionPercent).replace('.', ','));
    setCrewSize(String(structure.crewSize));
    setHourlyRate(hourlyRateText(structure.hourlyRate));
    const margin = resolvedStructureMargin(structure, settings);
    setMarginLowAmount(String(margin.marginLowAmount));
    setMarginLowPercent(margin.marginLowPercent);
    setMarginHighAmount(String(margin.marginHighAmount));
    setMarginHighPercent(margin.marginHighPercent);
    setUnit(structure.unit ?? '');
    setAdditionalInfo(structure.defaultAdditionalInfo ?? '');
    setDefaultUnitPrice(optionalPriceText(structure.defaultUnitPriceVat0));
    setDefaultDisplayWorkDuration(optionalDaysText(structure.defaultDisplayWorkDurationDays));
    setDefaultMaterials(optionalPriceText(structure.defaultMaterialsVat0));
    savedIdRef.current = structure.id;
    setSavedSnapshot(
      JSON.stringify({
        name: structure.name,
        commission: String(structure.commissionPercent).replace('.', ','),
        crewSize: String(structure.crewSize),
        hourlyRate: hourlyRateText(structure.hourlyRate),
        marginLowAmount: String(margin.marginLowAmount),
        marginLowPercent: margin.marginLowPercent,
        marginHighAmount: String(margin.marginHighAmount),
        marginHighPercent: margin.marginHighPercent,
        unit: structure.unit ?? '',
        additionalInfo: structure.defaultAdditionalInfo ?? '',
        defaultUnitPrice: optionalPriceText(structure.defaultUnitPriceVat0),
        defaultDisplayWorkDuration: optionalDaysText(structure.defaultDisplayWorkDurationDays),
        defaultMaterials: optionalPriceText(structure.defaultMaterialsVat0),
      }),
    );
  }, [isNew, structure?.id]);

  const isDirty = useMemo(() => {
    if (savedSnapshot == null) return isNew;
    return currentSnapshot() !== savedSnapshot;
  }, [
    isNew,
    savedSnapshot,
    name,
    commission,
    crewSize,
    hourlyRate,
    marginLowAmount,
    marginLowPercent,
    marginHighAmount,
    marginHighPercent,
    unit,
    additionalInfo,
    defaultUnitPrice,
    defaultDisplayWorkDuration,
    defaultMaterials,
  ]);

  const commissionValue =
    parseNumber(commission) ?? structure?.commissionPercent ?? settings.defaultCommissionPercent;
  const marginMax = maxMarginPercent(commissionValue);

  useEffect(() => {
    setMarginLowPercent((current) => Math.min(current, marginMax));
    setMarginHighPercent((current) => Math.min(current, marginMax));
  }, [marginMax]);

  async function persistStructure(): Promise<boolean> {
    const parsed = parseNumber(commission);
    if (!name.trim()) {
      showAlert('Virhe', 'Anna nimi');
      return false;
    }
    if (parsed === null || parsed < 0) {
      showAlert('Virhe', 'Virheellinen palkkio');
      return false;
    }
    const parsedCrew = Number.parseInt(crewSize.replace(',', '.'), 10);
    if (!Number.isFinite(parsedCrew) || parsedCrew <= 0) {
      showAlert('Virhe', 'Virheellinen työryhmän koko');
      return false;
    }
    const parsedHourlyRate = parseOptionalHourlyRate(hourlyRate);
    if (parsedHourlyRate === 'invalid') {
      showAlert('Virhe', 'Virheellinen tuntipalkka');
      return false;
    }
    const unitPrice = parseOptionalPrice(defaultUnitPrice);
    const displayDuration = parseOptionalDays(defaultDisplayWorkDuration);
    const materials = parseOptionalPrice(defaultMaterials);
    if (unitPrice === 'invalid') {
      showAlert('Virhe', 'Virheellinen oletushinta');
      return false;
    }
    if (displayDuration === 'invalid') {
      showAlert('Virhe', 'Virheellinen työn arvioitu kesto');
      return false;
    }
    if (materials === 'invalid') {
      showAlert('Virhe', 'Virheellinen oletus materiaalit');
      return false;
    }
    const parsedLowAmount = parseNumber(marginLowAmount);
    const parsedHighAmount = parseNumber(marginHighAmount);
    if (
      parsedLowAmount === null ||
      parsedHighAmount === null ||
      !Number.isFinite(marginLowPercent) ||
      !Number.isFinite(marginHighPercent)
    ) {
      showAlert('Virhe', 'Anna kelvolliset katearvot.');
      return false;
    }
    if (!(parsedLowAmount > 0) || !(parsedHighAmount > parsedLowAmount)) {
      showAlert('Virhe', 'Suuren urakan rajan on oltava suurempi kuin pienen urakan raja.');
      return false;
    }
    if (marginLowPercent + parsed >= 100 || marginHighPercent + parsed >= 100) {
      showAlert('Virhe', 'Myyntikate ja myyntipalkkio yhteensä on oltava alle 100 %.');
      return false;
    }

    const now = new Date();
    const nextId = savedIdRef.current ?? createId();
    const existing = structures.find((item) => item.id === nextId);
    const form = existing
      ? { ...existing.form, name: name.trim() }
      : normalizeFormDefinition({
          ...createDefaultFormDefinition(),
          id: createId(),
          name: name.trim(),
        });

    await db.upsertProductStructure({
      id: nextId,
      name: name.trim(),
      unit: unit.trim() || undefined,
      form,
      commissionPercent: parsed,
      crewSize: parseCrewSize(parsedCrew),
      hourlyRate: parsedHourlyRate,
      marginLowAmount: parsedLowAmount,
      marginLowPercent,
      marginHighAmount: parsedHighAmount,
      marginHighPercent,
      defaultAdditionalInfo: additionalInfo.trim() || undefined,
      defaultUnitPriceVat0: unitPrice,
      defaultContractPriceVat0: existing?.defaultContractPriceVat0,
      defaultMaterialsVat0: materials,
      defaultDisplayWorkDurationDays: displayDuration,
      sortOrder: existing?.sortOrder ?? structures.length,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    savedIdRef.current = nextId;
    setSavedSnapshot(
      JSON.stringify({
        name: name.trim(),
        commission,
        crewSize,
        hourlyRate,
        marginLowAmount,
        marginLowPercent,
        marginHighAmount,
        marginHighPercent,
        unit: unit.trim(),
        additionalInfo,
        defaultUnitPrice,
        defaultDisplayWorkDuration,
        defaultMaterials,
      }),
    );
    await refreshStructures();
    await refreshFormSettings();
    return true;
  }

  const { allowExit, exitDialog, save } = useUnsavedChangesGuard({
    isDirty,
    onSave: persistStructure,
  });

  if (!structureId) return <ScreenMessage message="Rakennetta ei löytynyt." />;
  if (!isNew && !structure) return <ScreenLoading />;

  async function handleSave() {
    const saved = await save();
    if (!saved) return;
    if (isNew && savedIdRef.current) {
      allowExit();
      router.replace(`/settings/structures/${savedIdRef.current}` as Href);
    }
  }

  async function openForm() {
    const saved = await persistStructure();
    if (!saved || !savedIdRef.current) return;
    allowExit();
    if (isNew) {
      router.replace(`/settings/structures/${savedIdRef.current}` as Href);
    }
    router.push(calculationSettingsHref('/settings/calculation', savedIdRef.current));
  }

  async function handleDelete() {
    if (!structureId || isNew) return;
    try {
      await db.deleteProductStructure(structureId);
      await refreshStructures();
      await refreshProducts();
      await refreshFormSettings();
      setDeleteVisible(false);
      allowExit();
      router.back();
    } catch (error) {
      setDeleteVisible(false);
      showAlert('Virhe', error instanceof Error ? error.message : 'Poisto epäonnistui.');
    }
  }

  return (
    <>
      <Stack.Screen
        options={{ title: isNew ? 'Uusi tuoterakenne' : (structure?.name ?? 'Tuoterakenne') }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <AppInput label="Nimi" value={name} onChangeText={setName} />
        <AppInput label="Yksikkö" value={unit} onChangeText={setUnit} placeholder="Valinnainen" />
        <AppInput
          label="Myyntipalkkio %"
          value={commission}
          onChangeText={setCommission}
          keyboardType="decimal-pad"
        />
        <Text style={styles.sectionHint}>
          Kate on yrityksen osuus myyntihinnasta (ALV 0). Palkkio tulee lisäksi. Kate liukuu
          lineaarisesti pienen ja suuren urakan rajan välillä. Jokaisella tuoterakenteella on oma
          kate.
        </Text>
        <AppInput
          label="Pienen urakan raja (€, ALV 0)"
          value={marginLowAmount}
          onChangeText={setMarginLowAmount}
          keyboardType="decimal-pad"
        />
        <AppPercentSlider
          label="Kate pienellä urakalla (%)"
          value={Math.min(marginLowPercent, marginMax)}
          onChange={setMarginLowPercent}
          min={0}
          max={marginMax}
          step={1}
        />
        <AppInput
          label="Suuren urakan raja (€, ALV 0)"
          value={marginHighAmount}
          onChangeText={setMarginHighAmount}
          keyboardType="decimal-pad"
        />
        <AppPercentSlider
          label="Kate suurella urakalla (%)"
          value={Math.min(marginHighPercent, marginMax)}
          onChange={setMarginHighPercent}
          min={0}
          max={marginMax}
          step={1}
        />
        <AppInput
          label="Työryhmän koko"
          value={crewSize}
          onChangeText={setCrewSize}
          keyboardType="numeric"
          placeholder="Henkilöä"
        />
        <AppInput
          label="Tekijän tuntipalkka (alv0) €/h"
          value={hourlyRate}
          onChangeText={setHourlyRate}
          keyboardType="decimal-pad"
          placeholder={`Yleinen: ${settings.defaultHourlyRate} €/h`}
        />
        <AppInput
          label="Lisätiedot"
          value={additionalInfo}
          onChangeText={setAdditionalInfo}
          multiline
          placeholder="Oletusteksti riville (valinnainen)"
        />
        <AppInput
          label="Oletushinta alv0"
          value={defaultUnitPrice}
          onChangeText={setDefaultUnitPrice}
          keyboardType="decimal-pad"
          placeholder="Valinnainen"
        />
        <AppInput
          label={WORK_DURATION_DISPLAY_LABEL}
          value={defaultDisplayWorkDuration}
          onChangeText={setDefaultDisplayWorkDuration}
          keyboardType="decimal-pad"
          placeholder="Valinnainen, säävaraus mukana"
        />
        <AppInput
          label="Oletus materiaalit alv0"
          value={defaultMaterials}
          onChangeText={setDefaultMaterials}
          keyboardType="decimal-pad"
          placeholder="Valinnainen"
        />
        <PrimaryButton title="Tallenna" onPress={() => void handleSave()} />
        <SettingsNavCard
          title="Lomake"
          subtitle="Sivut, kentät, JSON ja debug"
          onPress={() => void openForm()}
        />
        {isNew ? null : (
          <OutlinedButton title="Poista tuoterakenne…" onPress={() => setDeleteVisible(true)} />
        )}
      </ScrollView>
      <ConfirmDialog
        visible={deleteVisible}
        title="Poista tuoterakenne?"
        message="Tuotteista poistetaan tämä rakenne. Tätä ei voi perua."
        onClose={() => setDeleteVisible(false)}
        buttons={[
          { title: 'Peruuta', variant: 'outlined', onPress: () => setDeleteVisible(false) },
          { title: 'Poista', variant: 'destructive', onPress: () => void handleDelete() },
        ]}
      />
      {exitDialog}
    </>
  );
}

function hourlyRateText(value: number | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return '';
  return String(value);
}

function parseOptionalHourlyRate(raw: string): number | undefined | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = parseNumber(trimmed);
  if (parsed === null || parsed <= 0) return 'invalid';
  return parsed;
}

function optionalDaysText(value: number | undefined): string {
  const days = normalizeDisplayWorkDurationDays(value);
  return days == null ? '' : String(days);
}

function parseOptionalDays(raw: string): number | undefined | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = parseNumber(trimmed);
  if (parsed === null || parsed < 0) return 'invalid';
  if (parsed === 0) return undefined;
  return normalizeDisplayWorkDurationDays(parsed);
}

function optionalPriceText(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return formatFixed2(value);
}

function parseOptionalPrice(raw: string): number | undefined | 'invalid' {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = parseNumber(trimmed);
  if (parsed === null || parsed < 0) return 'invalid';
  return parsed;
}

function createStyles(colors: AppColorPalette) {
  return {
    content: {
      padding: 20,
      paddingBottom: 40,
      gap: 10,
    },
    sectionHint: {
      marginTop: 4,
      marginBottom: 4,
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 13,
      lineHeight: 20,
      color: colors.text,
    },
  };
}

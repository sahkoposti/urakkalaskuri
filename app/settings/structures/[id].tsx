import { router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView } from 'react-native';

import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import {
  AppInput,
  OutlinedButton,
  PrimaryButton,
  ScreenLoading,
  ScreenMessage,
} from '@/src/components/common';
import { SettingsNavCard } from '@/src/components/SettingsNavCard';
import { createDefaultFormDefinition } from '@/src/core/form/defaultFormDefinition';
import { normalizeFormDefinition } from '@/src/core/form/formDefinitionHelpers';
import { calculationSettingsHref } from '@/src/core/navigation/calculationSettings';
import { parseNumber } from '@/src/core/utils/formatters';
import { createId } from '@/src/core/utils/id';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
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
  const [unit, setUnit] = useState(isNew ? '' : (structure?.unit ?? ''));
  const [deleteVisible, setDeleteVisible] = useState(false);
  const savedIdRef = useRef<string | null>(isNew ? null : structureId ?? null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);

  function currentSnapshot() {
    return JSON.stringify({
      name: name.trim(),
      commission,
      unit: unit.trim(),
    });
  }

  useEffect(() => {
    if (isNew || !structure) return;
    setName(structure.name);
    setCommission(String(structure.commissionPercent).replace('.', ','));
    setUnit(structure.unit ?? '');
    savedIdRef.current = structure.id;
    setSavedSnapshot(
      JSON.stringify({
        name: structure.name,
        commission: String(structure.commissionPercent).replace('.', ','),
        unit: structure.unit ?? '',
      }),
    );
  }, [isNew, structure?.id]);

  const isDirty = useMemo(() => {
    if (savedSnapshot == null) return isNew;
    return currentSnapshot() !== savedSnapshot;
  }, [isNew, savedSnapshot, name, commission, unit]);

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
      sortOrder: existing?.sortOrder ?? structures.length,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    savedIdRef.current = nextId;
    setSavedSnapshot(
      JSON.stringify({
        name: name.trim(),
        commission,
        unit: unit.trim(),
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

function createStyles(_colors: AppColorPalette) {
  return {
    content: {
      padding: 20,
      paddingBottom: 40,
      gap: 10,
    },
  };
}

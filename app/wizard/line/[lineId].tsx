import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { OutlinedButton, PrimaryButton, ScreenMessage, SectionTitle } from '@/src/components/common';
import { WizardFieldList } from '@/src/components/form/WizardFieldList';
import {
  CalculationValidationError,
  previewFormContext,
  runFormCalculation,
} from '@/src/core/calculation/calculationPipeline';
import { applyFieldValueChange, resetComputedFieldOverride } from '@/src/core/form/applyFieldValueChange';
import { buildCalculationFormulaContext } from '@/src/core/form/calculationFormulaContext';
import { wizardFieldsForPage } from '@/src/core/form/formDefinitionHelpers';
import { buildFormSnapshot } from '@/src/core/form/formSummaryHelpers';
import { productBelongsToStructure } from '@/src/core/product/productStructures';
import { applyFormResultToLine, saveIncompleteFormToLine } from '@/src/core/structure/applyFormToLine';
import { structureFormPages } from '@/src/core/structure/formPages';
import { settingsForStructure } from '@/src/core/structure/structureSettings';
import {
  buildPersistedWizardDraft,
  cloneStructureLine,
  firstNonEmptyId,
  lineFormNeedsExitPrompt,
  mergeWizardDraftEditMeta,
  persistedDraftToFormState,
} from '@/src/core/wizard/wizardDraftHelpers';
import {
  isStructureFormFullyFilled,
  validateFormPageWithValues,
} from '@/src/core/wizard/wizardPageHelpers';
import { db, useApp } from '@/src/context/AppContext';
import { useThemedAlert } from '@/src/context/ThemedAlertContext';
import { useLiveFormContext } from '@/src/hooks/useLiveFormContext';
import { useUnsavedChangesGuard } from '@/src/hooks/useUnsavedChangesGuard';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export default function StructureLineFormScreen() {
  const styles = useThemedStyles(createStyles);
  const { lineId: rawLineId, editId: rawEditId } = useLocalSearchParams<{
    lineId?: string | string[];
    editId?: string | string[];
  }>();
  const lineId = firstNonEmptyId(rawLineId);
  const routeEditId = firstNonEmptyId(rawEditId);
  const { wizardDraft, products, settings, structures, refreshWizardDraft } = useApp();
  const { showAlert } = useThemedAlert();

  const draftState = wizardDraft
    ? persistedDraftToFormState(wizardDraft, products).form
    : undefined;
  const line = draftState?.structureLines?.find((item) => item.id === lineId);
  const structure = structures.find((item) => item.id === line?.structureId);
  const pages = useMemo(
    () => (structure ? structureFormPages(structure.form) : []),
    [structure],
  );

  const [step, setStep] = useState(0);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const savedLineRef = useRef<NonNullable<typeof line> | null>(null);

  useEffect(() => {
    if (!line) return;
    const snapshot = cloneStructureLine(line);
    savedLineRef.current = snapshot;
    setFieldValues({ ...snapshot.fieldValues });
  }, [line?.id]);

  const structureProducts = products.filter(
    (product) => !line || productBelongsToStructure(product, line.structureId),
  );
  const currentPage = pages[step] ?? pages[0];
  const pageFields = currentPage && structure
    ? wizardFieldsForPage(structure.form, currentPage.id)
    : [];
  const reverseVat = Boolean(draftState?.reverseVat);
  const lineSettings = useMemo(
    () => (structure ? settingsForStructure(settings, structure) : settings),
    [settings, structure],
  );
  const extraContext = useMemo(
    () =>
      buildCalculationFormulaContext({
        travelTimeHoursOneWay: draftState?.travelTimeOneWay,
      }),
    [draftState?.travelTimeOneWay],
  );
  const computedValues = useLiveFormContext({
    form: structure?.form ?? { id: '', name: '', version: 0, pages: [], fields: [], updatedAt: 0 },
    fieldValues,
    materialLines: [],
    products: structureProducts,
    settings: lineSettings,
    reverseVat,
    extraContext,
  });

  const numericContext = structure
    ? previewFormContext(
        structure.form,
        fieldValues,
        [],
        structureProducts,
        lineSettings,
        undefined,
        reverseVat,
        extraContext,
      )
    : undefined;
  const formComplete = Boolean(
    structure &&
      isStructureFormFullyFilled(structure.form, fieldValues, structureProducts, numericContext),
  );
  const savedLine = savedLineRef.current;
  const isDirty = Boolean(
    line &&
      savedLine &&
      lineFormNeedsExitPrompt({
        currentValues: fieldValues,
        savedValues: savedLine.fieldValues,
        formComplete,
        savedFormFilled: savedLine.formFilled,
      }),
  );

  function showError(message: string) {
    showAlert('Virhe', message);
  }

  async function writeLineToDraft(nextLine: NonNullable<typeof line>): Promise<boolean> {
    if (!wizardDraft) return false;
    const { form } = persistedDraftToFormState(wizardDraft, products);
    const nextLines = (form.structureLines ?? []).map((item) =>
      item.id === nextLine.id ? nextLine : item,
    );
    await db.saveWizardDraft(
      buildPersistedWizardDraft(
        { ...form, structureLines: nextLines },
        mergeWizardDraftEditMeta(
          {
            editCalculationId: routeEditId,
            originalCreatedAt: wizardDraft.originalCreatedAt,
            editFormVersion: wizardDraft.editFormVersion,
          },
          wizardDraft,
        ),
        wizardDraft,
      ),
    );
    await refreshWizardDraft();
    return true;
  }

  async function persistIncomplete(): Promise<boolean> {
    if (!line) return false;
    const next = saveIncompleteFormToLine(line, fieldValues);
    const saved = await writeLineToDraft(next);
    if (saved) savedLineRef.current = cloneStructureLine(next);
    return saved;
  }

  async function persistComplete(): Promise<boolean> {
    if (!wizardDraft || !structure || !line) return false;
    try {
      const { context, result } = runFormCalculation({
        form: structure.form,
        fieldValues,
        materialLines: [],
        products: structureProducts,
        settings: lineSettings,
        reverseVat,
        extraContext,
      });
      const snapshot = buildFormSnapshot(
        structure.form,
        fieldValues,
        context,
        structureProducts,
      );
      const nextLine = applyFormResultToLine(
        line,
        result,
        fieldValues,
        structure.commissionPercent,
        { formVersion: structure.form.version, snapshot },
      );
      return writeLineToDraft(nextLine);
    } catch (error) {
      if (error instanceof CalculationValidationError) {
        showError(error.message);
      } else {
        showError('Laskenta epäonnistui.');
      }
      return false;
    }
  }

  async function restoreSavedLine(): Promise<void> {
    const saved = savedLineRef.current;
    if (!saved) return;
    await writeLineToDraft(cloneStructureLine(saved));
  }

  const { allowExit, requestExit, exitDialog } = useUnsavedChangesGuard({
    isDirty,
    onSave: formComplete ? persistComplete : persistIncomplete,
    onDiscard: restoreSavedLine,
    title: formComplete ? 'Tallentamattomia muutoksia' : 'Keskeneräinen lomake',
    message: formComplete
      ? 'Haluatko tallentaa lomakkeen?'
      : 'Haluatko tallentaa lomakkeen keskeneräisenä? Sulje tallentamatta palauttaa edellisen tallennetun lomakkeen.',
    discardTitle: 'Sulje tallentamatta',
    saveTitle: formComplete ? 'Tallenna' : 'Tallenna keskeneräisenä',
  });

  if (!line || !structure) {
    return (
      <>
        <Stack.Screen options={{ title: 'Lomake' }} />
        <ScreenMessage message="Riviä ei löytynyt." />
        {exitDialog}
      </>
    );
  }

  const stepCount = pages.length;
  const nextTitle = step === stepCount - 1 ? 'Valmis' : 'Seuraava';

  function validateStep(): boolean {
    if (!currentPage || !structure) return false;
    const error = validateFormPageWithValues(
      structure.form,
      currentPage,
      fieldValues,
      '',
      structureProducts,
      previewFormContext(structure.form, fieldValues, [], structureProducts, lineSettings, undefined, reverseVat, extraContext),
      [],
      { requireCustomerName: false },
    );
    if (error) {
      showError(error);
      return false;
    }
    return true;
  }

  async function applyAndClose() {
    const saved = await persistComplete();
    if (!saved) return;
    allowExit();
    router.back();
  }

  function handleNext() {
    if (!validateStep()) return;
    if (step < stepCount - 1) {
      setStep((current) => current + 1);
      return;
    }
    void applyAndClose();
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `${structure.name} (${step + 1}/${Math.max(stepCount, 1)})`,
          headerBackButtonMenuEnabled: false,
        }}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SectionTitle title={currentPage?.title ?? structure.name} center />
          <View style={styles.actionBar}>
            {step > 0 ? (
              <View style={styles.actionButton}>
                <OutlinedButton title="Edellinen" onPress={() => setStep((current) => current - 1)} />
              </View>
            ) : (
              <View style={styles.actionButton}>
                <OutlinedButton title="Takaisin" onPress={requestExit} />
              </View>
            )}
            <View style={styles.actionButton}>
              <PrimaryButton title={nextTitle} onPress={handleNext} />
            </View>
          </View>
          {currentPage ? (
            <WizardFieldList
              form={structure.form}
              fields={pageFields}
              fieldValues={fieldValues}
              computedValues={computedValues}
              products={structureProducts}
              onChange={(key, value) =>
                setFieldValues((current) =>
                  applyFieldValueChange(structure.form, current, key, value),
                )
              }
              onResetOverride={(key) =>
                setFieldValues((current) => resetComputedFieldOverride(current, key))
              }
            />
          ) : (
            <Text style={styles.empty}>Tällä rakenteella ei ole lomakesivuja.</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {exitDialog}
    </>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    container: {
      flex: 1,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    actionBar: {
      flexDirection: 'row' as const,
      gap: 12,
      marginBottom: 16,
    },
    actionButton: {
      flex: 1,
    },
    empty: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
    },
  };
}

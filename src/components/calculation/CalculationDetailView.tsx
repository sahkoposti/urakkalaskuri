import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AttachmentSection } from '@/src/features/attachments/ui';
import { DetailTabBar } from '@/src/components/calculation/DetailTabBar';
import { ManualContractDialog } from '@/src/components/calculation/ManualContractDialog';
import { FormSummarySection } from '@/src/components/form/FormSummarySection';
import { CalculationDocumentList } from '@/src/components/pdf/CalculationDocumentList';
import { DocumentFormModal } from '@/src/components/pdf/DocumentFormModal';
import { DocumentReadySheet } from '@/src/components/pdf/DocumentReadySheet';
import { DOKUMENTTI_ACTIONS, type DetailTab } from '@/src/components/pdf/pdfExportFormModel';
import { TarjousExportForm } from '@/src/components/pdf/TarjousExportForm';
import { UrakkakorttiExportForm } from '@/src/components/pdf/UrakkakorttiExportForm';
import { usePdfExportForm } from '@/src/components/pdf/usePdfExportForm';
import { ThemedIcon } from '@/src/components/ThemedIcon';
import { PriceBreakdownCard } from '@/src/components/calculation/PriceBreakdownCard';
import {
  AppCard,
  OutlinedButton,
  PrimaryButton,
  ResultRow,
  SectionTitle,
} from '@/src/components/common';
import { previewFormContext } from '@/src/core/calculation/calculationPipeline';
import {
  CONTINUE_EDIT_LABEL,
  EXPORT_BLOCKED_BY_DRAFT_MESSAGE,
} from '@/src/core/history/detailDraftPolicy';
import { buildCalculationFormulaContext, formatTravelTimeHoursOneWay } from '@/src/core/form/calculationFormulaContext';
import { lineFormSnapshot } from '@/src/core/form/formSummaryHelpers';
import {
  formVersionMismatchMessage,
  hasFormVersionMismatch,
} from '@/src/core/form/formVersion';
import type { FormDefinition } from '@/src/core/form/types';
import { listAttachments, type Attachment } from '@/src/features/attachments';
import type { CalculationRecord, CustomerInfo, MaterialQuantityRow, StructureLine } from '@/src/core/models/types';
import { customerFromRecord } from '@/src/core/models/types';
import { productBelongsToStructure } from '@/src/core/product/productStructures';
import { ensureStructureLines } from '@/src/core/structure/legacyCalculation';
import { withDerivedLinePricing } from '@/src/core/structure/linePricing';
import { formatQuantity } from '@/src/core/materials/materialQuantities';
import { estimateWorkDurationDays } from '@/src/core/utils/formatters';
import { resolveDisplayedWorkDurationDays } from '@/src/core/structure/workDurationDisplay';
import { roundedLineCardPrices } from '@/src/core/pdf/offerDocument';
import { isPrivateCustomer, reverseVatLabel } from '@/src/core/utils/priceDisplay';
import { lineStructureLisatiedot, structureRowShowsAdditionalInfo } from '@/src/core/pdf/structureExtraText';
import { settingsForStructure } from '@/src/core/structure/structureSettings';
import { useApp } from '@/src/context/AppContext';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

type CalculationDetailViewProps = {
  record: CalculationRecord;
  formDefinition: FormDefinition;
  /** Näytetään, kun laskelmalla on uudempi muokkausluonnos. */
  unsavedChangesNotice?: string | null;
  onCopy?: () => void;
  onCopyCalculation?: () => void;
  onRecordChange?: (record: CalculationRecord) => void;
  /** Kasvaa, kun kopioidut liitteet poistetaan. */
  attachmentEpoch?: number;
  onFooterPress: () => void;
  onDeletePress?: () => void;
};

function lineBreakdown(line: StructureLine, reverseVat: boolean) {
  const priced = withDerivedLinePricing(line);
  return {
    materialsVat0: priced.materialsVat0,
    discountPercent: priced.discountPercent,
    vatPercent: priced.vatPercent,
    ...roundedLineCardPrices(priced, reverseVat),
  };
}

export function CalculationDetailView({
  record,
  formDefinition,
  unsavedChangesNotice,
  onCopy,
  onCopyCalculation,
  onRecordChange,
  attachmentEpoch = 0,
  onDeletePress,
}: CalculationDetailViewProps) {
  const styles = useThemedStyles(createStyles);
  const { settings, structures } = useApp();
  const [tab, setTab] = useState<DetailTab>('laskelma');
  const scrollRef = useRef<ScrollView>(null);
  const attachmentsRef = useRef<View>(null);
  const [attachments, setAttachments] = useState<readonly Attachment[]>([]);
  const reloadAttachments = useCallback(() => {
    void listAttachments(record.id).then(setAttachments).catch((error: unknown) => {
      console.error(error);
    });
  }, [record.id]);
  useFocusEffect(
    useCallback(() => {
      reloadAttachments();
    }, [reloadAttachments, attachmentEpoch]),
  );
  const [openDocument, setOpenDocument] = useState<'tarjous' | 'urakkakortti' | null>(null);
  function showAttachments() {
    setOpenDocument(null);
    requestAnimationFrame(() => {
      const section = attachmentsRef.current;
      const scroll = scrollRef.current;
      if (!section || !scroll) return;
      section.measureLayout(
        scroll.getInnerViewNode(),
        (_x, y) => {
          scroll.scrollTo({ y: Math.max(0, y - 8), animated: true });
        },
        () => undefined,
      );
    });
  }
  const pdf = usePdfExportForm(record.id, record);
  useEffect(() => {
    if (pdf.readyDocument) setOpenDocument(null);
  }, [pdf.readyDocument]);
  const customer = customerFromRecord(record);
  const privateCustomer = isPrivateCustomer(customer);
  const structureLines = ensureStructureLines(record);
  const showStructureSummaries = structureLines.length > 1;
  const singleLine = structureLines.length === 1 ? structureLines[0] : undefined;
  const totalDisplayedDuration = singleLine
    ? resolveDisplayedWorkDurationDays(singleLine, settings.weatherReserveFactor)
    : estimateWorkDurationDays(record.workDurationDays, settings.weatherReserveFactor);
  const mismatchLine = structureLines.find((line) => {
    const structure = structures.find((item) => item.id === line.structureId);
    const snapshotVersion = line.formVersion ?? line.snapshot?.formVersion;
    const currentVersion = structure?.form.version ?? formDefinition.version;
    return hasFormVersionMismatch(snapshotVersion, currentVersion);
  });
  const snapshotVersion =
    mismatchLine?.formVersion ?? mismatchLine?.snapshot?.formVersion ?? record.formSnapshot?.formVersion;
  const currentVersion = formDefinition.version;

  return (
    <>
    <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
      <View>
        <View style={styles.titleRow}>
          <Text style={styles.customerName}>{customer.name}</Text>
          {onDeletePress ? (
            <Pressable
              onPress={onDeletePress}
              style={({ pressed }) => [styles.deleteButton, pressed && styles.deleteButtonPressed]}
              accessibilityLabel="Poista laskelma"
              hitSlop={8}
            >
              <ThemedIcon name="trash" size={24} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.titleUnderline} />
      </View>

      {unsavedChangesNotice ? (
        <View style={styles.pendingNotice}>
          <Text style={styles.pendingNoticeText}>{unsavedChangesNotice}</Text>
        </View>
      ) : null}

      <DetailTabBar value={tab} onChange={setTab} />

      {tab === 'dokumentit' ? (
        <View style={styles.documents}>
          {pdf.exportBlocked ? (
            <View style={styles.pendingNotice}>
              <Text style={styles.pendingNoticeText}>{EXPORT_BLOCKED_BY_DRAFT_MESSAGE}</Text>
              <PrimaryButton
                title={CONTINUE_EDIT_LABEL}
                onPress={() => router.push({ pathname: '/wizard', params: { editId: record.id } })}
              />
            </View>
          ) : null}
          {DOKUMENTTI_ACTIONS.map((action) => (
            <AppCard key={action.id} style={styles.documentCard}>
              <Text style={styles.documentTitle}>
                {action.id === 'tarjous' ? 'Tarjous' : 'Urakkakortti'}
              </Text>
              <OutlinedButton
                title={action.label}
                disabled={pdf.exportBlocked}
                onPress={() => {
                  if (pdf.exportBlocked) return;
                  pdf.resyncSheet();
                  setOpenDocument(action.id);
                }}
              />
            </AppCard>
          ))}
          <View ref={attachmentsRef} collapsable={false}>
            <AttachmentSection
              record={record}
              attachments={attachments}
              onChanged={reloadAttachments}
              onRecordChange={onRecordChange ?? (() => undefined)}
            />
          </View>
          <CalculationDocumentList
            documents={pdf.documents}
            platform={pdf.phonePlatform}
            onPreview={pdf.previewDocument}
            onShare={(document) => {
              if (pdf.exportBlocked) return;
              pdf.shareDocument(document);
            }}
            onDelete={pdf.confirmDeleteDocument}
            onSaveToPhone={(document) => {
              if (pdf.exportBlocked) return;
              pdf.retryPhoneSave(document);
            }}
          />
        </View>
      ) : (
        <>
      {mismatchLine && snapshotVersion != null ? (
        <View style={styles.versionWarning}>
          <Text style={styles.versionWarningTitle}>Lomakepohja on muuttunut</Text>
          <Text style={styles.versionWarningText}>
            {formVersionMismatchMessage(snapshotVersion, currentVersion)}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          title="Muokkaa"
          onPress={() => router.push({ pathname: '/wizard', params: { editId: record.id } })}
        />
        {onCopyCalculation ? (
          <OutlinedButton title="Kopioi laskelma" onPress={onCopyCalculation} />
        ) : null}
      </View>

      <AppCard style={styles.card}>
        {!privateCustomer ? (
          <ResultRow label="Käänteinen ALV" value={reverseVatLabel(customer)} />
        ) : null}
        <ResultRow
          label="Puh."
          value={customer.phone ?? '–'}
          copyValue={customer.phone}
          onCopy={onCopy}
        />
        <ResultRow
          label="Sähköposti"
          value={customer.email ?? '–'}
          copyValue={customer.email}
          onCopy={onCopy}
        />
        <ResultRow
          label="Osoite"
          value={customer.address ?? '–'}
          copyValue={customer.address}
          onCopy={onCopy}
        />
        <ResultRow
          label="Postinumero"
          value={customer.postalCode ?? '–'}
          copyValue={customer.postalCode}
          onCopy={onCopy}
        />
        <ResultRow
          label="Postitoimipaikka"
          value={customer.postalLocality ?? '–'}
          copyValue={customer.postalLocality}
          onCopy={onCopy}
        />
        <ResultRow
          label="Lisätiedot"
          value={customer.notes ?? '–'}
          copyValue={customer.notes}
          onCopy={onCopy}
        />
      </AppCard>

      {record.deliveryScheduleText?.trim() || record.travelTimeHoursOneWay ? (
        <AppCard style={styles.card}>
          {record.deliveryScheduleText?.trim() ? (
            <ResultRow label="Toimitusajankohta" value={record.deliveryScheduleText.trim()} />
          ) : null}
          {record.travelTimeHoursOneWay ? (
            <ResultRow
              label="Matka-aika yhteen suuntaan"
              value={`${formatTravelTimeHoursOneWay(record.travelTimeHoursOneWay)} h`}
            />
          ) : null}
        </AppCard>
      ) : null}

      <PriceBreakdownCard
        values={record}
        customer={customer}
        lines={structureLines}
        snapshot={record.formSnapshot}
        displayedWorkDurationDays={totalDisplayedDuration}
        showDuration={structureLines.length <= 1}
      />

      {structureLines.map((line) => (
        <LineDetail
          key={line.id}
          line={line}
          customer={customer}
          offerSnapshot={record.formSnapshot}
          weatherReserveFactor={settings.weatherReserveFactor}
          showPriceSummary={showStructureSummaries}
          showAdditionalInfo={structureRowShowsAdditionalInfo(structureLines, line.id, structures)}
          travelTimeHoursOneWay={record.travelTimeHoursOneWay}
        />
      ))}
        </>
      )}
    </ScrollView>
    <DocumentFormModal
      visible={openDocument === 'tarjous'}
      title="Tarjous"
      onClose={() => setOpenDocument(null)}
    >
      <TarjousExportForm
        offer={pdf.offer}
        attachments={attachments}
        onShowAttachments={showAttachments}
      />
    </DocumentFormModal>
    <DocumentFormModal
      visible={openDocument === 'urakkakortti' && pdf.manualLines === null}
      title="Urakkakortti"
      onClose={() => setOpenDocument(null)}
    >
      <UrakkakorttiExportForm
        card={pdf.card}
        attachments={attachments}
        onShowAttachments={showAttachments}
      />
    </DocumentFormModal>
    <DocumentReadySheet
      document={pdf.readyDocument}
      phone={pdf.readyPhone}
      platform={pdf.phonePlatform}
      onPreview={() => pdf.readyDocument && pdf.previewDocument({ uri: pdf.readyDocument.path })}
      onShare={() => {
        if (pdf.exportBlocked || !pdf.readyShare) return;
        pdf.shareDocument(pdf.readyShare);
      }}
      onSaveToPhone={() => {
        if (pdf.exportBlocked || !pdf.readyShare || !pdf.readyDocument) return;
        pdf.retryPhoneSave({ ...pdf.readyShare, id: pdf.readyDocument.id });
      }}
      onClose={pdf.dismissReady}
    />
    <ManualContractDialog
      visible={pdf.manualLines !== null}
      lines={pdf.manualLines ?? []}
      onCancel={pdf.cancelManual}
      onSubmit={pdf.submitManual}
    />
    </>
  );
}

function LineDetail({
  line,
  customer,
  offerSnapshot,
  weatherReserveFactor,
  showPriceSummary,
  showAdditionalInfo,
  travelTimeHoursOneWay,
}: {
  line: StructureLine;
  customer: CustomerInfo;
  offerSnapshot?: CalculationRecord['formSnapshot'];
  weatherReserveFactor: number;
  showPriceSummary: boolean;
  showAdditionalInfo: boolean;
  travelTimeHoursOneWay?: number;
}) {
  const { products, structures, settings } = useApp();
  const reverseVat = Boolean(customer.reverseVat);
  const structure = structures.find((item) => item.id === line.structureId);
  const structureProducts = products.filter((product) =>
    productBelongsToStructure(product, line.structureId),
  );
  const context = structure
    ? previewFormContext(
        structure.form,
        line.fieldValues ?? {},
        [],
        structureProducts,
        settingsForStructure(settings, structure),
        undefined,
        reverseVat,
        buildCalculationFormulaContext({ travelTimeHoursOneWay }),
      )
    : undefined;
  const snapshot = lineFormSnapshot(line, structure?.form, structureProducts, context);
  const displayedWorkDurationDays = resolveDisplayedWorkDurationDays(
    line,
    weatherReserveFactor,
  );

  return (
    <View>
      {showPriceSummary ? <SectionTitle title={line.name} /> : null}
      {showPriceSummary ? (
        <PriceBreakdownCard
          values={lineBreakdown(line, reverseVat)}
          customer={customer}
          lines={[line]}
          snapshot={offerSnapshot}
          displayedWorkDurationDays={displayedWorkDurationDays}
          showDuration
        />
      ) : null}
      {showAdditionalInfo && lineStructureLisatiedot(line, structures) ? (
        <AppCard>
          <ResultRow label="Lisätiedot" value={lineStructureLisatiedot(line, structures)} />
        </AppCard>
      ) : null}
      <SavedMaterialQuantities line={line} />
      <FormSummarySection
        form={structure?.form}
        fieldValues={line.fieldValues}
        context={context}
        products={structureProducts}
        snapshot={snapshot}
        workDurationDays={line.workDurationDays}
        weatherReserveFactor={weatherReserveFactor}
        fieldKeyPrefix={`${line.id}:`}
      />
    </View>
  );
}

function materialDetailValue(row: MaterialQuantityRow): string {
  const unit = row.unit && !row.unit.includes('€') ? row.unit.trim() : '';
  return [formatQuantity(row.quantity), unit].filter((part) => part.length > 0).join(' ');
}

function visibleShades(row: MaterialQuantityRow) {
  return (row.shades ?? []).filter(
    (shade) => shade.name.trim() && shade.quantity > 0 && !shade.name.includes('€') && !shade.unit?.includes('€'),
  );
}

function SavedMaterialQuantities({ line }: { line: StructureLine }) {
  const styles = useThemedStyles(createStyles);
  const rows = (line.materialQuantities ?? []).filter((row) => {
    if (!row.productName.trim() || row.productName.includes('€') || row.unit?.includes('€')) return false;
    if (visibleShades(row).length > 0) return true;
    return row.quantity > 0;
  });
  if (rows.length === 0) return null;
  return (
    <AppCard>
      <Text style={styles.materialsTitle}>Materiaalit (urakkakortti)</Text>
      {rows.map((row) => {
        const shades = visibleShades(row);
        const name = row.productName.replaceAll('€', '').trim() || 'Materiaali';
        if (shades.length === 0) {
          return <ResultRow key={row.id} label={name} value={materialDetailValue(row)} />;
        }
        return (
          <View key={row.id}>
            <Text style={styles.materialsProduct}>{name}</Text>
            {shades.map((shade) => (
              <ResultRow
                key={shade.id}
                label={shade.name.trim()}
                value={[formatQuantity(shade.quantity), shade.unit?.trim() ?? ''].filter((part) => part.length > 0).join(' ')}
              />
            ))}
          </View>
        );
      })}
    </AppCard>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 12,
    },
    titleRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
    },
    customerName: {
      flex: 1,
      fontSize: 24,
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.primary,
    },
    titleUnderline: {
      marginTop: 8,
      width: 40,
      height: 3,
      backgroundColor: colors.accent,
    },
    pendingNotice: {
      paddingVertical: 8,
      paddingHorizontal: 0,
    },
    pendingNoticeText: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
    deleteButton: {
      padding: 4,
    },
    deleteButtonPressed: {
      opacity: 0.7,
    },
    versionWarning: {
      padding: 12,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 5,
      backgroundColor: colors.surface,
      gap: 6,
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
    actions: {
      marginTop: 8,
      gap: 8,
    },
    documents: {
      gap: 16,
    },
    documentCard: {
      gap: 12,
    },
    documentTitle: {
      fontFamily: 'IBMPlexSans_700Bold',
      fontSize: 18,
      color: colors.primary,
    },
    card: {
      marginTop: 8,
    },
    materialsProduct: {
      marginTop: 8,
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.primary,
    },
    materialsTitle: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 15,
      color: colors.primary,
      marginBottom: 4,
    },
  };
}

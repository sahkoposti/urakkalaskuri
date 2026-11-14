import { Text } from 'react-native';

import { AttachmentSummaryLink } from '@/src/features/attachments/ui';
import { ChoiceToggle } from '@/src/components/ChoiceToggle';
import { AppInput, OutlinedButton } from '@/src/components/common';
import type { Attachment } from '@/src/features/attachments';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

import { OFFER_EXPORT_FIELD_KINDS } from './exportFormFieldKinds';
import { createPdfFormStyles } from './pdfFormStyles';
import type { PdfExportFormState } from './usePdfExportForm';

/** Tarjouksen kentät ja yksi Luo tarjous -painike. */
export function TarjousExportForm({
  offer,
  attachments,
  onShowAttachments,
}: {
  offer: PdfExportFormState['offer'];
  attachments: readonly Attachment[];
  onShowAttachments: () => void;
}) {
  const styles = useThemedStyles(createPdfFormStyles);

  return (
    <>
      {offer.showKtvPageChoice ? (
        <ChoiceToggle
          label="Sisällytä kotitalousvähennyslaskelma (KTV-sivu)"
          value={offer.ktvPageIncluded}
          options={[
            { value: true, label: 'Kyllä' },
            { value: false, label: 'Ei' },
          ]}
          onChange={offer.onKtvPageIncludedChange}
        />
      ) : null}
      {offer.showKtvPersons ? (
        <AppInput
          label="Henkilöiden määrä (kotitalousvähennys)"
          value={offer.personsText}
          onChangeText={offer.onPersonsChange}
          onBlur={offer.onPersonsBlur}
          kind={OFFER_EXPORT_FIELD_KINDS.ktvPersons}
          compact
        />
      ) : null}
      {offer.offerProblems.map((problem, index) => (
        <Text key={`${index}:${problem}`} style={styles.warning} accessibilityRole="alert">
          {problem}
        </Text>
      ))}
      {offer.personsProblem ? (
        <Text style={styles.warning} accessibilityRole="alert">
          {offer.personsProblem}
        </Text>
      ) : null}
      <AppInput
        label="Tarjous voimassa (päivää)"
        value={offer.validDaysText}
        onChangeText={offer.onValidDaysChange}
        onBlur={offer.onValidDaysBlur}
        kind={OFFER_EXPORT_FIELD_KINDS.validDays}
        compact
      />
      <Text style={styles.hint}>{offer.validDaysHint}</Text>
      {offer.validDaysProblem ? (
        <Text style={styles.warning} accessibilityRole="alert">
          {offer.validDaysProblem}
        </Text>
      ) : null}
      <AppInput
        label="Voimassa asti"
        value={offer.validDateText}
        onChangeText={offer.onValidDateChange}
        onBlur={offer.onValidDateBlur}
        kind={OFFER_EXPORT_FIELD_KINDS.validDate}
        placeholder="p.k.vvvv"
        compact
      />
      {offer.expiryDateProblem ? (
        <Text style={styles.warning} accessibilityRole="alert">
          {offer.expiryDateProblem}
        </Text>
      ) : null}
      {offer.showBusinessVatChoice ? (
        <ChoiceToggle
          label="Hintojen ALV"
          value={offer.businessVatMode}
          options={[
            { value: 'alv0', label: 'ALV 0' },
            { value: 'sis', label: 'Sis. ALV' },
          ]}
          onChange={offer.onBusinessVatModeChange}
        />
      ) : null}
      <AttachmentSummaryLink attachments={attachments} target="offer" onPress={onShowAttachments} />
      <OutlinedButton title={offer.createTitle} onPress={offer.onCreate} disabled={offer.createDisabled} />
    </>
  );
}

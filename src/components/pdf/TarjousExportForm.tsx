import { Text } from 'react-native';

import { ChoiceToggle } from '@/src/components/ChoiceToggle';
import { AppInput, OutlinedButton } from '@/src/components/common';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

import { createPdfFormStyles } from './pdfFormStyles';
import type { PdfExportFormState } from './usePdfExportForm';

/** Tarjouksen kentät ja yksi Luo tarjous -painike. */
export function TarjousExportForm({ offer }: { offer: PdfExportFormState['offer'] }) {
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
          keyboardType="numeric"
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
        keyboardType="numeric"
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
        placeholder="pp.kk.vvvv"
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
      <OutlinedButton title={offer.createTitle} onPress={offer.onCreate} disabled={offer.createDisabled} />
    </>
  );
}

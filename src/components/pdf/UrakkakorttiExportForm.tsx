import { Text } from 'react-native';

import { AppPicker } from '@/src/components/AppPicker';
import { ChoiceToggle } from '@/src/components/ChoiceToggle';
import { AppInput, OutlinedButton } from '@/src/components/common';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

import { CARD_EXPORT_FIELD_KINDS } from './exportFormFieldKinds';
import { showCardRowPrices } from './pdfExportFormModel';
import { createPdfFormStyles } from './pdfFormStyles';
import type { PdfExportFormState } from './usePdfExportForm';

/** Urakkakortin kentät ja yksi Luo urakkakortti -painike. */
export function UrakkakorttiExportForm({ card }: { card: PdfExportFormState['card'] }) {
  const styles = useThemedStyles(createPdfFormStyles);
  const showPrices = showCardRowPrices(card.hidePrices);

  return (
    <>
      <AppPicker
        label="Urakkakortti"
        selectedValue={card.cardMode}
        onValueChange={card.onCardModeChange}
        items={[
          { value: 'alihankkija', label: 'Alihankkija' },
          { value: 'tyontekija', label: 'Työntekijä' },
        ]}
      />
      <ChoiceToggle
        label="Urakkahinnat"
        value={card.hidePrices}
        options={[
          { value: false, label: 'Näytä' },
          { value: true, label: 'Älä näytä urakkahintoja' },
        ]}
        onChange={card.onHidePricesChange}
      />
      {showPrices
        ? card.lines.map((line) => (
            <AppInput
              key={line.id}
              label={`Urakkahinta: ${line.name}`}
              value={line.priceText}
              onChangeText={(value) => card.onRowPriceChange(line.id, value)}
              onBlur={card.onRowPricesBlur}
              kind={CARD_EXPORT_FIELD_KINDS.rowPrice}
              compact
            />
          ))
        : null}
      <AppInput
        label="Huomioitavaa"
        value={card.huomioText}
        onChangeText={card.onHuomioChange}
        onBlur={card.onHuomioBlur}
        kind={CARD_EXPORT_FIELD_KINDS.huomio}
        multiline
        placeholder="Esitäyttö asiakkaan lisätiedoista"
      />
      {card.cardProblems.map((problem, index) => (
        <Text key={`${index}:${problem}`} style={styles.warning} accessibilityRole="alert">
          {problem}
        </Text>
      ))}
      <OutlinedButton title={card.createTitle} onPress={card.onCreate} disabled={card.createDisabled} />
    </>
  );
}

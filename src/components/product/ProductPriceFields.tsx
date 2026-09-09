import { AppCard, ResultRow, AppInput } from '@/src/components/common';
import {
  productMarginEur,
  productMarginPercent,
} from '@/src/core/product/productPricing';
import { formatCurrency, formatPercent, parseNumber } from '@/src/core/utils/formatters';

type ProductPriceFieldsProps = {
  purchasePrice: string;
  salePrice: string;
  onPurchasePriceChange: (value: string) => void;
  onSalePriceChange: (value: string) => void;
};

export function ProductPriceFields({
  purchasePrice,
  salePrice,
  onPurchasePriceChange,
  onSalePriceChange,
}: ProductPriceFieldsProps) {
  const purchase = parseNumber(purchasePrice);
  const sale = parseNumber(salePrice);
  const preview =
    purchase !== null && purchase >= 0 && sale !== null && sale >= 0
      ? { purchasePriceVat0: purchase, salePriceVat0: sale, unitPriceVat0: purchase }
      : null;

  return (
    <>
      <AppInput
        label="Ostohinta (ALV 0) € * · kaavassa ostohinta"
        value={purchasePrice}
        onChangeText={onPurchasePriceChange}
        keyboardType="decimal-pad"
      />
      <AppInput
        label="Myyntihinta (ALV 0) € * · kaavassa myyntihinta"
        value={salePrice}
        onChangeText={onSalePriceChange}
        keyboardType="decimal-pad"
      />
      <AppCard>
        <ResultRow
          label="Kate"
          value={
            preview
              ? `${formatCurrency(productMarginEur(preview))} (${formatPercent(productMarginPercent(preview))})`
              : '–'
          }
        />
      </AppCard>
    </>
  );
}

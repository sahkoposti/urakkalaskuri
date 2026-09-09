import { formatMarginCommissionPrice } from '@/src/core/utils/priceDisplay';
import { formatCurrency } from '@/src/core/utils/formatters';

describe('formatMarginCommissionPrice', () => {
  test('shows the formula amount without stripping VAT', () => {
    expect(formatMarginCommissionPrice(1599.14)).toBe(formatCurrency(1599.14));
  });
});

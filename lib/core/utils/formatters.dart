import 'package:intl/intl.dart';

final currencyFormat = NumberFormat.currency(locale: 'fi_FI', symbol: '€', decimalDigits: 2);
final decimalFormat = NumberFormat('#,##0.0', 'fi_FI');
final percentFormat = NumberFormat('#,##0.#', 'fi_FI');

String formatCurrency(double value) => currencyFormat.format(value);
String formatDecimal(double value) => decimalFormat.format(value);
String formatPercent(double value) => '${percentFormat.format(value)} %';

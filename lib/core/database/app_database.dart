import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';

import '../models/models.dart';

class AppDatabase {
  AppDatabase._();
  static final AppDatabase instance = AppDatabase._();

  Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _open();
    return _db!;
  }

  Future<Database> _open() async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, 'urakkalaskuri.db');
    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            unit TEXT NOT NULL,
            unit_price_vat0 REAL NOT NULL,
            description TEXT,
            created_at INTEGER NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE calculations (
            id TEXT PRIMARY KEY,
            project_name TEXT NOT NULL,
            customer TEXT,
            group_duration_h REAL NOT NULL,
            crew_size INTEGER NOT NULL,
            hourly_rate REAL NOT NULL,
            margin_percent REAL NOT NULL,
            commission_percent REAL NOT NULL,
            contract_price_vat0 REAL NOT NULL,
            materials_vat0 REAL NOT NULL,
            margin_eur REAL NOT NULL,
            commission_eur REAL NOT NULL,
            total_price_vat0 REAL NOT NULL,
            vat_amount REAL NOT NULL,
            total_price_vat REAL NOT NULL,
            work_duration_days REAL NOT NULL,
            created_at INTEGER NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE calculation_lines (
            id TEXT PRIMARY KEY,
            calculation_id TEXT NOT NULL,
            product_id TEXT,
            product_name TEXT NOT NULL,
            unit TEXT NOT NULL,
            unit_price_vat0 REAL NOT NULL,
            quantity REAL NOT NULL,
            line_total_vat0 REAL NOT NULL,
            FOREIGN KEY (calculation_id) REFERENCES calculations(id)
          )
        ''');
        await db.execute('''
          CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )
        ''');
        for (final entry in _defaultSettings.entries) {
          await db.insert('settings', {'key': entry.key, 'value': entry.value});
        }
      },
    );
  }

  static const _defaultSettings = {
    'vat_percent': '25.5',
    'default_margin_percent': '35',
    'default_commission_percent': '7',
    'default_hourly_rate': '30',
    'default_crew_size': '2',
    'workday_hours': '8',
  };

  Future<AppSettings> getSettings() async {
    final db = await database;
    final rows = await db.query('settings');
    final map = {for (final row in rows) row['key']! as String: row['value']! as String};
    return AppSettings(
      vatPercent: double.parse(map['vat_percent'] ?? '25.5'),
      defaultMarginPercent: double.parse(map['default_margin_percent'] ?? '35'),
      defaultCommissionPercent: double.parse(map['default_commission_percent'] ?? '7'),
      defaultHourlyRate: double.parse(map['default_hourly_rate'] ?? '30'),
      defaultCrewSize: int.parse(map['default_crew_size'] ?? '2'),
      workdayHours: double.parse(map['workday_hours'] ?? '8'),
    );
  }

  Future<void> saveSettings(AppSettings settings) async {
    final db = await database;
    final entries = {
      'vat_percent': settings.vatPercent.toString(),
      'default_margin_percent': settings.defaultMarginPercent.toString(),
      'default_commission_percent': settings.defaultCommissionPercent.toString(),
      'default_hourly_rate': settings.defaultHourlyRate.toString(),
      'default_crew_size': settings.defaultCrewSize.toString(),
      'workday_hours': settings.workdayHours.toString(),
    };
    for (final entry in entries.entries) {
      await db.insert(
        'settings',
        {'key': entry.key, 'value': entry.value},
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
  }

  Future<List<Product>> getProducts() async {
    final db = await database;
    final rows = await db.query('products', orderBy: 'name COLLATE NOCASE ASC');
    return rows.map(_productFromRow).toList();
  }

  Product _productFromRow(Map<String, Object?> row) => Product(
        id: row['id']! as String,
        name: row['name']! as String,
        unit: row['unit']! as String,
        unitPriceVat0: row['unit_price_vat0']! as double,
        description: row['description'] as String?,
        createdAt: DateTime.fromMillisecondsSinceEpoch(row['created_at']! as int),
      );

  Future<void> upsertProduct(Product product) async {
    final db = await database;
    await db.insert(
      'products',
      {
        'id': product.id,
        'name': product.name,
        'unit': product.unit,
        'unit_price_vat0': product.unitPriceVat0,
        'description': product.description,
        'created_at': product.createdAt.millisecondsSinceEpoch,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> deleteProduct(String id) async {
    final db = await database;
    await db.delete('products', where: 'id = ?', whereArgs: [id]);
  }

  Future<List<CalculationRecord>> getCalculations() async {
    final db = await database;
    final rows = await db.query('calculations', orderBy: 'created_at DESC');
    final records = <CalculationRecord>[];
    for (final row in rows) {
      final lines = await db.query(
        'calculation_lines',
        where: 'calculation_id = ?',
        whereArgs: [row['id']],
      );
      records.add(_calculationFromRow(row, lines));
    }
    return records;
  }

  Future<CalculationRecord?> getCalculation(String id) async {
    final db = await database;
    final rows = await db.query('calculations', where: 'id = ?', whereArgs: [id]);
    if (rows.isEmpty) return null;
    final lines = await db.query(
      'calculation_lines',
      where: 'calculation_id = ?',
      whereArgs: [id],
    );
    return _calculationFromRow(rows.first, lines);
  }

  CalculationRecord _calculationFromRow(
    Map<String, Object?> row,
    List<Map<String, Object?>> lineRows,
  ) {
    return CalculationRecord(
      id: row['id']! as String,
      projectName: row['project_name']! as String,
      customer: row['customer'] as String?,
      groupDurationHours: row['group_duration_h']! as double,
      crewSize: row['crew_size']! as int,
      hourlyRate: row['hourly_rate']! as double,
      marginPercent: row['margin_percent']! as double,
      commissionPercent: row['commission_percent']! as double,
      contractPriceVat0: row['contract_price_vat0']! as double,
      materialsVat0: row['materials_vat0']! as double,
      marginEur: row['margin_eur']! as double,
      commissionEur: row['commission_eur']! as double,
      totalPriceVat0: row['total_price_vat0']! as double,
      vatAmount: row['vat_amount']! as double,
      totalPriceVat: row['total_price_vat']! as double,
      workDurationDays: row['work_duration_days']! as double,
      createdAt: DateTime.fromMillisecondsSinceEpoch(row['created_at']! as int),
      lines: lineRows
          .map(
            (line) => CalculationLine(
              id: line['id']! as String,
              productId: line['product_id'] as String?,
              productName: line['product_name']! as String,
              unit: line['unit']! as String,
              unitPriceVat0: line['unit_price_vat0']! as double,
              quantity: line['quantity']! as double,
              lineTotalVat0: line['line_total_vat0']! as double,
            ),
          )
          .toList(),
    );
  }

  Future<void> saveCalculation(CalculationRecord record) async {
    final db = await database;
    await db.transaction((txn) async {
      await txn.insert(
        'calculations',
        {
          'id': record.id,
          'project_name': record.projectName,
          'customer': record.customer,
          'group_duration_h': record.groupDurationHours,
          'crew_size': record.crewSize,
          'hourly_rate': record.hourlyRate,
          'margin_percent': record.marginPercent,
          'commission_percent': record.commissionPercent,
          'contract_price_vat0': record.contractPriceVat0,
          'materials_vat0': record.materialsVat0,
          'margin_eur': record.marginEur,
          'commission_eur': record.commissionEur,
          'total_price_vat0': record.totalPriceVat0,
          'vat_amount': record.vatAmount,
          'total_price_vat': record.totalPriceVat,
          'work_duration_days': record.workDurationDays,
          'created_at': record.createdAt.millisecondsSinceEpoch,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
      await txn.delete('calculation_lines', where: 'calculation_id = ?', whereArgs: [record.id]);
      for (final line in record.lines) {
        await txn.insert('calculation_lines', {
          'id': line.id,
          'calculation_id': record.id,
          'product_id': line.productId,
          'product_name': line.productName,
          'unit': line.unit,
          'unit_price_vat0': line.unitPriceVat0,
          'quantity': line.quantity,
          'line_total_vat0': line.lineTotalVat0,
        });
      }
    });
  }
}

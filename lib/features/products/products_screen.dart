import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:uuid/uuid.dart';

import '../../core/models/models.dart';
import '../../core/providers/providers.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common_widgets.dart';
import '../../theme/app_theme.dart';

class ProductsScreen extends ConsumerWidget {
  const ProductsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productsAsync = ref.watch(productsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Tuotteet')),
      floatingActionButton: FloatingActionButton(
        backgroundColor: AppColors.accent,
        onPressed: () => context.push('/products/new'),
        child: const Icon(Icons.add, color: AppColors.secondary),
      ),
      body: productsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Virhe: $e')),
        data: (products) {
          if (products.isEmpty) {
            return const Center(child: Text('Ei tuotteita. Lisää ensimmäinen tuote.'));
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: products.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final product = products[index];
              return AppCard(
                onTap: () => context.push('/products/${product.id}', extra: product),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(product.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text('${formatCurrency(product.unitPriceVat0)} / ${product.unit}'),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline, color: AppColors.accent),
                      onPressed: () async {
                        await ref.read(databaseProvider).deleteProduct(product.id);
                        ref.invalidate(productsProvider);
                      },
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class ProductEditScreen extends ConsumerStatefulWidget {
  const ProductEditScreen({super.key, this.product});

  final Product? product;

  @override
  ConsumerState<ProductEditScreen> createState() => _ProductEditScreenState();
}

class _ProductEditScreenState extends ConsumerState<ProductEditScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _unitController;
  late final TextEditingController _priceController;
  late final TextEditingController _descriptionController;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.product?.name ?? '');
    _unitController = TextEditingController(text: widget.product?.unit ?? 'kpl');
    _priceController = TextEditingController(
      text: widget.product?.unitPriceVat0.toString() ?? '',
    );
    _descriptionController = TextEditingController(text: widget.product?.description ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _unitController.dispose();
    _priceController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final product = Product(
      id: widget.product?.id ?? const Uuid().v4(),
      name: _nameController.text.trim(),
      unit: _unitController.text.trim(),
      unitPriceVat0: double.parse(_priceController.text.replaceAll(',', '.')),
      description: _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
      createdAt: widget.product?.createdAt ?? DateTime.now(),
    );
    await ref.read(databaseProvider).upsertProduct(product);
    ref.invalidate(productsProvider);
    if (mounted) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.product == null ? 'Lisää tuote' : 'Muokkaa tuotetta')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Nimi *'),
              validator: (v) => v == null || v.trim().isEmpty ? 'Anna nimi' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _unitController,
              decoration: const InputDecoration(labelText: 'Yksikkö *'),
              validator: (v) => v == null || v.trim().isEmpty ? 'Anna yksikkö' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _priceController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Yksikköhinta (alv0) € *'),
              validator: (v) {
                if (v == null || v.trim().isEmpty) return 'Anna hinta';
                final parsed = double.tryParse(v.replaceAll(',', '.'));
                if (parsed == null || parsed < 0) return 'Virheellinen hinta';
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _descriptionController,
              decoration: const InputDecoration(labelText: 'Kuvaus'),
              maxLines: 3,
            ),
            const SizedBox(height: 24),
            ElevatedButton(onPressed: _save, child: const Text('Tallenna')),
          ],
        ),
      ),
    );
  }
}

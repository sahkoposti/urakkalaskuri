import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/widgets/common_widgets.dart';
import '../../theme/app_theme.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Urakkalaskuri')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SectionTitle('ColoRajaton', center: true),
          const SizedBox(height: 8),
          Text(
            'Laske tarjoushinta vaiheittain.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.text.withValues(alpha: 0.9)),
          ),
          const SizedBox(height: 24),
          _NavCard(
            icon: Icons.add_circle_outline,
            title: 'Uusi laskenta',
            subtitle: 'Aloita wizard',
            onTap: () => context.push('/wizard'),
          ),
          _NavCard(
            icon: Icons.history,
            title: 'Historia',
            subtitle: 'Aiempien laskelmien lista',
            onTap: () => context.push('/history'),
          ),
          _NavCard(
            icon: Icons.inventory_2_outlined,
            title: 'Tuotteet',
            subtitle: 'Materiaalit ja hinnat',
            onTap: () => context.push('/products'),
          ),
          _NavCard(
            icon: Icons.settings_outlined,
            title: 'Asetukset',
            subtitle: 'ALV, kate, tuntihinta',
            onTap: () => context.push('/settings'),
          ),
        ],
      ),
    );
  }
}

class _NavCard extends StatelessWidget {
  const _NavCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: AppCard(
        onTap: onTap,
        child: Row(
          children: [
            Icon(icon, color: AppColors.accent, size: 32),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 17)),
                  const SizedBox(height: 4),
                  Text(subtitle, style: const TextStyle(color: AppColors.text)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.text),
          ],
        ),
      ),
    );
  }
}

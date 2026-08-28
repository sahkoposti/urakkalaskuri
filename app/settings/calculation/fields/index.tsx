import { router, Stack, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { AppCard, OutlinedButton, ScreenLoading } from '@/src/components/common';
import { ConfirmDialog } from '@/src/components/ConfirmDialog';
import { formatDebugExampleDisplay } from '@/src/core/form/debugExampleHelpers';
import { assignedFieldIds } from '@/src/core/form/formDefinitionHelpers';
import {
  FIELD_TYPE_LABELS,
  fieldsForPage,
  removeField,
  sortedGlobalFields,
  sortedPages,
} from '@/src/core/form/formMutations';
import type { FormField } from '@/src/core/form/types';
import type { Product } from '@/src/core/models/types';
import { db, useApp } from '@/src/context/AppContext';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

function FieldCard({
  field,
  formDebugEnabled,
  products,
  deletable,
  onPress,
  onDelete,
}: {
  field: FormField;
  formDebugEnabled: boolean;
  products: Product[];
  deletable: boolean;
  onPress: () => void;
  onDelete?: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <AppCard key={field.id} style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={styles.cardMain}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <Text style={styles.fieldMeta}>
            {field.key} · {FIELD_TYPE_LABELS[field.type]}
            {field.type === 'select' && field.options ? ` · ${field.options.length} valintaa` : ''}
            {field.type === 'computed' ? (field.systemKey ? ' · järjestelmäkaava' : ' · kaava') : ''}
          </Text>
        </View>
        {deletable && onDelete ? (
          <Pressable onPress={onDelete}>
            <Text style={styles.deleteText}>Poista</Text>
          </Pressable>
        ) : null}
      </View>
      {field.type === 'computed' && field.formula ? (
        <Text style={styles.formula} numberOfLines={2}>
          {field.formula}
        </Text>
      ) : null}
      {formDebugEnabled && field.debugExampleValue ? (
        <Text style={styles.example}>
          Esimerkki: {formatDebugExampleDisplay(field, products)}
        </Text>
      ) : null}
    </AppCard>
  );
}

function FieldCards({
  fields,
  formDebugEnabled,
  products,
  onDelete,
}: {
  fields: FormField[];
  formDebugEnabled: boolean;
  products: Product[];
  onDelete: (field: FormField) => void;
}) {
  return fields.map((field) => (
    <FieldCard
      key={field.id}
      field={field}
      formDebugEnabled={formDebugEnabled}
      products={products}
      deletable={!field.systemKey}
      onPress={() => router.push(`/settings/calculation/fields/${field.id}` as Href)}
      onDelete={() => onDelete(field)}
    />
  ));
}

export default function FormFieldsScreen() {
  const styles = useThemedStyles(createStyles);
  const { ready, formDefinition, formDebug, products, refreshFormSettings } = useApp();
  const [deleteTarget, setDeleteTarget] = useState<FormField | null>(null);

  if (!ready) return <ScreenLoading />;

  const pages = sortedPages(formDefinition);
  const assigned = assignedFieldIds(formDefinition);
  const unassignedFields = sortedGlobalFields(formDefinition).filter((field) => !assigned.has(field.id));

  async function confirmDeleteField() {
    if (!deleteTarget) return;
    const next = removeField(formDefinition, deleteTarget.id);
    await db.saveFormDefinition(next);
    await refreshFormSettings();
    setDeleteTarget(null);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Kentät' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.help}>
          Kentät ovat globaaleja. Kohdista ne sivuille kohdasta Lomakeasetukset → Sivut. Järjestelmäkentät
          (kesto, hinnat, ALV) näkyvät omalla sivullaan.
        </Text>
        {formDebug.enabled ? (
          <Text style={styles.debugHint}>
            Debug päällä – avaa kenttä ja syötä esimerkkiarvo live-laskentaa varten.
          </Text>
        ) : null}

        <OutlinedButton
          title="Lisää kenttä"
          onPress={() => router.push('/settings/calculation/fields/new' as Href)}
        />

        {pages.map((page) => {
          const pageFields = fieldsForPage(formDefinition, page.id);
          return (
            <View key={page.id} style={styles.pageSection}>
              <Text style={styles.pageSectionTitle}>{page.title}</Text>
              {pageFields.length === 0 ? (
                <Text style={styles.empty}>Ei kenttiä tällä sivulla</Text>
              ) : (
                <FieldCards
                  fields={pageFields}
                  formDebugEnabled={formDebug.enabled}
                  products={products}
                  onDelete={setDeleteTarget}
                />
              )}
            </View>
          );
        })}

        <View style={styles.pageSection}>
          <Text style={styles.pageSectionTitle}>Ilman sivukohdistusta</Text>
          {unassignedFields.length === 0 ? (
            <Text style={styles.empty}>Kaikki kentät on kohdistettu jollekin sivulle</Text>
          ) : (
            <FieldCards
              fields={unassignedFields}
              formDebugEnabled={formDebug.enabled}
              products={products}
              onDelete={setDeleteTarget}
            />
          )}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Poista kenttä?"
        message={
          deleteTarget
            ? `Poistetaanko kenttä "${deleteTarget.label}"? Se poistuu myös kaikilta sivuilta.`
            : ''
        }
        onClose={() => setDeleteTarget(null)}
        buttons={[
          { title: 'Peruuta', variant: 'outlined', onPress: () => setDeleteTarget(null) },
          {
            title: 'Poista',
            variant: 'destructive',
            onPress: () => {
              void confirmDeleteField();
            },
          },
        ]}
      />
    </>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 8,
    },
    help: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      lineHeight: 20,
    },
    debugHint: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.accent,
    },
    empty: {
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
    },
    pageSection: {
      gap: 6,
    },
    pageSectionTitle: {
      marginTop: 8,
      fontFamily: 'IBMPlexSans_700Bold',
      color: colors.primary,
      fontSize: 16,
    },
    card: {
      marginBottom: 0,
      padding: 10,
    },
    cardHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
    },
    cardMain: {
      flex: 1,
    },
    fieldLabel: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      color: colors.primary,
      fontSize: 15,
    },
    fieldMeta: {
      marginTop: 2,
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 13,
    },
    formula: {
      marginTop: 4,
      fontFamily: 'IBMPlexSans_400Regular',
      color: colors.text,
      fontSize: 12,
      lineHeight: 18,
    },
    example: {
      marginTop: 4,
      fontFamily: 'IBMPlexSans_500Medium',
      color: colors.accent,
      fontSize: 13,
    },
    deleteText: {
      color: colors.accent,
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 13,
    },
  };
}

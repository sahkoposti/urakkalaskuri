import { Pressable, Text, View } from 'react-native';

import { AppCard } from '@/src/components/common';
import {
  DOCUMENT_EMPTY_LIST,
  PHONE_FOLDER_CHANGE,
  PHONE_FOLDER_CLEAR,
  PHONE_FOLDER_EXPLANATION,
  documentListLabel,
  phoneSaveActionLabel,
  phoneSaveDetail,
  phoneStatusLabel,
} from '@/src/core/documents/documentLabels';
import type { PhonePlatform } from '@/src/core/documents/phoneSave';
import type { SavedDocument } from '@/src/core/documents/types';
import type { AppColorPalette } from '@/src/theme/colors';
import { useThemedStyles } from '@/src/theme/useThemedStyles';

export type ListedDocument = SavedDocument & { uri: string };

type CalculationDocumentListProps = {
  documents: ListedDocument[];
  platform: PhonePlatform;
  onPreview: (document: ListedDocument) => void;
  onShare: (document: ListedDocument) => void;
  onDelete: (document: ListedDocument) => void;
  onSaveToPhone: (document: ListedDocument) => void;
};

export function PhoneFolderBar({
  label,
  onChange,
  onClear,
}: {
  label: string;
  onChange: () => void;
  onClear: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <AppCard style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.hint}>{PHONE_FOLDER_EXPLANATION}</Text>
      <View style={styles.actions}>
        <Pressable onPress={onChange} accessibilityLabel={PHONE_FOLDER_CHANGE}>
          <Text style={styles.action}>{PHONE_FOLDER_CHANGE}</Text>
        </Pressable>
        <Pressable onPress={onClear} accessibilityLabel={PHONE_FOLDER_CLEAR}>
          <Text style={styles.action}>{PHONE_FOLDER_CLEAR}</Text>
        </Pressable>
      </View>
    </AppCard>
  );
}

export function CalculationDocumentList({
  documents,
  platform,
  onPreview,
  onShare,
  onDelete,
  onSaveToPhone,
}: CalculationDocumentListProps) {
  const styles = useThemedStyles(createStyles);
  if (documents.length === 0) {
    return <Text style={styles.empty}>{DOCUMENT_EMPTY_LIST}</Text>;
  }
  return (
    <View style={styles.list}>
      {documents.map((document) => (
        <AppCard key={document.id} style={styles.card}>
          <Text style={styles.label}>
            {documentListLabel({
              kind: document.kind,
              offerNumber: document.offerNumber,
              version: document.version,
              createdAt: new Date(document.createdAt),
              total: document.summary?.total ?? null,
            })}
          </Text>
          <Text style={document.phoneSaveStatus === 'failed' ? styles.failed : styles.hint}>
            {phoneStatusLabel(document.phoneSaveStatus, document.phoneSaveError)}
          </Text>
          {document.phoneSaveStatus === 'failed' && phoneSaveDetail(document.phoneSaveError) ? (
            <Text style={styles.hint}>{phoneSaveDetail(document.phoneSaveError)}</Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable onPress={() => onPreview(document)} accessibilityLabel="Esikatsele">
              <Text style={styles.action}>Esikatsele</Text>
            </Pressable>
            <Pressable onPress={() => onShare(document)} accessibilityLabel="Jaa">
              <Text style={styles.action}>Jaa</Text>
            </Pressable>
            {phoneSaveActionLabel(document.phoneSaveStatus, platform) ? (
              <Pressable
                onPress={() => onSaveToPhone(document)}
                accessibilityLabel={phoneSaveActionLabel(document.phoneSaveStatus, platform) ?? ''}
              >
                <Text style={styles.action}>{phoneSaveActionLabel(document.phoneSaveStatus, platform)}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => onDelete(document)} accessibilityLabel="Poista">
              <Text style={styles.action}>Poista</Text>
            </Pressable>
          </View>
        </AppCard>
      ))}
    </View>
  );
}

function createStyles(colors: AppColorPalette) {
  return {
    list: {
      gap: 12,
    },
    card: {
      gap: 10,
    },
    label: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 15,
      lineHeight: 22,
      color: colors.text,
    },
    actions: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 16,
    },
    action: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 15,
      color: colors.accent,
    },
    empty: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 15,
      color: colors.text,
    },
    hint: {
      fontFamily: 'IBMPlexSans_400Regular',
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
    failed: {
      fontFamily: 'IBMPlexSans_600SemiBold',
      fontSize: 14,
      lineHeight: 20,
      color: colors.accent,
    },
  };
}
